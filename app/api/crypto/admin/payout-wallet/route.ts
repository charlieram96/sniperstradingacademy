import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { coinbaseWalletService } from '@/lib/coinbase/wallet-service';
import { gasManager, PAYOUT_WALLET_THRESHOLDS } from '@/lib/polygon/gas-manager';

export const runtime = 'nodejs';

/**
 * GET /api/crypto/admin/payout-wallet
 * Get payout wallet status (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!['admin', 'superadmin', 'superadmin+'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get payout wallet status
    const statusResult = await gasManager.getPayoutWalletStatus();

    if (!statusResult.success || !statusResult.data) {
      return NextResponse.json({
        success: false,
        error: statusResult.error?.message || 'Could not fetch payout wallet status',
      }, { status: 500 });
    }

    const status = statusResult.data;

    // Also get gas tank (MATIC) status
    const gasStatus = await gasManager.getGasTankStatus();

    return NextResponse.json({
      success: true,
      payoutWallet: {
        address: status.address,
        usdcBalance: status.usdcBalance,
        maticBalance: status.maticBalance,
        lowBalanceWarning: status.lowBalanceWarning,
        criticalBalanceAlert: status.criticalBalanceAlert,
        lastChecked: status.lastChecked,
        isConfigured: coinbaseWalletService.isPayoutWalletConfigured(),
        usingTreasuryFallback: !coinbaseWalletService.isPayoutWalletConfigured(),
      },
      gasTank: gasStatus.success ? gasStatus.data : null,
      thresholds: {
        lowBalanceWarning: PAYOUT_WALLET_THRESHOLDS.LOW_BALANCE_WARNING,
        criticalBalance: PAYOUT_WALLET_THRESHOLDS.CRITICAL_BALANCE_ALERT,
      },
    });
  } catch (error: unknown) {
    console.error('[PayoutWalletAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
