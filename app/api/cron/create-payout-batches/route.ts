import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { gasManager } from '@/lib/polygon/gas-manager';

export const runtime = 'nodejs';

/**
 * GET /api/cron/create-payout-batches
 * Creates daily payout batches from pending commissions
 * Vercel Cron: "0 0 * * *" (midnight daily)
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/create-payout-batches",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get pending commissions not in a batch
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
      .gte('amount', 10) // Minimum $10 payout
      .order('created_at', { ascending: true })
      .limit(500);

    if (fetchError) {
      console.error('[CreatePayoutBatches] Fetch error:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch pending commissions',
      }, { status: 500 });
    }

    if (!pendingCommissions || pendingCommissions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending commissions to batch',
        batchesCreated: 0,
      });
    }

    // Separate by commission type
    const directBonuses = pendingCommissions.filter(c => c.commission_type === 'direct_bonus');
    const residuals = pendingCommissions.filter(c => c.commission_type !== 'direct_bonus');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batches: any[] = [];

    // Create direct bonus batch if any
    if (directBonuses.length > 0) {
      const batch = await createBatch(supabase, directBonuses, 'direct_bonuses');
      if (batch) batches.push(batch);
    }

    // Create residual batch if any
    if (residuals.length > 0) {
      const batch = await createBatch(supabase, residuals, 'monthly_residual');
      if (batch) batches.push(batch);
    }

    console.log(`[CreatePayoutBatches] Created ${batches.length} batches from ${pendingCommissions.length} commissions`);

    return NextResponse.json({
      success: true,
      message: `Created ${batches.length} payout batches`,
      batchesCreated: batches.length,
      batches: batches.map(b => ({
        id: b.id,
        name: b.batch_name,
        type: b.batch_type,
        totalAmount: b.total_amount_usdc,
        totalPayouts: b.total_payouts,
      })),
    });
  } catch (error: unknown) {
    console.error('[CreatePayoutBatches] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createBatch(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  commissions: { id: string; referrer_id: string; amount: string; net_amount_usdc: string | null; commission_type: string; created_at: string }[],
  batchType: string
): Promise<Record<string, unknown> | null> {
  try {
    // Group by user
    const userTotals = new Map<string, { total: number; commissionIds: string[] }>();

    for (const commission of commissions) {
      const userId = commission.referrer_id;
      const amount = parseFloat(commission.net_amount_usdc || commission.amount);

      if (!userTotals.has(userId)) {
        userTotals.set(userId, { total: 0, commissionIds: [] });
      }

      const entry = userTotals.get(userId)!;
      entry.total += amount;
      entry.commissionIds.push(commission.id);
    }

    // Get wallets for validation
    const userIds = Array.from(userTotals.keys());
    const { data: wallets } = await supabase
      .from('crypto_wallets')
      .select('user_id, wallet_address')
      .in('user_id', userIds)
      .eq('status', 'active');

    const walletMap = new Map(
      (wallets || []).map((w: { user_id: string; wallet_address: string }) => [w.user_id, w.wallet_address])
    );

    // Filter to users with wallets
    let totalAmount = 0;
    let validPayouts = 0;

    for (const [userId, data] of userTotals.entries()) {
      if (walletMap.has(userId) && data.total >= 10) {
        totalAmount += data.total;
        validPayouts++;
      }
    }

    if (validPayouts === 0) {
      return null;
    }

    // Estimate gas
    const gasEstimate = await gasManager.estimateBatchGas(validPayouts, supabase);

    // Create batch
    const batchName = `${batchType}_${new Date().toISOString().split('T')[0]}`;

    const { data: batch, error } = await supabase
      .from('payout_batches')
      .insert({
        batch_name: batchName,
        batch_type: batchType,
        total_amount_usdc: totalAmount.toFixed(6),
        total_payouts: validPayouts,
        estimated_gas_matic: gasEstimate.totalEstimatedMatic,
        status: 'pending',
        commission_ids: commissions.map(c => c.id),
      })
      .select()
      .single();

    if (error || !batch) {
      console.error('[CreatePayoutBatches] Failed to create batch:', error);
      return null;
    }

    // Update commissions with batch reference
    await supabase
      .from('commissions')
      .update({ payout_batch_id: batch.id })
      .in('id', commissions.map(c => c.id));

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'admin_action',
      admin_id: null,
      entity_type: 'payout_batch',
      entity_id: batch.id,
      details: {
        action: 'auto_batch_created',
        batch_type: batchType,
        total_amount: totalAmount.toFixed(6),
        commission_count: commissions.length,
        valid_payouts: validPayouts,
      },
    });

    return batch;
  } catch (error) {
    console.error('[CreatePayoutBatches] createBatch error:', error);
    return null;
  }
}
