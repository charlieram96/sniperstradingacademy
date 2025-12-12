import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTreasurySettings } from '@/lib/treasury/treasury-service';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';

export const runtime = 'nodejs';

/**
 * GET /api/crypto/admin/treasury-wallet
 * Get treasury wallet balance status (admin only)
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

    // Get treasury settings
    const settings = await getTreasurySettings();

    if (!settings?.treasuryWalletAddress) {
      return NextResponse.json({
        success: false,
        error: 'Treasury wallet address not configured',
      }, { status: 400 });
    }

    // Fetch balances from blockchain
    const [usdcResponse, maticResponse] = await Promise.all([
      polygonUSDCClient.getBalance(settings.treasuryWalletAddress),
      polygonUSDCClient.getMATICBalance(settings.treasuryWalletAddress),
    ]);

    if (!usdcResponse.success || !usdcResponse.data) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch USDC balance',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      treasuryWallet: {
        address: settings.treasuryWalletAddress,
        usdcBalance: usdcResponse.data.balance,
        maticBalance: maticResponse.success ? maticResponse.data : '0',
        lastChecked: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('[TreasuryWalletAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
