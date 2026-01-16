import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';
import { PAYMENT_AMOUNTS } from '@/lib/coinbase/wallet-types';

export const runtime = 'nodejs';

/**
 * GET /api/crypto/payments/check-status
 * Check payment status using period-based logic
 * Sums transactions since previous_payment_due_date to determine if period is paid
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

    // Get user data including period fields
    const { data: userData, error: userDataError } = await serviceSupabase
      .from('users')
      .select(`
        initial_payment_completed,
        bypass_initial_payment,
        crypto_deposit_address,
        is_active,
        payment_schedule,
        previous_payment_due_date,
        next_payment_due_date,
        paid_for_period,
        last_payment_date
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
    const isWeekly = userData.payment_schedule === 'weekly';

    let paymentType: 'initial_unlock' | 'subscription';
    let requiredAmount: string;

    if (needsInitialPayment) {
      paymentType = 'initial_unlock';
      requiredAmount = PAYMENT_AMOUNTS.INITIAL_UNLOCK;
    } else {
      paymentType = 'subscription';
      requiredAmount = isWeekly
        ? PAYMENT_AMOUNTS.WEEKLY_SUBSCRIPTION
        : PAYMENT_AMOUNTS.MONTHLY_SUBSCRIPTION;
    }

    const requiredAmountNum = parseFloat(requiredAmount);
    const tolerance = requiredAmountNum * 0.01; // 1% tolerance

    // PERIOD-BASED LOGIC: Sum transactions since previous_payment_due_date
    const periodStart = userData.previous_payment_due_date || '1970-01-01';

    const { data: periodTxs } = await serviceSupabase
      .from('usdc_transactions')
      .select('amount, created_at')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .eq('transaction_type', 'deposit')
      .gt('created_at', periodStart);

    const paidThisPeriod = periodTxs?.reduce(
      (sum, tx) => sum + parseFloat(tx.amount || '0'),
      0
    ) || 0;

    const remaining = requiredAmountNum - paidThisPeriod;

    // Check period status based on due dates
    const now = new Date();
    const previousDueDate = userData.previous_payment_due_date
      ? new Date(userData.previous_payment_due_date)
      : null;
    const nextDueDate = userData.next_payment_due_date
      ? new Date(userData.next_payment_due_date)
      : null;

    // PAYMENT BLOCKING LOGIC:
    // Block ONLY if BOTH conditions are true:
    // 1. Payment exists in the last 7 days (weekly) / 30 days (monthly)
    // 2. AND now < previous_payment_due_date (payment window not open yet)
    const lastPaymentDate = userData.last_payment_date
      ? new Date(userData.last_payment_date)
      : null;
    const daysSinceLastPayment = lastPaymentDate
      ? (now.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;
    const cooldownDays = isWeekly ? 7 : 30;
    const paidRecently = daysSinceLastPayment < cooldownDays;
    const beforeWindow = previousDueDate && now < previousDueDate;
    const paymentBlocked = paidRecently && beforeWindow;

    // Legacy variables for backwards compatibility
    const paidAhead = beforeWindow;
    const paymentAvailable = !paymentBlocked;
    const periodPaid = paymentBlocked;

    // Check wallet balance for unrecorded transactions
    const balanceResponse = await polygonUSDCClient.getBalance(userData.crypto_deposit_address);
    let currentBalance = 0;
    let unrecordedFunds = 0;

    if (balanceResponse.success && balanceResponse.data) {
      currentBalance = parseFloat(balanceResponse.data.balance);

      // Get all recorded deposits to calculate unrecorded funds
      const { data: allRecordedTxs } = await serviceSupabase
        .from('usdc_transactions')
        .select('amount')
        .eq('to_address', userData.crypto_deposit_address)
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .eq('transaction_type', 'deposit');

      const totalRecorded = allRecordedTxs?.reduce(
        (sum, tx) => sum + parseFloat(tx.amount || '0'),
        0
      ) || 0;

      unrecordedFunds = Math.max(0, currentBalance - totalRecorded);
    }

    // Determine status
    let status: string;

    // BLOCK payment only if: paid recently AND before payment window opens
    // This uses the new paymentBlocked variable calculated above
    if (!needsInitialPayment && paymentBlocked) {
      status = 'paid';
    } else if (remaining <= tolerance && paidThisPeriod > 0) {
      // Paid but due dates not updated yet (monitor-deposits will handle)
      status = 'funds_detected';
    } else if (paidThisPeriod + unrecordedFunds >= requiredAmountNum * 0.99) {
      // Enough funds if we include unrecorded
      status = 'funds_detected';
    } else if (paidThisPeriod > 0 || unrecordedFunds > 0) {
      status = 'partial_payment';
    } else {
      status = 'awaiting_payment';
    }

    return NextResponse.json({
      success: true,
      status,
      depositAddress: userData.crypto_deposit_address,
      walletBalance: balanceResponse.data?.balance || '0',
      requiredAmount,
      paymentType,
      // Period-based info
      paymentAvailable, // true if user can make a payment (not paid ahead)
      periodPaid, // true if NOW < previous_payment_due_date (paid ahead)
      paidAhead, // alias for periodPaid
      paidThisPeriod: paidThisPeriod.toFixed(2),
      remaining: Math.max(0, remaining).toFixed(2),
      nextDueDate: nextDueDate?.toISOString() || null,
      previousPaymentDueDate: userData.previous_payment_due_date,
      // For partial payments
      partialAmount: paidThisPeriod > 0 && remaining > tolerance
        ? paidThisPeriod.toFixed(2)
        : null,
      shortfall: remaining > tolerance
        ? Math.max(0, remaining - unrecordedFunds).toFixed(2)
        : null,
      // Unrecorded funds (not yet in DB)
      unrecordedFunds: unrecordedFunds.toFixed(2),
      // Legacy field for backwards compatibility
      fundsDetected: status === 'funds_detected',
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
