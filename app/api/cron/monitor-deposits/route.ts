/**
 * Deposit Monitoring Cron Job
 * Backup to Alchemy webhooks - checks permanent user deposit addresses for USDC
 * Uses user's status to determine payment type (initial unlock vs subscription)
 *
 * Run frequency: Every 1-5 minutes via Vercel cron
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  getUserPaymentSchedule,
  weiToUsdc,
} from '@/lib/treasury/treasury-service';
import { getUsdcBalance, findDepositTransactionHash } from '@/lib/polygon/event-scanner';
import { PAYMENT_AMOUNTS } from '@/lib/coinbase/wallet-types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Maximum users to process per run (for scaling)
const MAX_USERS_PER_RUN = 100;

interface MonitorResults {
  processed: number;
  detected: number;
  underpaid: number;
  overpaid: number;
  errors: string[];
}

/**
 * GET /api/cron/monitor-deposits
 * Check deposit addresses for users who need to make payments
 * Protected by CRON_SECRET
 */
export async function GET(req: NextRequest) {
  return runMonitor(req);
}

/**
 * POST /api/cron/monitor-deposits
 * Same as GET but for manual triggers
 */
export async function POST(req: NextRequest) {
  return runMonitor(req);
}

async function runMonitor(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[MonitorDeposits] Unauthorized cron attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();
    const results: MonitorResults = {
      processed: 0,
      detected: 0,
      underpaid: 0,
      overpaid: 0,
      errors: [],
    };

    console.log('[MonitorDeposits] Starting deposit monitoring run...');

    // Get users who have deposit addresses and need to make a payment
    // Either: needs initial payment OR is not active (needs subscription)
    const { data: usersNeedingPayment, error: queryError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        crypto_deposit_address,
        crypto_derivation_index,
        initial_payment_completed,
        bypass_initial_payment,
        is_active
      `)
      .not('crypto_deposit_address', 'is', null)
      .or('initial_payment_completed.eq.false,is_active.eq.false')
      .limit(MAX_USERS_PER_RUN);

    if (queryError) {
      console.error('[MonitorDeposits] Failed to fetch users:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Filter out users with bypass_initial_payment who have completed initial
    const usersToCheck = usersNeedingPayment.filter(user => {
      // Needs initial payment
      const needsInitial = !user.initial_payment_completed && !user.bypass_initial_payment;
      // Or needs subscription (completed initial but not active)
      const needsSubscription = (user.initial_payment_completed || user.bypass_initial_payment) && !user.is_active;
      return needsInitial || needsSubscription;
    });

    if (usersToCheck.length === 0) {
      console.log('[MonitorDeposits] No users with pending payments');
      return NextResponse.json({
        success: true,
        message: 'No users with pending payments',
        results,
      });
    }

    console.log(`[MonitorDeposits] Checking ${usersToCheck.length} user(s) with pending payments`);

    // Process each user
    for (const user of usersToCheck) {
      results.processed++;

      try {
        await checkUserDeposit(supabase, user, results);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[MonitorDeposits] Error checking user ${user.id}:`, error);
        results.errors.push(`User ${user.id}: ${errorMsg}`);
      }
    }

    console.log(`[MonitorDeposits] Run complete. Processed: ${results.processed}, Detected: ${results.detected}, Underpaid: ${results.underpaid}, Overpaid: ${results.overpaid}`);

    return NextResponse.json({
      success: true,
      message: 'Deposit monitoring complete',
      results,
    });
  } catch (error) {
    console.error('[MonitorDeposits] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check a single user's deposit address for payments
 */
async function checkUserDeposit(
  supabase: ReturnType<typeof createServiceRoleClient>,
  user: {
    id: string;
    email: string;
    crypto_deposit_address: string;
    crypto_derivation_index: number;
    initial_payment_completed: boolean;
    bypass_initial_payment: boolean;
    is_active: boolean;
  },
  results: MonitorResults
) {
  const depositAddress = user.crypto_deposit_address;

  // Determine what payment this user owes
  const needsInitialPayment = !user.initial_payment_completed && !user.bypass_initial_payment;

  let paymentType: 'initial_unlock' | 'subscription';
  let expectedAmountUsdc: number;

  if (needsInitialPayment) {
    paymentType = 'initial_unlock';
    expectedAmountUsdc = parseFloat(PAYMENT_AMOUNTS.INITIAL_UNLOCK);
  } else {
    paymentType = 'subscription';
    const schedule = await getUserPaymentSchedule(user.id);
    expectedAmountUsdc = schedule === 'weekly'
      ? parseFloat(PAYMENT_AMOUNTS.WEEKLY_SUBSCRIPTION)
      : parseFloat(PAYMENT_AMOUNTS.MONTHLY_SUBSCRIPTION);
  }

  // Get current balance
  const currentBalanceWei = await getUsdcBalance(depositAddress);
  const currentBalanceUsdc = weiToUsdc(Number(currentBalanceWei));

  // Skip if no funds received yet
  if (currentBalanceUsdc === 0) {
    return;
  }

  // Check for duplicate - see if we already processed this
  const { data: existingTx } = await supabase
    .from('usdc_transactions')
    .select('id')
    .eq('to_address', depositAddress)
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existingTx) {
    // Check if balance changed since last transaction
    const { data: lastTx } = await supabase
      .from('usdc_transactions')
      .select('amount')
      .eq('id', existingTx.id)
      .single();

    if (lastTx && parseFloat(lastTx.amount) >= currentBalanceUsdc * 0.99) {
      // Balance hasn't increased significantly, already processed
      return;
    }
  }

  const tolerance = expectedAmountUsdc * 0.01; // 1% tolerance

  console.log(`[MonitorDeposits] User ${user.id}: balance ${currentBalanceUsdc} USDC, expects ${expectedAmountUsdc} USDC (${paymentType})`);

  // CASE 1: UNDERPAYMENT - Partial funds but not enough
  if (currentBalanceUsdc > 0 && currentBalanceUsdc < (expectedAmountUsdc - tolerance)) {
    console.log(`[MonitorDeposits] Underpayment for ${user.id}: ${currentBalanceUsdc} USDC (expected: ${expectedAmountUsdc})`);
    results.underpaid++;

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'deposit_underpaid_cron',
      user_id: user.id,
      entity_type: 'user',
      entity_id: user.id,
      details: {
        source: 'monitor_cron',
        deposit_address: depositAddress,
        expected_usdc: expectedAmountUsdc,
        received_usdc: currentBalanceUsdc,
        shortfall_usdc: expectedAmountUsdc - currentBalanceUsdc,
        payment_type: paymentType,
      },
    });

    return;
  }

  // CASE 2: SUFFICIENT FUNDS (possibly overpaid)
  if (currentBalanceUsdc >= (expectedAmountUsdc - tolerance)) {
    console.log(`[MonitorDeposits] Payment detected for user ${user.id}: ${currentBalanceUsdc} USDC`);
    results.detected++;

    const isOverpaid = currentBalanceUsdc > (expectedAmountUsdc + tolerance);
    const overpaymentAmount = isOverpaid ? currentBalanceUsdc - expectedAmountUsdc : 0;

    if (isOverpaid) {
      results.overpaid++;
    }

    // Find transaction hash
    let txHash = '';
    try {
      const txEvent = await findDepositTransactionHash(depositAddress);
      if (txEvent) {
        txHash = txEvent.txHash;
      }
    } catch (err) {
      console.error('[MonitorDeposits] Failed to find tx hash:', err);
    }

    // Create USDC transaction record
    const { data: txRecord } = await supabase
      .from('usdc_transactions')
      .insert({
        transaction_type: 'deposit',
        from_address: 'external',
        to_address: depositAddress,
        amount: currentBalanceUsdc.toFixed(2),
        user_id: user.id,
        status: 'confirmed',
        polygon_tx_hash: txHash,
        confirmed_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'deposit_detected_cron',
      user_id: user.id,
      entity_type: 'user',
      entity_id: user.id,
      details: {
        source: 'monitor_cron',
        deposit_address: depositAddress,
        tx_hash: txHash,
        expected_usdc: expectedAmountUsdc,
        received_usdc: currentBalanceUsdc,
        is_overpaid: isOverpaid,
        overpayment_amount: overpaymentAmount,
        payment_type: paymentType,
      },
    });

    // Process the payment
    if (paymentType === 'initial_unlock') {
      await processInitialUnlock(supabase, user.id, currentBalanceUsdc.toFixed(2), txRecord?.id);
    } else {
      const schedule = await getUserPaymentSchedule(user.id);
      const isMonthly = schedule === 'monthly';
      await processSubscriptionPayment(supabase, user.id, currentBalanceUsdc.toFixed(2), isMonthly, txRecord?.id);
    }

    // Handle overpayment credit
    if (isOverpaid && overpaymentAmount > 0) {
      await supabase
        .from('commissions')
        .insert({
          referrer_id: user.id,
          referred_id: user.id,
          commission_type: 'overpayment_credit',
          amount: overpaymentAmount,
          net_amount_usdc: overpaymentAmount,
          status: 'pending',
          description: `Overpayment credit from ${paymentType} payment (via cron)`,
        });

      console.log(`[MonitorDeposits] Created overpayment credit of $${overpaymentAmount.toFixed(2)}`);
    }

    console.log(`[MonitorDeposits] Payment processed for user ${user.id}, type: ${paymentType}`);
  }
}

