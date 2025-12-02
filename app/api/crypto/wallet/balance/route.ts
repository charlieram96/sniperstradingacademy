import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { coinbaseWalletService } from '@/lib/coinbase/wallet-service';

export const runtime = 'nodejs';

/**
 * GET /api/crypto/wallet/balance
 * Returns user's wallet info and USDC balance
 * Auto-creates wallet if user doesn't have one
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Check if user has a wallet
    let wallet = await coinbaseWalletService.getWalletByUserId(user.id, serviceSupabase);

    // If no wallet, auto-create one
    if (!wallet.success || !wallet.data) {
      console.log(`[WalletBalance] Auto-creating wallet for user ${user.id}`);

      const createResult = await coinbaseWalletService.ensureWalletForUser(user.id, serviceSupabase);

      if (!createResult.success || !createResult.data) {
        return NextResponse.json({
          success: false,
          error: 'Failed to create wallet',
          details: createResult.error?.message,
        }, { status: 500 });
      }

      wallet = createResult;
      console.log(`[WalletBalance] Wallet created for user ${user.id}: ${wallet.data.wallet_address}`);
    }

    const walletData = wallet.data;

    // Get balance from blockchain
    const balanceResult = await coinbaseWalletService.getWalletBalance(walletData.wallet_address);

    if (!balanceResult.success || !balanceResult.data) {
      // Return wallet info even if balance fetch fails
      return NextResponse.json({
        success: true,
        wallet: {
          id: walletData.id,
          address: walletData.wallet_address,
          network: walletData.network,
          status: walletData.status,
          createdAt: walletData.created_at,
        },
        balance: {
          usdc: '0.00',
          matic: '0.00',
          error: 'Failed to fetch balance',
        },
      });
    }

    // Get recent transactions for mini history
    const { data: recentTransactions } = await serviceSupabase
      .from('usdc_transactions')
      .select('id, transaction_type, amount, status, created_at, polygon_tx_hash')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      wallet: {
        id: walletData.id,
        address: walletData.wallet_address,
        network: walletData.network,
        status: walletData.status,
        createdAt: walletData.created_at,
        isExported: walletData.is_exported,
      },
      balance: {
        usdc: balanceResult.data.usdc,
        matic: balanceResult.data.matic,
        lastUpdated: balanceResult.data.lastUpdated,
      },
      recentTransactions: recentTransactions || [],
    });
  } catch (error: unknown) {
    console.error('[WalletBalance] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
