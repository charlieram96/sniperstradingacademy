/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { coinbaseWalletService } from '@/lib/coinbase/wallet-service';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';
import { gasManager } from '@/lib/polygon/gas-manager';
import { checkRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit';
import { WITHDRAWAL_LIMITS } from '@/lib/coinbase/wallet-types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/crypto/withdrawals
 * Withdraw USDC to an external wallet
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit check
    const rateLimitResponse = await checkRateLimit(req, RATE_LIMITS.wallet);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { externalAddress, amount, label } = body;

    // Validate inputs
    if (!externalAddress || !/^0x[a-fA-F0-9]{40}$/.test(externalAddress)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid external wallet address',
      }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid amount',
      }, { status: 400 });
    }

    // Check withdrawal limits
    const minWithdrawal = parseFloat(WITHDRAWAL_LIMITS.MINIMUM_WITHDRAWAL);
    const maxSingle = parseFloat(WITHDRAWAL_LIMITS.SINGLE_TX_MAX_USDC);

    if (amountNum < minWithdrawal) {
      return NextResponse.json({
        success: false,
        error: `Minimum withdrawal is $${minWithdrawal} USDC`,
      }, { status: 400 });
    }

    if (amountNum > maxSingle) {
      return NextResponse.json({
        success: false,
        error: `Maximum single withdrawal is $${maxSingle} USDC`,
      }, { status: 400 });
    }

    // Check daily withdrawal limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayWithdrawals } = await supabase
      .from('usdc_transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('transaction_type', 'withdrawal')
      .gte('created_at', today.toISOString());

    const todayTotal = (todayWithdrawals || []).reduce(
      (sum, w) => sum + parseFloat(w.amount),
      0
    );

    const dailyMax = parseFloat(WITHDRAWAL_LIMITS.DAILY_MAX_USDC);
    if (todayTotal + amountNum > dailyMax) {
      return NextResponse.json({
        success: false,
        error: `Daily withdrawal limit is $${dailyMax} USDC. You've withdrawn $${todayTotal.toFixed(2)} today.`,
      }, { status: 400 });
    }

    // Get user's wallet
    const walletResponse = await coinbaseWalletService.getWalletByUserId(user.id, supabase);

    if (!walletResponse.success || !walletResponse.data) {
      return NextResponse.json({
        success: false,
        error: 'No active wallet found',
      }, { status: 400 });
    }

    const userWallet = walletResponse.data;

    // Check balance
    const balanceResponse = await polygonUSDCClient.getBalance(userWallet.wallet_address);

    if (!balanceResponse.success || !balanceResponse.data) {
      return NextResponse.json({
        success: false,
        error: 'Could not verify wallet balance',
      }, { status: 500 });
    }

    const currentBalance = parseFloat(balanceResponse.data.balance);

    if (currentBalance < amountNum) {
      return NextResponse.json({
        success: false,
        error: `Insufficient balance. Available: ${currentBalance.toFixed(6)} USDC`,
      }, { status: 400 });
    }

    // Save or update external wallet address
    const { data: existingAddress } = await supabase
      .from('external_wallet_addresses')
      .select('id')
      .eq('user_id', user.id)
      .eq('wallet_address', externalAddress)
      .single();

    if (!existingAddress) {
      // Create new external address record
      await supabase
        .from('external_wallet_addresses')
        .insert({
          user_id: user.id,
          wallet_address: externalAddress,
          wallet_label: label || null,
          network: 'polygon',
          is_verified: false, // Could add email verification
          status: 'active',
        });
    }

    // Execute withdrawal transfer
    let transferResult;

    if (userWallet.wallet_data_encrypted) {
      // Use Coinbase SDK for custodial wallet
      transferResult = await coinbaseWalletService.transferUSDC({
        fromWalletId: userWallet.coinbase_wallet_id,
        toAddress: externalAddress,
        amount: amount,
        memo: `Withdrawal to ${label || externalAddress.slice(0, 10)}...`,
        walletData: userWallet.wallet_data_encrypted,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Wallet not properly configured for withdrawals',
      }, { status: 500 });
    }

    if (!transferResult.success || !transferResult.data) {
      console.error('[Withdrawal] Transfer failed:', transferResult.error);
      return NextResponse.json({
        success: false,
        error: 'Withdrawal failed',
        details: transferResult.error?.message,
      }, { status: 500 });
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('usdc_transactions')
      .insert({
        transaction_type: 'withdrawal',
        from_address: userWallet.wallet_address,
        to_address: externalAddress,
        amount: amount,
        polygon_tx_hash: transferResult.data.transactionHash,
        block_number: transferResult.data.blockNumber || null,
        status: transferResult.data.status,
        gas_fee_matic: transferResult.data.gasUsed || null,
        user_id: user.id,
        confirmed_at: transferResult.data.status === 'confirmed' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    // Update external address usage stats
    // Note: Using simple update since atomic increment requires RPC function
    await supabase
      .from('external_wallet_addresses')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('wallet_address', externalAddress);

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'withdrawal_completed',
      user_id: user.id,
      entity_type: 'transaction',
      entity_id: transaction?.id,
      details: {
        amount,
        to_address: externalAddress,
        tx_hash: transferResult.data.transactionHash,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    });

    console.log(`[Withdrawal] User ${user.id} withdrew ${amount} USDC to ${externalAddress}`);

    return NextResponse.json({
      success: true,
      message: 'Withdrawal successful',
      transaction: {
        id: transaction?.id,
        txHash: transferResult.data.transactionHash,
        amount,
        to: externalAddress,
        status: transferResult.data.status,
        explorerUrl: polygonUSDCClient.getExplorerUrl(transferResult.data.transactionHash),
      },
    });
  } catch (error: any) {
    console.error('[Withdrawal] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crypto/withdrawals
 * Get user's withdrawal history and external addresses
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get withdrawal history
    const { data: withdrawals, error: withdrawalError } = await supabase
      .from('usdc_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('transaction_type', 'withdrawal')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Get saved external addresses
    const { data: savedAddresses } = await supabase
      .from('external_wallet_addresses')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_used_at', { ascending: false, nullsFirst: false });

    // Get today's withdrawal total
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayWithdrawals } = await supabase
      .from('usdc_transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('transaction_type', 'withdrawal')
      .gte('created_at', today.toISOString());

    const todayTotal = (todayWithdrawals || []).reduce(
      (sum, w) => sum + parseFloat(w.amount),
      0
    );

    const dailyMax = parseFloat(WITHDRAWAL_LIMITS.DAILY_MAX_USDC);
    const dailyRemaining = Math.max(0, dailyMax - todayTotal);

    return NextResponse.json({
      success: true,
      withdrawals: withdrawals || [],
      savedAddresses: savedAddresses || [],
      limits: {
        minimum: WITHDRAWAL_LIMITS.MINIMUM_WITHDRAWAL,
        singleMax: WITHDRAWAL_LIMITS.SINGLE_TX_MAX_USDC,
        dailyMax: WITHDRAWAL_LIMITS.DAILY_MAX_USDC,
        todayUsed: todayTotal.toFixed(2),
        dailyRemaining: dailyRemaining.toFixed(2),
      },
    });
  } catch (error: any) {
    console.error('[Withdrawal GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
