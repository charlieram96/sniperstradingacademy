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

    console.log(`[CheckGasTank] Gas Tank Balance: ${status.maticBalance} MATIC (~$${status.maticBalanceUSD})`);

    // Also check payout wallet USDC balance
    const payoutStatusResponse = await gasManager.getPayoutWalletStatus();
    let payoutWalletStatus = null;
    const alerts: Array<{ type: string; urgency: string; message: string }> = [];

    // Add gas tank alert if needed
    if (status.lowBalanceWarning || status.criticalBalanceAlert) {
      alerts.push({
        type: 'gas_tank',
        urgency: status.criticalBalanceAlert ? 'critical' : 'warning',
        message: status.criticalBalanceAlert
          ? 'CRITICAL: Gas tank balance critically low. Immediate refill required.'
          : 'WARNING: Gas tank balance is low. Please refill soon.',
      });
    }

    if (payoutStatusResponse.success && payoutStatusResponse.data) {
      const payoutStatus = payoutStatusResponse.data;
      payoutWalletStatus = {
        address: payoutStatus.address,
        usdcBalance: payoutStatus.usdcBalance,
        maticBalance: payoutStatus.maticBalance,
        lowBalanceWarning: payoutStatus.lowBalanceWarning,
        criticalBalanceAlert: payoutStatus.criticalBalanceAlert,
      };

      // Send alert if low
      if (payoutStatus.lowBalanceWarning || payoutStatus.criticalBalanceAlert) {
        await gasManager.sendLowPayoutWalletAlert(supabase, payoutStatus);
        alerts.push({
          type: 'payout_wallet',
          urgency: payoutStatus.criticalBalanceAlert ? 'critical' : 'warning',
          message: payoutStatus.criticalBalanceAlert
            ? 'CRITICAL: Payout wallet USDC balance critically low. Transfer funds from treasury.'
            : 'WARNING: Payout wallet USDC balance is low. Please refill soon.',
        });
      }

      // Log payout wallet status
      await supabase.from('crypto_audit_log').insert({
        event_type: 'admin_action',
        admin_id: null,
        entity_type: 'payout_wallet',
        entity_id: null,
        details: {
          action: 'payout_wallet_check',
          usdc_balance: payoutStatus.usdcBalance,
          matic_balance: payoutStatus.maticBalance,
          low_warning: payoutStatus.lowBalanceWarning,
          critical_alert: payoutStatus.criticalBalanceAlert,
        },
      });

      console.log(`[CheckGasTank] Payout Wallet USDC Balance: ${payoutStatus.usdcBalance}`);
    }

    return NextResponse.json({
      success: true,
      gasTank: {
        address: status.address,
        balance: status.maticBalance,
        balanceUSD: status.maticBalanceUSD,
        lowBalanceWarning: status.lowBalanceWarning,
        criticalBalanceAlert: status.criticalBalanceAlert,
        estimatedTransactionsRemaining: status.estimatedTransactionsRemaining,
      },
      payoutWallet: payoutWalletStatus,
      alerts: alerts.length > 0 ? alerts : null,
    });
  } catch (error: unknown) {
    console.error('[CheckGasTank] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
