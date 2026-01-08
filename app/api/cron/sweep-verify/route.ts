/**
 * Sweep Verify Cron Job
 * Step 4 of the sweep pipeline: Verifies sweep transactions
 *
 * This job:
 * 1. Finds users with sweep_status = 'sweeping'
 * 2. Checks transaction confirmation status
 * 3. Updates sweep_status to 'idle' (complete) or 'failed'
 *
 * Run frequency: Every 5 minutes
 * Expected duration: < 30 seconds
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ethers } from 'ethers';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Max users to verify per run
const BATCH_SIZE = 50;

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[SweepVerify] Starting verification run...');

    const supabase = createServiceRoleClient();

    // Find users with pending sweep transactions
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, crypto_deposit_address, sweep_tx, sweep_usdc_balance')
      .eq('sweep_status', 'sweeping')
      .not('sweep_tx', 'is', null)
      .limit(BATCH_SIZE);

    if (error) {
      console.error('[SweepVerify] Error fetching users:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!users || users.length === 0) {
      console.log('[SweepVerify] No transactions to verify');
      return NextResponse.json({
        success: true,
        message: 'No transactions to verify',
        stats: { verified: 0 },
        duration: Date.now() - startTime,
      });
    }

    console.log(`[SweepVerify] Verifying ${users.length} transactions...`);

    // Set up provider
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    let confirmed = 0;
    let pending = 0;
    let failed = 0;
    let totalSweptUsdc = 0;

    for (const user of users) {
      try {
        // Get transaction receipt
        const receipt = await provider.getTransactionReceipt(user.sweep_tx);

        if (receipt === null) {
          // Transaction still pending
          pending++;
          console.log(`[SweepVerify] ${user.email}: tx ${user.sweep_tx} still pending`);
          continue;
        }

        if (receipt.status === 1) {
          // Transaction confirmed successfully
          console.log(`[SweepVerify] ${user.email}: sweep confirmed, ${user.sweep_usdc_balance} USDC`);

          await supabase
            .from('users')
            .update({
              sweep_status: 'idle',
              sweep_completed_at: new Date().toISOString(),
              sweep_error: null,
            })
            .eq('id', user.id);

          // Log individual sweep audit event
          await supabase.from('crypto_audit_log').insert({
            event_type: 'deposit_swept',
            user_id: user.id,
            entity_type: 'user',
            entity_id: user.id,
            details: {
              deposit_address: user.crypto_deposit_address,
              amount_usdc: user.sweep_usdc_balance,
              tx_hash: user.sweep_tx,
              block_number: receipt.blockNumber,
              gas_used: receipt.gasUsed.toString(),
            },
          });

          confirmed++;
          totalSweptUsdc += parseFloat(user.sweep_usdc_balance || '0');
        } else {
          // Transaction failed on-chain
          console.error(`[SweepVerify] ${user.email}: tx ${user.sweep_tx} failed on-chain`);

          await supabase
            .from('users')
            .update({
              sweep_status: 'failed',
              sweep_error: 'Transaction reverted on-chain',
            })
            .eq('id', user.id);

          // Log failure
          await supabase.from('crypto_audit_log').insert({
            event_type: 'deposit_sweep_failed',
            user_id: user.id,
            entity_type: 'user',
            entity_id: user.id,
            details: {
              deposit_address: user.crypto_deposit_address,
              tx_hash: user.sweep_tx,
              error: 'Transaction reverted',
            },
          });

          failed++;
        }
      } catch (err) {
        console.error(`[SweepVerify] Error verifying ${user.email}:`, err);
        // Don't change status - will retry next run
        pending++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SweepVerify] Complete in ${duration}ms. Confirmed: ${confirmed}, Pending: ${pending}, Failed: ${failed}, Total USDC: ${totalSweptUsdc}`);

    // Log summary audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'sweep_verify_completed',
      entity_type: 'treasury',
      details: {
        transactions_checked: users.length,
        confirmed,
        pending,
        failed,
        total_swept_usdc: totalSweptUsdc,
        duration_ms: duration,
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        confirmed,
        pending,
        failed,
        totalSweptUsdc,
      },
      duration,
    });
  } catch (error) {
    console.error('[SweepVerify] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