/**
 * Process initial unlock payment
 */
async function processInitialUnlock(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  amountUsdc: string,
  usdcTxId?: string
) {
  // Assign network position
  await supabase.rpc('assign_network_position', { p_user_id: userId });

  // Update user membership
  await supabase
    .from('users')
    .update({
      membership_status: 'unlocked',
      is_active: true,
      initial_payment_completed: true,
      initial_payment_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // Increment active count for upline
  await supabase.rpc('increment_upchain_active_count', { p_user_id: userId });

  // Create payment record
  const { data: paymentRecord } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      amount: amountUsdc,
      payment_type: 'initial',
      status: 'succeeded',
      usdc_transaction_id: usdcTxId,
    })
    .select()
    .single();

  if (paymentRecord && usdcTxId) {
    await supabase
      .from('usdc_transactions')
      .update({ related_payment_id: paymentRecord.id })
      .eq('id', usdcTxId);
  }

  // Update referral status
  await supabase
    .from('referrals')
    .update({ status: 'active' })
    .eq('referred_id', userId);

  // Create direct bonus commission
  const { data: referral } = await supabase
    .from('referrals')
    .select('referrer_id')
    .eq('referred_id', userId)
    .single();

  if (referral?.referrer_id) {
    const directBonusAmount = parseFloat(PAYMENT_AMOUNTS.DIRECT_BONUS);

    await supabase
      .from('commissions')
      .insert({
        referrer_id: referral.referrer_id,
        referred_id: userId,
        commission_type: 'direct_bonus',
        amount: directBonusAmount,
        status: 'pending',
      });

    console.log(`[MonitorDeposits] Created direct bonus of $${directBonusAmount} for referrer ${referral.referrer_id}`);
  }

  console.log(`[MonitorDeposits] Initial unlock completed for user ${userId}`);
}

