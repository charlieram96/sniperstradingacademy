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
  weiToUsdc,
  calculateNextDueDate,
  getInitialAnchorDate,
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

    // Get ALL users who have deposit addresses
    // We check for unprocessed funds regardless of active status
    // Users can (and should) pay BEFORE becoming inactive
    const { data: usersWithAddresses, error: queryError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        crypto_deposit_address,
        crypto_derivation_index,
        initial_payment_completed,
        bypass_initial_payment,
        is_active,
        payment_schedule,
        previous_payment_due_date,
        next_payment_due_date
      `)
      .not('crypto_deposit_address', 'is', null)
      .limit(MAX_USERS_PER_RUN);

    if (queryError) {
      console.error('[MonitorDeposits] Failed to fetch users:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    const usersToCheck = usersWithAddresses || [];

    if (usersToCheck.length === 0) {
      console.log('[MonitorDeposits] No users with deposit addresses');
      return NextResponse.json({
        success: true,
        message: 'No users with deposit addresses',
        results,
      });
    }

    console.log(`[MonitorDeposits] Checking ${usersToCheck.length} user(s) with deposit addresses`);

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
 * Uses period-based logic: sum transactions since previous_payment_due_date
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
    payment_schedule: string | null;
    previous_payment_due_date: string | null;
    next_payment_due_date: string | null;
  },
  results: MonitorResults
) {
  // Normalize address to lowercase for consistent comparison
  // (Alchemy webhooks send lowercase, user addresses may be checksum-cased)
  const depositAddress = user.crypto_deposit_address.toLowerCase();

  // Determine what payment this user owes
  const needsInitialPayment = !user.initial_payment_completed && !user.bypass_initial_payment;

  let paymentType: 'initial_unlock' | 'subscription';
  let expectedAmountUsdc: number;
  let detectedSchedule: 'weekly' | 'monthly' = 'monthly';

  const weeklyAmount = parseFloat(PAYMENT_AMOUNTS.WEEKLY_SUBSCRIPTION);
  const monthlyAmount = parseFloat(PAYMENT_AMOUNTS.MONTHLY_SUBSCRIPTION);

  if (needsInitialPayment) {
    paymentType = 'initial_unlock';
    expectedAmountUsdc = parseFloat(PAYMENT_AMOUNTS.INITIAL_UNLOCK);
  } else {
    paymentType = 'subscription';
    // We'll detect the schedule based on total paid this period later
    // For now, use user's existing schedule to determine expected amount
    const isWeekly = user.payment_schedule === 'weekly';
    expectedAmountUsdc = isWeekly ? weeklyAmount : monthlyAmount;
    detectedSchedule = isWeekly ? 'weekly' : 'monthly';
  }

  // PERIOD-BASED LOGIC: Sum transactions since previous_payment_due_date
  const periodStart = user.previous_payment_due_date || '1970-01-01';

  const { data: periodTxs } = await supabase
    .from('usdc_transactions')
    .select('amount, created_at')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .eq('transaction_type', 'deposit')
    .gt('created_at', periodStart);

  const paidThisPeriod = periodTxs?.reduce(
    (sum, tx) => sum + parseFloat(tx.amount),
    0
  ) || 0;

  const remaining = expectedAmountUsdc - paidThisPeriod;
  const tolerance = expectedAmountUsdc * 0.01; // 1% tolerance

  console.log(`[MonitorDeposits] User ${user.email}: paid ${paidThisPeriod.toFixed(2)} this period, needs ${expectedAmountUsdc}, remaining ${remaining.toFixed(2)} (${paymentType})`);

  // Skip if already paid for this period
  if (remaining <= tolerance) {
    // Check if we already updated their due dates
    if (user.next_payment_due_date && new Date(user.next_payment_due_date) > new Date()) {
      // Already processed for this period
      return;
    }

    // Period is paid but due dates not updated - this is a completed payment!
    console.log(`[MonitorDeposits] Payment complete for ${user.email}, updating due dates`);
    results.detected++;

    // Find the most recent transaction hash for logging
    let txHash = '';
    try {
      const txEvent = await findDepositTransactionHash(depositAddress);
      if (txEvent) {
        txHash = txEvent.txHash;
      }
    } catch (err) {
      console.error('[MonitorDeposits] Failed to find tx hash:', err);
    }

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
        paid_this_period: paidThisPeriod,
        payment_type: paymentType,
      },
    });

    // Process the payment
    // Use expectedAmountUsdc for distribution (not overpayment)
    if (paymentType === 'initial_unlock') {
      await processInitialUnlock(supabase, user.id, expectedAmountUsdc.toFixed(2));
    } else {
      // Detect schedule based on amount paid
      const weeklyDiff = Math.abs(paidThisPeriod - weeklyAmount);
      const monthlyDiff = Math.abs(paidThisPeriod - monthlyAmount);
      if (weeklyDiff < monthlyDiff && paidThisPeriod >= weeklyAmount * 0.99) {
        detectedSchedule = 'weekly';
        expectedAmountUsdc = weeklyAmount;
      } else {
        detectedSchedule = 'monthly';
        expectedAmountUsdc = monthlyAmount;
      }

      // Roll forward from current next_payment_due_date
      const currentNextDueDate = user.next_payment_due_date
        ? new Date(user.next_payment_due_date)
        : new Date(); // Fallback if not set
      const isMonthly = detectedSchedule === 'monthly';
      await processSubscriptionPayment(supabase, user.id, expectedAmountUsdc.toFixed(2), isMonthly, currentNextDueDate);
    }

    return;
  }

  // Check if there are any NEW unrecorded transactions on-chain
  // This catches new deposits that haven't been recorded in usdc_transactions yet
  const currentBalanceWei = await getUsdcBalance(depositAddress);
  const currentBalanceUsdc = weiToUsdc(Number(currentBalanceWei));

  if (currentBalanceUsdc === 0) {
    return;
  }

  // Sum all recorded deposits for this address (lifetime, for balance comparison)
  const { data: allRecordedTxs } = await supabase
    .from('usdc_transactions')
    .select('amount')
    .eq('to_address', depositAddress)
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .eq('transaction_type', 'deposit');

  const totalRecorded = allRecordedTxs?.reduce(
    (sum, tx) => sum + parseFloat(tx.amount),
    0
  ) || 0;

  const unrecordedFunds = currentBalanceUsdc - totalRecorded;

  // If there are unrecorded funds, record them as a new transaction
  if (unrecordedFunds >= 1) { // At least $1 unrecorded
    console.log(`[MonitorDeposits] Found ${unrecordedFunds.toFixed(2)} unrecorded USDC for ${user.email}`);

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

    // Record the new deposit - MUST succeed before processing payment
    const { error: txInsertError } = await supabase
      .from('usdc_transactions')
      .insert({
        transaction_type: 'deposit',
        from_address: 'external',
        to_address: depositAddress,
        amount: unrecordedFunds.toFixed(2),
        user_id: user.id,
        status: 'confirmed',
        polygon_tx_hash: txHash || `cron-${Date.now()}-${user.id.slice(0, 8)}`,
        confirmed_at: new Date().toISOString(),
      });

    // If transaction recording fails, don't process the payment
    // This prevents duplicate payments on retry
    if (txInsertError) {
      console.error(`[MonitorDeposits] Failed to record transaction for ${user.email}:`, txInsertError);
      results.errors.push(`Failed to record tx for ${user.email}: ${txInsertError.message}`);
      return;
    }

    console.log(`[MonitorDeposits] Successfully recorded ${unrecordedFunds.toFixed(2)} USDC deposit for ${user.email}`);

    // Re-calculate period payment with new transaction
    const newPaidThisPeriod = paidThisPeriod + unrecordedFunds;
    const newRemaining = expectedAmountUsdc - newPaidThisPeriod;

    if (newRemaining <= tolerance) {
      // Now the period is paid!
      console.log(`[MonitorDeposits] Payment now complete for ${user.email} after recording new deposit`);
      results.detected++;

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
          paid_this_period: newPaidThisPeriod,
          payment_type: paymentType,
        },
      });

      // Use expectedAmountUsdc for distribution (not overpayment)
      if (paymentType === 'initial_unlock') {
        await processInitialUnlock(supabase, user.id, expectedAmountUsdc.toFixed(2));
      } else {
        // Detect schedule based on amount paid
        const weeklyDiff2 = Math.abs(newPaidThisPeriod - weeklyAmount);
        const monthlyDiff2 = Math.abs(newPaidThisPeriod - monthlyAmount);
        if (weeklyDiff2 < monthlyDiff2 && newPaidThisPeriod >= weeklyAmount * 0.99) {
          detectedSchedule = 'weekly';
          expectedAmountUsdc = weeklyAmount;
        } else {
          detectedSchedule = 'monthly';
          expectedAmountUsdc = monthlyAmount;
        }

        // Roll forward from current next_payment_due_date
        const currentNextDueDate = user.next_payment_due_date
          ? new Date(user.next_payment_due_date)
          : new Date(); // Fallback if not set
        const isMonthly = detectedSchedule === 'monthly';
        await processSubscriptionPayment(supabase, user.id, expectedAmountUsdc.toFixed(2), isMonthly, currentNextDueDate);
      }
    } else {
      // Still underpaid
      console.log(`[MonitorDeposits] Partial payment for ${user.email}: ${newPaidThisPeriod.toFixed(2)} of ${expectedAmountUsdc} (need ${newRemaining.toFixed(2)} more)`);
      results.underpaid++;

      await supabase.from('crypto_audit_log').insert({
        event_type: 'deposit_underpaid_cron',
        user_id: user.id,
        entity_type: 'user',
        entity_id: user.id,
        details: {
          source: 'monitor_cron',
          deposit_address: depositAddress,
          expected_usdc: expectedAmountUsdc,
          paid_this_period: newPaidThisPeriod,
          remaining_usdc: newRemaining,
          payment_type: paymentType,
        },
      });
    }
  } else if (paidThisPeriod > 0 && remaining > tolerance) {
    // Partial payment already recorded, still waiting for more
    console.log(`[MonitorDeposits] Waiting for more funds from ${user.email}: ${paidThisPeriod.toFixed(2)} of ${expectedAmountUsdc}`);
    results.underpaid++;
  }
}

/**
 * Process initial unlock payment
 * Sets initial payment due dates with anchor date (capped at day 28)
 */
async function processInitialUnlock(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  amountUsdc: string,
  usdcTxId?: string
) {
  // Get referrer_id from referrals table FIRST
  const { data: referralData, error: referralError } = await supabase
    .from('referrals')
    .select('referrer_id')
    .eq('referred_id', userId)
    .single();

  if (referralError || !referralData?.referrer_id) {
    console.error(`[MonitorDeposits] No referrer found for user ${userId}:`, referralError);
    throw new Error(`No referrer found for user ${userId} - cannot assign network position`);
  }

  const referrerId = referralData.referrer_id;

  // Assign network position WITH referrer_id (required for non-root users)
  const { error: positionError } = await supabase.rpc('assign_network_position', {
    p_user_id: userId,
    p_referrer_id: referrerId,
  });

  if (positionError) {
    console.error(`[MonitorDeposits] Failed to assign network position for ${userId}:`, positionError);
    throw new Error(`Failed to assign network position: ${positionError.message}`);
  }

  // Get user's payment schedule preference (default to monthly)
  const { data: userData } = await supabase
    .from('users')
    .select('payment_schedule')
    .eq('id', userId)
    .single();

  const isWeekly = userData?.payment_schedule === 'weekly';
  const now = new Date();

  // Get anchor date with day capped at 28 (e.g., Jan 31 → Jan 28)
  const anchorDate = getInitialAnchorDate(now);
  // Next due date is one period from the anchor
  const nextDueDate = calculateNextDueDate(isWeekly, anchorDate);

  // Update user membership with initial due dates
  await supabase
    .from('users')
    .update({
      membership_status: 'unlocked',
      is_active: true,
      paid_for_period: true,
      initial_payment_completed: true,
      initial_payment_at: now.toISOString(),
      last_payment_date: now.toISOString(),
      previous_payment_due_date: anchorDate.toISOString(),
      next_payment_due_date: nextDueDate.toISOString(),
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

  // Create direct bonus commission (using referrerId from earlier lookup)
  const directBonusAmount = parseFloat(PAYMENT_AMOUNTS.DIRECT_BONUS);

  await supabase
    .from('commissions')
    .insert({
      referrer_id: referrerId,
      referred_id: userId,
      commission_type: 'direct_bonus',
      amount: directBonusAmount,
      status: 'pending',
    });

  console.log(`[MonitorDeposits] Created direct bonus of $${directBonusAmount} for referrer ${referrerId}`);

  console.log(`[MonitorDeposits] Initial unlock completed for user ${userId}`);
}

/**
 * Process subscription payment
 * Rolls forward due dates from the current next_payment_due_date (not NOW)
 * @param currentNextDueDate - The user's current next_payment_due_date to roll forward from
 */
async function processSubscriptionPayment(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  amountUsdc: string,
  isMonthly: boolean,
  currentNextDueDate: Date,
  usdcTxId?: string
) {
  const now = new Date();
  const isWeekly = !isMonthly;
  const paymentType = isMonthly ? 'monthly' : 'weekly';

  // Roll forward from the CURRENT next_payment_due_date, not NOW
  // previous becomes current next, next becomes one period after current next
  const newPreviousDueDate = currentNextDueDate;
  const newNextDueDate = calculateNextDueDate(isWeekly, currentNextDueDate);

  // ALWAYS update user status first - this ensures user is marked as paid
  // even if the idempotency check below skips payment record creation
  await supabase
    .from('users')
    .update({
      is_active: true,
      paid_for_period: true,
      last_payment_date: now.toISOString(),
      payment_schedule: isMonthly ? 'monthly' : 'weekly',
      previous_payment_due_date: newPreviousDueDate.toISOString(),
      next_payment_due_date: newNextDueDate.toISOString(),
    })
    .eq('id', userId);

  // IDEMPOTENCY CHECK: Prevent duplicate payment records
  // Check if a payment already exists for this user in the last 24 hours
  // Note: User status was already updated above, this only prevents duplicate payment records
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { data: recentPayment } = await supabase
    .from('payments')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('status', 'succeeded')
    .in('payment_type', ['weekly', 'monthly'])
    .gte('created_at', oneDayAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recentPayment) {
    console.log(`[MonitorDeposits] IDEMPOTENCY: Payment record already exists for user ${userId} at ${recentPayment.created_at}, skipping duplicate record creation (user status was updated)`);
    return;
  }

  // Create payment record
  const { data: paymentRecord } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      amount: amountUsdc,
      payment_type: paymentType,
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
    p_amount: amountUsdc,
  });

  console.log(`[MonitorDeposits] Subscription payment completed for user ${userId}`);
}
