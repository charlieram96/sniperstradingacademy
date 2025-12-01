import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { gasManager } from '@/lib/polygon/gas-manager';

export const runtime = 'nodejs';

/**
 * GET /api/cron/check-gas-tank
 * Monitors gas tank balance and sends alerts if low
 * Vercel Cron: "0 * * * *" (every hour)
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-gas-tank",
 *     "schedule": "0 * * * *"
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

    // Check gas tank status
    const statusResponse = await gasManager.getGasTankStatus();

    if (!statusResponse.success || !statusResponse.data) {
      return NextResponse.json({
        success: false,
        error: 'Could not check gas tank status',
        details: statusResponse.error,
      }, { status: 500 });
    }

    const status = statusResponse.data;

    // Send alert if low
    if (status.lowBalanceWarning || status.criticalBalanceAlert) {
      await gasManager.sendLowBalanceAlert(supabase, status);
    }

    // Log status to database for historical tracking
    await supabase.from('crypto_audit_log').insert({
      event_type: 'admin_action',
      admin_id: null,
      entity_type: 'gas_tank',
      entity_id: null,
      details: {
        action: 'gas_tank_check',
        balance: status.maticBalance,
        balance_usd: status.maticBalanceUSD,
        low_warning: status.lowBalanceWarning,
        critical_alert: status.criticalBalanceAlert,
        estimated_remaining_txs: status.estimatedTransactionsRemaining,
      },
    });

    console.log(`[CheckGasTank] Balance: ${status.maticBalance} MATIC (~$${status.maticBalanceUSD})`);

    return NextResponse.json({
      success: true,
      status: {
        address: status.address,
        balance: status.maticBalance,
        balanceUSD: status.maticBalanceUSD,
        lowBalanceWarning: status.lowBalanceWarning,
        criticalBalanceAlert: status.criticalBalanceAlert,
        estimatedTransactionsRemaining: status.estimatedTransactionsRemaining,
      },
      alert: status.lowBalanceWarning || status.criticalBalanceAlert
        ? {
          urgency: status.criticalBalanceAlert ? 'critical' : 'warning',
          message: status.criticalBalanceAlert
            ? 'CRITICAL: Gas tank balance critically low. Immediate refill required.'
            : 'WARNING: Gas tank balance is low. Please refill soon.',
        }
        : null,
    });
  } catch (error: unknown) {
    console.error('[CheckGasTank] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