/**
 * Process subscription payment
 */
async function processSubscriptionPayment(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  amountUsdc: string,
  isMonthly: boolean,
  usdcTxId?: string
) {
  // Calculate next period end
  const daysToAdd = isMonthly ? 30 : 7;
  const nextPeriodEnd = new Date();
  nextPeriodEnd.setDate(nextPeriodEnd.getDate() + daysToAdd);

  // Update user active status and last payment date
  await supabase
    .from('users')
    .update({
      is_active: true,
      last_payment_date: new Date().toISOString(),
      payment_schedule: isMonthly ? 'monthly' : 'weekly',
    })
    .eq('id', userId);

  // Update or create subscription record
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (existingSub) {
    await supabase
      .from('subscriptions')
      .update({
        current_period_end: nextPeriodEnd.toISOString(),
        amount: parseFloat(amountUsdc),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSub.id);
  } else {
    await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        status: 'active',
        amount: parseFloat(amountUsdc),
        current_period_end: nextPeriodEnd.toISOString(),
      });
  }

  // Create payment record
  const { data: paymentRecord } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      amount: amountUsdc,
      payment_type: isMonthly ? 'monthly' : 'weekly',
      status: 'succeeded',
      usdc_transaction_id: usdcTxId,
    })
    .select()
    .single();

  if (paymentRecord && usdcTxId) {
    await supabase
      .from('usdc_transactions')
      .update({ related_payment_id: paymentRecord.id })
      .eq('id', usdcTxId);
  }

  // Distribute to upline
  await supabase.rpc('distribute_to_upline_batch', {
    p_user_id: userId,
    p_payment_amount: amountUsdc,
  });

  console.log(`[MonitorDeposits] Subscription payment completed for user ${userId}`);
}
