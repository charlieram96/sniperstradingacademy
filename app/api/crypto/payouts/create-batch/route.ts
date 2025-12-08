/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';
import { gasManager } from '@/lib/polygon/gas-manager';

export const runtime = 'nodejs';

/**
 * POST /api/crypto/payouts/create-batch
 * Create a payout batch from pending commissions
 * Only accessible by admin/superadmin
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin authentication
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

    const body = await req.json();
    const { batchType = 'mixed', minAmount = 10, maxPayouts = 100 } = body;

    // Get pending commissions that aren't already in a batch
    const { data: pendingCommissions, error: fetchError } = await supabase
      .from('commissions')
      .select(`
        id,
        referrer_id,
        amount,
        net_amount_usdc,
        commission_type,
        created_at
      `)
      .eq('status', 'pending')
      .is('payout_batch_id', null)
      .gte('amount', minAmount)
      .order('created_at', { ascending: true })
      .limit(maxPayouts);

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch pending commissions',
        details: fetchError.message,
      }, { status: 500 });
    }

    if (!pendingCommissions || pendingCommissions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending commissions to batch',
        batch: null,
      });
    }

    // Group commissions by user (for aggregation)
    const userTotals = new Map<string, { total: number; commissionIds: string[] }>();

    for (const commission of pendingCommissions) {
      const userId = commission.referrer_id;
      const amount = parseFloat(commission.net_amount_usdc || commission.amount);

      if (!userTotals.has(userId)) {
        userTotals.set(userId, { total: 0, commissionIds: [] });
      }

      const entry = userTotals.get(userId)!;
      entry.total += amount;
      entry.commissionIds.push(commission.id);
    }

    // Get wallet addresses for all users (from users.payout_wallet_address)
    const userIds = Array.from(userTotals.keys());
    const { data: usersWithWallets } = await supabase
      .from('users')
      .select('id, payout_wallet_address')
      .in('id', userIds)
      .not('payout_wallet_address', 'is', null);

    const walletMap = new Map(
      (usersWithWallets || []).map(u => [u.id, u.payout_wallet_address])
    );

    // Filter out users without wallets
    const validPayouts: Array<{
      userId: string;
      walletAddress: string;
      amount: number;
      commissionIds: string[];
    }> = [];

    let totalAmount = 0;
    for (const [userId, data] of userTotals.entries()) {
      const walletAddress = walletMap.get(userId);
      if (walletAddress && data.total >= minAmount) {
        validPayouts.push({
          userId,
          walletAddress,
          amount: data.total,
          commissionIds: data.commissionIds,
        });
        totalAmount += data.total;
      }
    }

    if (validPayouts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with valid wallets for payout',
        batch: null,
      });
    }

    // Estimate gas costs
    const gasWalletAddress = process.env.PLATFORM_GAS_WALLET_ADDRESS || process.env.PLATFORM_TREASURY_WALLET_ADDRESS;
    let estimatedGasMatic = '0';

    if (gasWalletAddress) {
      const gasEstimate = await gasManager.estimateBatchGas(
        validPayouts.length,
        supabase
      );
      estimatedGasMatic = gasEstimate.totalEstimatedMatic;
    }

    // Create payout batch
    const batchName = `${batchType}_${new Date().toISOString().split('T')[0]}_${Date.now()}`;

    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .insert({
        batch_name: batchName,
        batch_type: batchType,
        total_amount_usdc: totalAmount.toFixed(6),
        total_payouts: validPayouts.length,
        estimated_gas_matic: estimatedGasMatic,
        status: 'pending',
        commission_ids: pendingCommissions.map(c => c.id),
      })
      .select()
      .single();

    if (batchError || !batch) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create payout batch',
        details: batchError?.message,
      }, { status: 500 });
    }

    // Update commissions with batch reference
    await supabase
      .from('commissions')
      .update({ payout_batch_id: batch.id })
      .in('id', pendingCommissions.map(c => c.id));

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'admin_action',
      user_id: null,
      admin_id: user.id,
      entity_type: 'payout_batch',
      entity_id: batch.id,
      details: {
        action: 'batch_created',
        total_amount: totalAmount.toFixed(6),
        total_payouts: validPayouts.length,
        commission_count: pendingCommissions.length,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Created payout batch with ${validPayouts.length} payouts`,
      batch: {
        id: batch.id,
        name: batch.batch_name,
        type: batch.batch_type,
        totalAmount: batch.total_amount_usdc,
        totalPayouts: batch.total_payouts,
        estimatedGas: batch.estimated_gas_matic,
        status: batch.status,
      },
      payouts: validPayouts.map(p => ({
        userId: p.userId,
        amount: p.amount.toFixed(6),
        commissionCount: p.commissionIds.length,
      })),
    });
  } catch (error: any) {
    console.error('[CreateBatch] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crypto/payouts/create-batch
 * List pending commissions that could be batched
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin authentication
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

    // Get pending commissions count and total
    const { data: pendingStats, error: statsError } = await supabase
      .from('commissions')
      .select('amount, net_amount_usdc')
      .eq('status', 'pending')
      .is('payout_batch_id', null);

    if (statsError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch pending commissions',
      }, { status: 500 });
    }

    const totalPending = pendingStats?.length || 0;
    const totalAmount = pendingStats?.reduce((sum, c) => {
      return sum + parseFloat(c.net_amount_usdc || c.amount);
    }, 0) || 0;

    // Get unique users with pending commissions
    const { data: uniqueUsers } = await supabase
      .from('commissions')
      .select('referrer_id')
      .eq('status', 'pending')
      .is('payout_batch_id', null);

    const uniqueUserCount = new Set(uniqueUsers?.map(u => u.referrer_id)).size;

    return NextResponse.json({
      success: true,
      pending: {
        totalCommissions: totalPending,
        totalAmount: totalAmount.toFixed(6),
        uniqueUsers: uniqueUserCount,
      },
    });
  } catch (error: any) {
    console.error('[GetPendingStats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
