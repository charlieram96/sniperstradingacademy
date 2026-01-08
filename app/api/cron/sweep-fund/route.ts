/**
 * Sweep Fund Cron Job
 * Step 2 of the sweep pipeline: Funds users with POL for gas
 *
 * This job:
 * 1. Finds users with sweep_status = 'needs_funding'
 * 2. Broadcasts POL funding transactions (no wait for confirmation)
 * 3. Updates sweep_status to 'funding_sent'
 *
 * Run frequency: Every 5 minutes
 * Expected duration: < 60 seconds
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ethers } from 'ethers';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Amount of POL to send for gas
const FUNDING_AMOUNT_POL = '0.15';
// Max users to fund per run
const BATCH_SIZE = 20;

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[SweepFund] Starting funding run...');

    // Check gas tank configuration
    const gasTankPrivateKey = process.env.GAS_TANK_PRIVATE_KEY;
    if (!gasTankPrivateKey) {
      console.error('[SweepFund] GAS_TANK_PRIVATE_KEY not configured');
      return NextResponse.json({ error: 'Gas tank not configured' }, { status: 500 });
    }

    const supabase = createServiceRoleClient();

    // Find users that need funding, prioritize by USDC balance (highest first)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, crypto_deposit_address, sweep_usdc_balance')
      .eq('sweep_status', 'needs_funding')
      .order('sweep_usdc_balance', { ascending: false })
      .limit(BATCH_SIZE);

    if (error) {
      console.error('[SweepFund] Error fetching users:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!users || users.length === 0) {
      console.log('[SweepFund] No users need funding');
      return NextResponse.json({
        success: true,
        message: 'No users need funding',
        stats: { funded: 0 },
        duration: Date.now() - startTime,
      });
    }

    console.log(`[SweepFund] Funding ${users.length} users...`);

    // Set up provider and wallet
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(gasTankPrivateKey, provider);

    // Get current nonce (we'll increment manually for parallel broadcasts)
    let nonce = await provider.getTransactionCount(wallet.address, 'pending');

    // Get gas price once (reuse for all txs)
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('30', 'gwei');

    let funded = 0;
    let failed = 0;
    const txHashes: string[] = [];

    // Broadcast all funding transactions (no waiting)
    for (const user of users) {
      try {
        // Send POL for gas
        const tx = await wallet.sendTransaction({
          to: user.crypto_deposit_address,
          value: ethers.parseEther(FUNDING_AMOUNT_POL),
          nonce: nonce++,
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit: 21000, // Simple transfer
        });

        console.log(`[SweepFund] Sent ${FUNDING_AMOUNT_POL} POL to ${user.crypto_deposit_address}, tx: ${tx.hash}`);

        // Update user status (don't wait for confirmation)
        await supabase
          .from('users')
          .update({
            sweep_status: 'funding_sent',
            sweep_funding_tx: tx.hash,
            sweep_funded_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        funded++;
        txHashes.push(tx.hash);
      } catch (err) {
        console.error(`[SweepFund] Error funding ${user.email}:`, err);

        // Mark as failed
        await supabase
          .from('users')
          .update({
            sweep_status: 'failed',
            sweep_error: err instanceof Error ? err.message : 'Funding failed',
          })
          .eq('id', user.id);

        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SweepFund] Complete in ${duration}ms. Funded: ${funded}, Failed: ${failed}`);

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'sweep_fund_completed',
      entity_type: 'treasury',
      details: {
        users_processed: users.length,
        funded,
        failed,
        amount_per_user: FUNDING_AMOUNT_POL,
        tx_hashes: txHashes,
        duration_ms: duration,
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        funded,
        failed,
        txHashes,
      },
      duration,
    });
  } catch (error) {
    console.error('[SweepFund] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
