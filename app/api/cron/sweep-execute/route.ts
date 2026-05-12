/**
 * Sweep Execute Cron Job
 * Step 3 of the sweep pipeline: Executes USDC sweeps
 *
 * This job:
 * 1. Checks 'funding_sent' users to see if POL arrived -> marks 'ready'
 * 2. Finds users with sweep_status = 'ready'
 * 3. Broadcasts USDC sweep transactions (no wait for confirmation)
 * 4. Updates sweep_status to 'sweeping'
 *
 * Run frequency: Every 5 minutes
 * Expected duration: < 60 seconds
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';
import { getMasterXprv, derivePrivateKey, verifyDerivedAddress } from '@/lib/treasury/sweep-service';
import { getTreasurySetting } from '@/lib/treasury/treasury-service';
import { POLYGON_CONFIG, ACCEPTED_USDC_CONTRACTS_MAINNET } from '@/lib/coinbase/wallet-types';
import { computeOutgoingFees } from '@/lib/treasury/gas-config';
import { ethers } from 'ethers';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Minimum POL needed for gas
const MIN_POL_FOR_GAS = 0.08;
// Max users to process per run
const BATCH_SIZE = 20;
// If a funding tx hasn't been mined after this long, mark the user 'failed' so
// admin can replace the stuck nonce via /api/admin/treasury/replace-stuck-tx.
const FUNDING_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// USDC contract ABI (minimal for transfer)
const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[SweepExecute] Starting execution run...');

    const supabase = createServiceRoleClient();

    // Get treasury configuration
    const masterXprv = await getMasterXprv();
    if (!masterXprv) {
      return NextResponse.json({ error: 'Master xprv not configured' }, { status: 500 });
    }

    const treasuryAddress = await getTreasurySetting('treasury_wallet_address');
    if (!treasuryAddress) {
      return NextResponse.json({ error: 'Treasury address not configured' }, { status: 500 });
    }

    // Set up provider once - used by step 1 (timeout check) and step 3 (sweep broadcast).
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Step 1: Check 'funding_sent' users to see if POL arrived, or time out stuck ones.
    const { data: fundingUsers } = await supabase
      .from('users')
      .select('id, email, crypto_deposit_address, sweep_funded_at, sweep_funding_tx')
      .eq('sweep_status', 'funding_sent')
      .limit(BATCH_SIZE);

    let promotedToReady = 0;
    let timedOut = 0;

    if (fundingUsers && fundingUsers.length > 0) {
      console.log(`[SweepExecute] Checking ${fundingUsers.length} users for POL arrival...`);

      for (const user of fundingUsers) {
        const polResult = await polygonUSDCClient.getMATICBalance(user.crypto_deposit_address);
        const polBalance = parseFloat(polResult.data || '0');

        if (polBalance >= MIN_POL_FOR_GAS) {
          await supabase
            .from('users')
            .update({ sweep_status: 'ready' })
            .eq('id', user.id);
          promotedToReady++;
          continue;
        }

        // POL hasn't arrived. If the funding tx has been broadcast too long ago,
        // assume it's stuck in mempool (underpriced gas / nonce blocked) and surface
        // the failure so admin can run replace-stuck-tx.
        const fundedAt = user.sweep_funded_at ? new Date(user.sweep_funded_at).getTime() : 0;
        const ageMs = Date.now() - fundedAt;
        if (fundedAt > 0 && ageMs > FUNDING_TIMEOUT_MS && user.sweep_funding_tx) {
          const fundingTx = await provider.getTransaction(user.sweep_funding_tx).catch(() => null);
          if (!fundingTx || fundingTx.blockNumber === null) {
            const nonceStr = fundingTx?.nonce !== undefined ? `nonce ${fundingTx.nonce}` : 'nonce unknown';
            await supabase
              .from('users')
              .update({
                sweep_status: 'failed',
                sweep_error: `Funding tx stuck in mempool (${nonceStr}). Admin must replace via /admin/financials.`,
              })
              .eq('id', user.id);
            await supabase.from('crypto_audit_log').insert({
              event_type: 'deposit_sweep_failed',
              user_id: user.id,
              entity_type: 'user',
              entity_id: user.id,
              details: {
                reason: 'funding_tx_stuck',
                funding_tx: user.sweep_funding_tx,
                nonce: fundingTx?.nonce ?? null,
                funded_at: user.sweep_funded_at,
                age_seconds: Math.round(ageMs / 1000),
              },
            });
            timedOut++;
          }
        }
      }
      console.log(`[SweepExecute] ${promotedToReady} promoted to 'ready', ${timedOut} timed out`);
    }

    // Step 2: Find users ready to sweep
    const { data: readyUsers, error } = await supabase
      .from('users')
      .select('id, email, crypto_deposit_address, crypto_derivation_index, sweep_usdc_balance')
      .eq('sweep_status', 'ready')
      .order('sweep_usdc_balance', { ascending: false })
      .limit(BATCH_SIZE);

    if (error) {
      console.error('[SweepExecute] Error fetching ready users:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const fundingSentRemaining = (fundingUsers?.length || 0) - promotedToReady - timedOut;
    let swept = 0;
    let failed = 0;
    const txHashes: string[] = [];

    if (!readyUsers || readyUsers.length === 0) {
      console.log('[SweepExecute] No users ready to sweep');
      const duration = Date.now() - startTime;
      await supabase.from('crypto_audit_log').insert({
        event_type: 'sweep_execute_completed',
        entity_type: 'treasury',
        details: {
          promoted_to_ready: promotedToReady,
          timed_out: timedOut,
          funding_sent_remaining: fundingSentRemaining,
          users_swept: 0,
          failed: 0,
          tx_hashes: [],
          treasury_address: treasuryAddress,
          duration_ms: duration,
        },
      });
      return NextResponse.json({
        success: true,
        message: 'No users ready to sweep',
        stats: { promotedToReady, timedOut, swept: 0, fundingSentRemaining },
        duration,
      });
    }

    console.log(`[SweepExecute] Sweeping ${readyUsers.length} users...`);

    // Get all USDC contract addresses to sweep
    const network = (process.env.POLYGON_NETWORK as 'polygon' | 'polygon-testnet') || 'polygon';
    const usdcAddresses = network === 'polygon'
      ? [...ACCEPTED_USDC_CONTRACTS_MAINNET]
      : [POLYGON_CONFIG.TESTNET.usdcContract];

    // Get gas price once. 1.5x buffer keeps txs above the mempool floor even if
    // network gas spikes between sign-time and inclusion-time.
    const feeData = await provider.getFeeData();
    const { maxFeePerGas, maxPriorityFeePerGas } = computeOutgoingFees(feeData);

    for (const user of readyUsers) {
      try {
        // Derive private key for this user's deposit address
        const privateKey = derivePrivateKey(masterXprv, user.crypto_derivation_index);

        // Verify the derived address matches
        if (!verifyDerivedAddress(privateKey, user.crypto_deposit_address)) {
          throw new Error('Derived address mismatch');
        }

        // Create wallet
        const wallet = new ethers.Wallet(privateKey, provider);

        // Check balance on each USDC contract and sweep non-zero ones
        let totalBalanceUsdc = 0;
        const userTxHashes: string[] = [];

        for (const usdcAddr of usdcAddresses) {
          const usdcContract = new ethers.Contract(usdcAddr, USDC_ABI, wallet);
          const balanceRaw = await usdcContract.balanceOf(user.crypto_deposit_address);
          const balanceUsdc = parseFloat(ethers.formatUnits(balanceRaw, 6));

          if (balanceUsdc < 1) {
            continue;
          }

          // Execute transfer for this token
          const tx = await usdcContract.transfer(treasuryAddress, balanceRaw, {
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasLimit: 100000,
          });

          const tokenLabel = usdcAddr.toLowerCase() === POLYGON_CONFIG.MAINNET.usdcContract.toLowerCase()
            ? 'USDC' : 'USDC.e';
          console.log(`[SweepExecute] Sweeping ${balanceUsdc} ${tokenLabel} from ${user.crypto_deposit_address}, tx: ${tx.hash}`);

          totalBalanceUsdc += balanceUsdc;
          userTxHashes.push(tx.hash);
          txHashes.push(tx.hash);
        }

        if (totalBalanceUsdc < 1) {
          // Balance disappeared between identify and execute (user withdrew, RPC race, etc).
          // Set sweep_completed_at so identify's "ORDER BY sweep_completed_at ASC NULLS FIRST"
          // rotates this user to the back of the queue.
          console.log(`[SweepExecute] Skipping ${user.email}: combined balance ${totalBalanceUsdc} below minimum`);
          await supabase
            .from('users')
            .update({
              sweep_status: 'idle',
              sweep_usdc_balance: totalBalanceUsdc,
              sweep_completed_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          continue;
        }

        // Store all tx hashes (comma-joined). sweep-verify will check every hash and
        // only mark idle when all confirm; otherwise multi-token sweeps would lose
        // tracking on the first transfer.
        await supabase
          .from('users')
          .update({
            sweep_status: 'sweeping',
            sweep_tx: userTxHashes.join(','),
            sweep_executed_at: new Date().toISOString(),
            sweep_usdc_balance: totalBalanceUsdc,
          })
          .eq('id', user.id);

        swept++;
      } catch (err) {
        console.error(`[SweepExecute] Error sweeping ${user.email}:`, err);

        await supabase
          .from('users')
          .update({
            sweep_status: 'failed',
            sweep_error: err instanceof Error ? err.message : 'Sweep execution failed',
          })
          .eq('id', user.id);

        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SweepExecute] Complete in ${duration}ms. Promoted: ${promotedToReady}, Timed out: ${timedOut}, Swept: ${swept}, Failed: ${failed}`);

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'sweep_execute_completed',
      entity_type: 'treasury',
      details: {
        promoted_to_ready: promotedToReady,
        timed_out: timedOut,
        funding_sent_remaining: fundingSentRemaining,
        users_swept: swept,
        failed,
        tx_hashes: txHashes,
        treasury_address: treasuryAddress,
        duration_ms: duration,
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        promotedToReady,
        timedOut,
        swept,
        failed,
        txHashes,
      },
      duration,
    });
  } catch (error) {
    console.error('[SweepExecute] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
