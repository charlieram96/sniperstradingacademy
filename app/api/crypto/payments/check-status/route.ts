import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';
import { PAYMENT_AMOUNTS } from '@/lib/coinbase/wallet-types';
import { getUserPaymentSchedule } from '@/lib/treasury/treasury-service';

export const runtime = 'nodejs';

/**
 * GET /api/crypto/payments/check-status
 * Check payment status using user's permanent deposit address
 * No intentId needed - uses user's permanent address
 */
export async function GET() {
  try {
    const supabase = await createClient();

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

    // Get user data
    const { data: userData, error: userDataError } = await serviceSupabase
      .from('users')
      .select(`
        initial_payment_completed,
        bypass_initial_payment,
        crypto_deposit_address,
        is_active
      `)
      .eq('id', user.id)
      .single();

    if (userDataError) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    // If user doesn't have a deposit address yet, return early
    if (!userData.crypto_deposit_address) {
      return NextResponse.json({
        success: true,
        status: 'no_address',
        depositAddress: null,
        walletBalance: '0',
        requiredAmount: null,
        fundsDetected: false,
        message: 'No deposit address assigned yet',
      });
    }

    // Determine what the user needs to pay
    const needsInitialPayment = !userData.initial_payment_completed && !userData.bypass_initial_payment;

    let paymentType: 'initial_unlock' | 'subscription';
    let requiredAmount: string;

    if (needsInitialPayment) {
      paymentType = 'initial_unlock';
      requiredAmount = PAYMENT_AMOUNTS.INITIAL_UNLOCK;
    } else {
      // Users can always pay subscription regardless of active status
      paymentType = 'subscription';
      const schedule = await getUserPaymentSchedule(user.id);
      requiredAmount = schedule === 'weekly'
        ? PAYMENT_AMOUNTS.WEEKLY_SUBSCRIPTION
        : PAYMENT_AMOUNTS.MONTHLY_SUBSCRIPTION;
    }

    // Check wallet balance
    const balanceResponse = await polygonUSDCClient.getBalance(userData.crypto_deposit_address);

    if (!balanceResponse.success || !balanceResponse.data) {
      console.error('[CheckStatus] Failed to check balance:', balanceResponse.error);
      return NextResponse.json({
        success: true,
        status: 'awaiting_payment',
        depositAddress: userData.crypto_deposit_address,
        walletBalance: '0',
        requiredAmount,
        fundsDetected: false,
        paymentType,
        error: 'Could not check wallet balance',
      });
    }

    const currentBalance = parseFloat(balanceResponse.data.balance);
    const requiredAmountNum = parseFloat(requiredAmount);

    // Get total already-processed deposits to avoid counting old payments as new
    // This prevents the issue where stale funds trigger "funds detected" for new billing periods
    const { data: processedDeposits } = await serviceSupabase
      .from('usdc_transactions')
      .select('amount')
      .eq('to_address', userData.crypto_deposit_address)
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .eq('transaction_type', 'deposit');

    const totalProcessed = processedDeposits?.reduce(
      (sum, tx) => sum + parseFloat(tx.amount || '0'),
      0
    ) || 0;

    // Calculate unprocessed funds (new deposits not yet credited)
    const unprocessedFunds = Math.max(0, currentBalance - totalProcessed);

    // Check if sufficient NEW funds detected (with 1% tolerance)
    const fundsDetected = requiredAmountNum > 0 && unprocessedFunds >= (requiredAmountNum * 0.99);

    // Determine status based on unprocessed funds
    let status: string;
    if (fundsDetected) {
      status = 'funds_detected';
    } else if (unprocessedFunds > 0 && unprocessedFunds < requiredAmountNum) {
      status = 'partial_payment';
    } else {
      status = 'awaiting_payment';
    }

    return NextResponse.json({
      success: true,
      status,
      depositAddress: userData.crypto_deposit_address,
      walletBalance: balanceResponse.data.balance,
      requiredAmount,
      fundsDetected,
      paymentType,
      // Show unprocessed amount for partial payments, not total balance
      partialAmount: unprocessedFunds > 0 && unprocessedFunds < requiredAmountNum
        ? unprocessedFunds.toFixed(2)
        : null,
      shortfall: unprocessedFunds > 0 && unprocessedFunds < requiredAmountNum
        ? (requiredAmountNum - unprocessedFunds).toFixed(2)
        : null,
      // Include debug info
      totalProcessed: totalProcessed.toFixed(2),
      unprocessedFunds: unprocessedFunds.toFixed(2),
    });
  } catch (error: unknown) {
    console.error('[CheckStatus] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
