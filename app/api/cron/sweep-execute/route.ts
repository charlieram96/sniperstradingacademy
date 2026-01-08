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
import { ethers } from 'ethers';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Minimum POL needed for gas
const MIN_POL_FOR_GAS = 0.08;
// Max users to process per run
const BATCH_SIZE = 20;

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

    // Step 1: Check 'funding_sent' users to see if POL arrived
    const { data: fundingUsers } = await supabase
      .from('users')
      .select('id, email, crypto_deposit_address')
      .eq('sweep_status', 'funding_sent')
      .limit(BATCH_SIZE);

    let promotedToReady = 0;

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
        }
      }
      console.log(`[SweepExecute] ${promotedToReady} users promoted to 'ready'`);
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

    if (!readyUsers || readyUsers.length === 0) {
      console.log('[SweepExecute] No users ready to sweep');
      return NextResponse.json({
        success: true,
        message: 'No users ready to sweep',
        stats: { promotedToReady, swept: 0 },
        duration: Date.now() - startTime,
      });
    }

    console.log(`[SweepExecute] Sweeping ${readyUsers.length} users...`);

    // Set up provider
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Get USDC contract address from config
    const network = (process.env.POLYGON_NETWORK as 'polygon' | 'polygon-testnet') || 'polygon';
    const usdcAddress = network === 'polygon'
      ? '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' // Polygon mainnet USDC
      : '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'; // Testnet

    // Get gas price once
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('100', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('30', 'gwei');

    let swept = 0;
    let failed = 0;
    const txHashes: string[] = [];

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

        // Get actual USDC balance
        const usdcContract = new ethers.Contract(usdcAddress, USDC_ABI, wallet);
        const balanceRaw = await usdcContract.balanceOf(user.crypto_deposit_address);
        const balanceUsdc = parseFloat(ethers.formatUnits(balanceRaw, 6));

        if (balanceUsdc < 1) {
          console.log(`[SweepExecute] Skipping ${user.email}: balance ${balanceUsdc} below minimum`);
          await supabase
            .from('users')
            .update({ sweep_status: 'idle', sweep_usdc_balance: balanceUsdc })
            .eq('id', user.id);
          continue;
        }

        // Execute transfer
        const tx = await usdcContract.transfer(treasuryAddress, balanceRaw, {
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit: 100000,
        });

        console.log(`[SweepExecute] Sweeping ${balanceUsdc} USDC from ${user.crypto_deposit_address}, tx: ${tx.hash}`);

        // Update user status
        await supabase
          .from('users')
          .update({
            sweep_status: 'sweeping',
            sweep_tx: tx.hash,
            sweep_executed_at: new Date().toISOString(),
            sweep_usdc_balance: balanceUsdc,
          })
          .eq('id', user.id);

        swept++;
        txHashes.push(tx.hash);
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
    console.log(`[SweepExecute] Complete in ${duration}ms. Promoted: ${promotedToReady}, Swept: ${swept}, Failed: ${failed}`);

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'sweep_execute_completed',
      entity_type: 'treasury',
      details: {
        promoted_to_ready: promotedToReady,
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
