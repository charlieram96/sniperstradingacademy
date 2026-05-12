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

    let confirmed = 0;
    let pending = 0;
    let failed = 0;
    let totalSweptUsdc = 0;

    if (!users || users.length === 0) {
      console.log('[SweepVerify] No transactions to verify');
      const duration = Date.now() - startTime;
      await supabase.from('crypto_audit_log').insert({
        event_type: 'sweep_verify_completed',
        entity_type: 'treasury',
        details: {
          transactions_checked: 0,
          confirmed: 0,
          pending: 0,
          failed: 0,
          total_swept_usdc: 0,
          duration_ms: duration,
        },
      });
      return NextResponse.json({
        success: true,
        message: 'No transactions to verify',
        stats: { verified: 0 },
        duration,
      });
    }

    console.log(`[SweepVerify] Verifying ${users.length} transactions...`);

    // Set up provider
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    for (const user of users) {
      try {
        // sweep_tx may hold a comma-joined list (multi-token sweeps: native USDC + bridged USDC.e).
        const hashes = (user.sweep_tx as string).split(',').map((h) => h.trim()).filter(Boolean);

        const receipts = await Promise.all(
          hashes.map((h) => provider.getTransactionReceipt(h).catch(() => null))
        );

        let anyPending = false;
        let anyReverted = false;
        let firstRevertHash: string | null = null;
        let lastConfirmedReceipt: ethers.TransactionReceipt | null = null;

        for (let i = 0; i < receipts.length; i++) {
          const receipt = receipts[i];
          if (receipt === null) {
            anyPending = true;
          } else if (receipt.status === 1) {
            lastConfirmedReceipt = receipt;
          } else {
            anyReverted = true;
            firstRevertHash = firstRevertHash ?? hashes[i];
          }
        }

        if (anyPending) {
          pending++;
          console.log(`[SweepVerify] ${user.email}: at least one tx still pending (${hashes.length} total)`);
          continue;
        }

        if (anyReverted) {
          console.error(`[SweepVerify] ${user.email}: tx ${firstRevertHash} reverted on-chain`);
          await supabase
            .from('users')
            .update({
              sweep_status: 'failed',
              sweep_error: `Transaction reverted on-chain: ${firstRevertHash}`,
            })
            .eq('id', user.id);
          await supabase.from('crypto_audit_log').insert({
            event_type: 'deposit_sweep_failed',
            user_id: user.id,
            entity_type: 'user',
            entity_id: user.id,
            details: {
              deposit_address: user.crypto_deposit_address,
              tx_hashes: hashes,
              reverted_tx: firstRevertHash,
              error: 'Transaction reverted',
            },
          });
          failed++;
          continue;
        }

        // All hashes confirmed.
        console.log(`[SweepVerify] ${user.email}: sweep confirmed, ${user.sweep_usdc_balance} USDC (${hashes.length} tx)`);
        await supabase
          .from('users')
          .update({
            sweep_status: 'idle',
            sweep_completed_at: new Date().toISOString(),
            sweep_error: null,
          })
          .eq('id', user.id);
        await supabase.from('crypto_audit_log').insert({
          event_type: 'deposit_swept',
          user_id: user.id,
          entity_type: 'user',
          entity_id: user.id,
          details: {
            deposit_address: user.crypto_deposit_address,
            amount_usdc: user.sweep_usdc_balance,
            tx_hashes: hashes,
            block_number: lastConfirmedReceipt?.blockNumber ?? null,
            gas_used: lastConfirmedReceipt?.gasUsed?.toString() ?? null,
          },
        });
        confirmed++;
        totalSweptUsdc += parseFloat(user.sweep_usdc_balance || '0');
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
