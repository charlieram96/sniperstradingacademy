/**
 * User Payout Wallet API
 * Allows users to set and view their personal payout wallet address
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Validate Ethereum address format
 */
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * GET /api/user/payout-wallet
 * Get user's current payout wallet configuration
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's payout wallet info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('payout_wallet_address, payout_wallet_set_at')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[PayoutWalletAPI] Failed to fetch user:', userError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    // Get pending commissions total
    const { data: commissions } = await supabase
      .from('commissions')
      .select('amount')
      .eq('referrer_id', user.id)
      .eq('status', 'pending');

    const pendingCommissionsTotal = commissions?.reduce(
      (sum, c) => sum + parseFloat(String(c.amount)),
      0
    ) || 0;

    const pendingCommissionsCount = commissions?.length || 0;

    return NextResponse.json({
      success: true,
      data: {
        payoutWalletAddress: userData.payout_wallet_address || null,
        payoutWalletSetAt: userData.payout_wallet_set_at || null,
        isConfigured: !!userData.payout_wallet_address,
        pendingCommissions: {
          total: pendingCommissionsTotal.toFixed(2),
          count: pendingCommissionsCount,
        },
      },
    });
  } catch (error) {
    console.error('[PayoutWalletAPI] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/payout-wallet
 * Set or update user's payout wallet address
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { walletAddress } = body;

    // Validate wallet address
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!isValidEthereumAddress(walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format. Must be a valid Polygon address (0x...)' },
        { status: 400 }
      );
    }

    // Use service role client to update user
    const serviceClient = createServiceRoleClient();

    // Update user's payout wallet
    const { error: updateError } = await serviceClient
      .from('users')
      .update({
        payout_wallet_address: walletAddress,
        payout_wallet_set_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[PayoutWalletAPI] Failed to update user:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update payout wallet' },
        { status: 500 }
      );
    }

    // Log audit event
    await serviceClient.from('crypto_audit_log').insert({
      event_type: 'payout_wallet_set',
      user_id: user.id,
      entity_type: 'user',
      entity_id: user.id,
      details: {
        wallet_address: walletAddress,
        action: 'set_payout_wallet',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payout wallet updated successfully',
      data: {
        payoutWalletAddress: walletAddress,
        payoutWalletSetAt: new Date().toISOString(),
        isConfigured: true,
      },
    });
  } catch (error) {
    console.error('[PayoutWalletAPI] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
