/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { coinbaseWalletService } from '@/lib/coinbase/wallet-service';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';
import { gasManager } from '@/lib/polygon/gas-manager';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for batch processing

interface PayoutResult {
  commissionId: string;
  userId: string;
  amount: string;
  txHash: string | null;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * POST /api/crypto/payouts/execute-batch
 * Execute an approved payout batch
 * Can be triggered by cron or admin
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authorization (cron secret or admin)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    let adminId: string | null = null;

    if (authHeader !== `Bearer ${cronSecret}`) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!['admin', 'superadmin'].includes(userData?.role || '')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      adminId = user.id;
    }

    const body = await req.json();
    const { batchId } = body;

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batchId' }, { status: 400 });
    }

    // Get the batch
    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({
        success: false,
        error: 'Batch not found',
      }, { status: 404 });
    }

    // Check batch status
    if (batch.status !== 'approved') {
      return NextResponse.json({
        success: false,
        error: `Batch cannot be executed from status: ${batch.status}`,
      }, { status: 400 });
    }

    // Atomically update to processing
    const { data: processingBatch } = await supabase
      .from('payout_batches')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', batchId)
      .eq('status', 'approved')
      .select()
      .single();

    if (!processingBatch) {
      return NextResponse.json({
        success: false,
        error: 'Batch is no longer in approved state',
      }, { status: 409 });
    }

    // Get commissions for this batch
    const { data: commissions } = await supabase
      .from('commissions')
      .select(`
        id,
        referrer_id,
        amount,
        net_amount_usdc,
        commission_type
      `)
      .eq('payout_batch_id', batchId)
      .eq('status', 'pending');

    if (!commissions || commissions.length === 0) {
      await supabase
        .from('payout_batches')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', batchId);

      return NextResponse.json({
        success: true,
        message: 'No commissions to process',
      });
    }

    // Group commissions by user
    const userPayouts = new Map<string, { total: number; commissionIds: string[] }>();

    for (const commission of commissions) {
      const userId = commission.referrer_id;
      const amount = parseFloat(commission.net_amount_usdc || commission.amount);

      if (!userPayouts.has(userId)) {
        userPayouts.set(userId, { total: 0, commissionIds: [] });
      }

      const entry = userPayouts.get(userId)!;
      entry.total += amount;
      entry.commissionIds.push(commission.id);
    }

    // Get wallets for all users
    const userIds = Array.from(userPayouts.keys());
    const { data: wallets } = await supabase
      .from('crypto_wallets')
      .select('user_id, wallet_address')
      .in('user_id', userIds)
      .eq('status', 'active');

    const walletMap = new Map(
      (wallets || []).map(w => [w.user_id, w.wallet_address])
    );

    // Process payouts
    const results: PayoutResult[] = [];
    let successCount = 0;
    let failCount = 0;
    let totalGasSpent = 0;
    const errorLog: Array<{ commission_id: string; error: string; timestamp: string }> = [];

    for (const [userId, data] of userPayouts.entries()) {
      const walletAddress = walletMap.get(userId);

      if (!walletAddress) {
        // Mark commissions as failed - no wallet
        for (const commissionId of data.commissionIds) {
          results.push({
            commissionId,
            userId,
            amount: data.total.toFixed(6),
            txHash: null,
            status: 'failed',
            error: 'User has no active wallet',
          });
          errorLog.push({
            commission_id: commissionId,
            error: 'User has no active wallet',
            timestamp: new Date().toISOString(),
          });
        }
        failCount += data.commissionIds.length;
        continue;
      }

      // Execute transfer from treasury
      const transferResult = await coinbaseWalletService.transferFromTreasury(
        walletAddress,
        data.total.toFixed(6)
      );

      if (transferResult.success && transferResult.data) {
        // Create transaction record
        const { data: transaction } = await supabase
          .from('usdc_transactions')
          .insert({
            transaction_type: 'payout',
            from_address: process.env.PLATFORM_TREASURY_WALLET_ADDRESS || '',
            to_address: walletAddress,
            amount: data.total.toFixed(6),
            polygon_tx_hash: transferResult.data.transactionHash,
            block_number: transferResult.data.blockNumber || null,
            status: transferResult.data.status,
            gas_fee_matic: transferResult.data.gasUsed || null,
            user_id: userId,
            confirmed_at: transferResult.data.status === 'confirmed' ? new Date().toISOString() : null,
          })
          .select()
          .single();

        // Update commissions
        for (const commissionId of data.commissionIds) {
          await supabase
            .from('commissions')
            .update({
              status: 'paid',
              usdc_transaction_id: transaction?.id || null,
            })
            .eq('id', commissionId);

          results.push({
            commissionId,
            userId,
            amount: data.total.toFixed(6),
            txHash: transferResult.data.transactionHash,
            status: 'success',
          });
        }

        successCount += data.commissionIds.length;
        totalGasSpent += parseFloat(transferResult.data.gasUsed || '0');

        // Log gas usage
        if (transaction) {
          await gasManager.logGasUsage(supabase, {
            transactionId: transaction.id,
            transactionType: 'payout',
            gasUsed: parseInt(transferResult.data.gasUsed || '0'),
            gasPriceGwei: '0',
            maticSpent: transferResult.data.gasUsed || '0',
            txHash: transferResult.data.transactionHash,
            blockNumber: transferResult.data.blockNumber || 0,
          });
        }
      } else {
        // Transfer failed
        for (const commissionId of data.commissionIds) {
          results.push({
            commissionId,
            userId,
            amount: data.total.toFixed(6),
            txHash: null,
            status: 'failed',
            error: transferResult.error?.message || 'Transfer failed',
          });
          errorLog.push({
            commission_id: commissionId,
            error: transferResult.error?.message || 'Transfer failed',
            timestamp: new Date().toISOString(),
          });
        }
        failCount += data.commissionIds.length;
      }
    }

    // Update batch with results
    const finalStatus = failCount === 0 ? 'completed' : 'completed';
    await supabase
      .from('payout_batches')
      .update({
        status: finalStatus,
        successful_payouts: successCount,
        failed_payouts: failCount,
        total_gas_spent_matic: totalGasSpent.toString(),
        error_log: errorLog,
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'payout_executed',
      user_id: null,
      admin_id: adminId,
      entity_type: 'payout_batch',
      entity_id: batchId,
      details: {
        batch_name: batch.batch_name,
        successful: successCount,
        failed: failCount,
        total_gas_spent: totalGasSpent.toString(),
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    });

    console.log(`[ExecuteBatch] Batch ${batchId} completed: ${successCount} success, ${failCount} failed`);

    return NextResponse.json({
      success: true,
      message: `Batch execution completed: ${successCount} successful, ${failCount} failed`,
      batch: {
        id: batchId,
        status: finalStatus,
        successfulPayouts: successCount,
        failedPayouts: failCount,
        totalGasSpent: totalGasSpent.toString(),
      },
      results: results.slice(0, 50), // Limit response size
    });
  } catch (error: any) {
    console.error('[ExecuteBatch] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
