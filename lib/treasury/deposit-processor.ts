/**
 * Shared Deposit Processor
 *
 * Single source of truth for turning an on-chain USDC deposit into a registered
 * payment (usdc_transactions + payments rows, upline volume distribution, due-date
 * advancement). Extracted from the monitor-deposits cron so the same idempotent
 * logic can be invoked from multiple detection paths:
 *   - monitor-deposits cron (hourly backstop, balance-based)
 *   - sweep-identify cron (records the deposit while funds are still in the address,
 *     BEFORE the sweep empties it — closes the sweep/monitor race that silently
 *     dropped payments)
 *
 * Idempotency is preserved by the same invariant the webhook + monitor already rely
 * on: unrecordedFunds = on-chain balance − sum of already-recorded deposits. Once a
 * deposit is recorded and linked to a payment it is never re-counted, and
 * processSubscriptionPayment additionally guards on a recent (24h) payment.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  weiToUsdc,
  calculateNextDueDate,
  getInitialAnchorDate,
} from '@/lib/treasury/treasury-service';
import { getUsdcBalance, findDepositTransactionHash } from '@/lib/polygon/event-scanner';
import { PAYMENT_AMOUNTS } from '@/lib/coinbase/wallet-types';

export interface DepositProcessResults {
  processed: number;
  detected: number;
  underpaid: number;
  overpaid: number;
  errors: string[];
}

/** Create a fresh, throwaway results collector for callers that don't track stats. */
export function newDepositProcessResults(): DepositProcessResults {
  return { processed: 0, detected: 0, underpaid: 0, overpaid: 0, errors: [] };
}

export interface DepositUser {
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
  last_payment_date: string | null;
}

/**
 * Check a single user's deposit address for payments and process any completed
 * period. Uses period-based logic: sum transactions since last_payment_date, and
 * record any unrecorded on-chain funds before processing.
 */
export async function checkAndProcessUserDeposit(
  supabase: ReturnType<typeof createServiceRoleClient>,
  user: DepositUser,
  results: DepositProcessResults = newDepositProcessResults()
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
    // Subscriptions accept either weekly or monthly. Use weekly as the
    // "is the period covered" threshold; the actual schedule is detected
    // from the deposit amount once we know the period is paid.
    expectedAmountUsdc = weeklyAmount;
    detectedSchedule = 'weekly';
  }

  // PERIOD-BASED LOGIC: Sum transactions since last successful payment
  // Uses last_payment_date so overpayment from previous payment types
  // (e.g. initial unlock) doesn't carry into subscription accumulation
  // IMPORTANT: Only count deposits that haven't been linked to a payment yet
  const periodStart = user.last_payment_date || user.previous_payment_due_date || '1970-01-01';

  const { data: periodTxs } = await supabase
    .from('usdc_transactions')
    .select('id, amount, created_at')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .eq('transaction_type', 'deposit')
    .gt('created_at', periodStart)
    .is('related_payment_id', null);

  const paidThisPeriod = periodTxs?.reduce(
    (sum, tx) => sum + parseFloat(tx.amount),
    0
  ) || 0;

  // Collect transaction IDs to link to payment record
  const periodTxIds = periodTxs?.map(tx => tx.id) || [];

  const remaining = expectedAmountUsdc - paidThisPeriod;
  const tolerance = expectedAmountUsdc * 0.01; // 1% tolerance

  console.log(`[DepositProcessor] User ${user.email}: paid ${paidThisPeriod.toFixed(2)} this period, needs ${expectedAmountUsdc}, remaining ${remaining.toFixed(2)} (${paymentType})`);

  // SAFETY CHECK: If unlinked deposits vastly exceed expected amount, they're likely
  // from a previous payment type (e.g. $499 initial being re-detected as $199 monthly).
  // For subscriptions, cap against the largest legit single-period payment (monthly)
  // so a $199 monthly deposit isn't flagged when the threshold is the weekly amount.
  const anomalyCap = paymentType === 'subscription' ? monthlyAmount * 2 : expectedAmountUsdc * 2;
  if (paymentType !== 'initial_unlock' && paidThisPeriod > anomalyCap) {
    console.warn(`[DepositProcessor] ANOMALY: User ${user.email} has ${paidThisPeriod.toFixed(2)} in unlinked deposits but cap is ${anomalyCap}. Likely stale unlinked transactions from a previous payment. Skipping to prevent ghost payment.`);
    await supabase.from('crypto_audit_log').insert({
      event_type: 'deposit_anomaly_skipped',
      user_id: user.id,
      entity_type: 'user',
      entity_id: user.id,
      details: {
        source: 'deposit_processor',
        deposit_address: depositAddress,
        expected_usdc: expectedAmountUsdc,
        anomaly_cap: anomalyCap,
        paid_this_period: paidThisPeriod,
        payment_type: paymentType,
        reason: 'Unlinked deposits exceed anomaly cap - possible stale transactions',
      },
    });
    return;
  }

  // Skip if already paid for this period
  if (remaining <= tolerance) {
    // Check if we already updated their due dates
    if (user.next_payment_due_date && new Date(user.next_payment_due_date) > new Date()) {
      // Already processed for this period
      return;
    }

    // Period is paid but due dates not updated - this is a completed payment!
    console.log(`[DepositProcessor] Payment complete for ${user.email}, updating due dates`);
    results.detected++;

    // Find the most recent transaction hash for logging
    let txHash = '';
    try {
      const txEvent = await findDepositTransactionHash(depositAddress);
      if (txEvent) {
        txHash = txEvent.txHash;
      }
    } catch (err) {
      console.error('[DepositProcessor] Failed to find tx hash:', err);
    }

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'deposit_detected_cron',
      user_id: user.id,
      entity_type: 'user',
      entity_id: user.id,
      details: {
        source: 'deposit_processor',
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
      await processInitialUnlock(supabase, user.id, expectedAmountUsdc.toFixed(2), periodTxIds);
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
      await processSubscriptionPayment(supabase, user.id, expectedAmountUsdc.toFixed(2), isMonthly, currentNextDueDate, periodTxIds);
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
    console.log(`[DepositProcessor] Found ${unrecordedFunds.toFixed(2)} unrecorded USDC for ${user.email}`);

    // Find transaction hash
    let txHash = '';
    try {
      const txEvent = await findDepositTransactionHash(depositAddress);
      if (txEvent) {
        txHash = txEvent.txHash;
      }
    } catch (err) {
      console.error('[DepositProcessor] Failed to find tx hash:', err);
    }

    // Record the new deposit - MUST succeed before processing payment
    const { data: newTxRecord, error: txInsertError } = await supabase
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
      })
      .select('id')
      .single();

    // If transaction recording fails, don't process the payment
    // This prevents duplicate payments on retry
    if (txInsertError || !newTxRecord) {
      console.error(`[DepositProcessor] Failed to record transaction for ${user.email}:`, txInsertError);
      results.errors.push(`Failed to record tx for ${user.email}: ${txInsertError?.message || 'Unknown error'}`);
      return;
    }

    // Combine existing period transactions with the newly recorded one
    const allTxIds = [...periodTxIds, newTxRecord.id];

    console.log(`[DepositProcessor] Successfully recorded ${unrecordedFunds.toFixed(2)} USDC deposit for ${user.email}`);

    // Re-calculate period payment with new transaction
    const newPaidThisPeriod = paidThisPeriod + unrecordedFunds;
    const newRemaining = expectedAmountUsdc - newPaidThisPeriod;

    if (newRemaining <= tolerance) {
      // Now the period is paid!
      console.log(`[DepositProcessor] Payment now complete for ${user.email} after recording new deposit`);
      results.detected++;

      await supabase.from('crypto_audit_log').insert({
        event_type: 'deposit_detected_cron',
        user_id: user.id,
        entity_type: 'user',
        entity_id: user.id,
        details: {
          source: 'deposit_processor',
          deposit_address: depositAddress,
          tx_hash: txHash,
          expected_usdc: expectedAmountUsdc,
          paid_this_period: newPaidThisPeriod,
          payment_type: paymentType,
        },
      });

      // Use expectedAmountUsdc for distribution (not overpayment)
      if (paymentType === 'initial_unlock') {
        await processInitialUnlock(supabase, user.id, expectedAmountUsdc.toFixed(2), allTxIds);
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
        await processSubscriptionPayment(supabase, user.id, expectedAmountUsdc.toFixed(2), isMonthly, currentNextDueDate, allTxIds);
      }
    } else {
      // Still underpaid
      console.log(`[DepositProcessor] Partial payment for ${user.email}: ${newPaidThisPeriod.toFixed(2)} of ${expectedAmountUsdc} (need ${newRemaining.toFixed(2)} more)`);
      results.underpaid++;

      await supabase.from('crypto_audit_log').insert({
        event_type: 'deposit_underpaid_cron',
        user_id: user.id,
        entity_type: 'user',
        entity_id: user.id,
        details: {
          source: 'deposit_processor',
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
    console.log(`[DepositProcessor] Waiting for more funds from ${user.email}: ${paidThisPeriod.toFixed(2)} of ${expectedAmountUsdc}`);
    results.underpaid++;
  }
}

/**
 * Process initial unlock payment
 * Sets initial payment due dates with anchor date (capped at day 28)
 */
export async function processInitialUnlock(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  amountUsdc: string,
  usdcTxIds: string[] = []
) {
  // IDEMPOTENCY CHECK: Verify user hasn't already been activated
  const { data: userCheck } = await supabase
    .from('users')
    .select('initial_payment_completed')
    .eq('id', userId)
    .single();

  if (userCheck?.initial_payment_completed) {
    console.log(`[DepositProcessor] User ${userId} already has initial payment completed, skipping processInitialUnlock`);
    return;
  }

  // Get referrer_id from referrals table FIRST
  const { data: referralData, error: referralError } = await supabase
    .from('referrals')
    .select('referrer_id')
    .eq('referred_id', userId)
    .single();

  if (referralError || !referralData?.referrer_id) {
    console.error(`[DepositProcessor] No referrer found for user ${userId}:`, referralError);
    throw new Error(`No referrer found for user ${userId} - cannot assign network position`);
  }

  const referrerId = referralData.referrer_id;

  // Assign network position WITH referrer_id (required for non-root users)
  const { error: positionError } = await supabase.rpc('assign_network_position', {
    p_user_id: userId,
    p_referrer_id: referrerId,
  });

  if (positionError) {
    console.error(`[DepositProcessor] Failed to assign network position for ${userId}:`, positionError);
    throw new Error(`Failed to assign network position: ${positionError.message}`);
  }

  const now = new Date();

  // Initial unlock always grants a 30-day cycle. Per-payment schedule
  // (weekly vs monthly) is chosen at each subscription payment.
  const anchorDate = getInitialAnchorDate(now);
  const nextDueDate = calculateNextDueDate(false, anchorDate);

  // Update user membership with initial due dates
  const { error: userUpdateError } = await supabase
    .from('users')
    .update({
      membership_status: 'unlocked',
      is_active: true,
      paid_for_period: true,
      initial_payment_completed: true,
      initial_payment_date: now.toISOString(),
      last_payment_date: now.toISOString(),
      previous_payment_due_date: anchorDate.toISOString(),
      next_payment_due_date: nextDueDate.toISOString(),
    })
    .eq('id', userId);

  if (userUpdateError) {
    console.error(`[DepositProcessor] CRITICAL: Failed to activate user ${userId}:`, userUpdateError);
    throw new Error(`Failed to activate user membership: ${userUpdateError.message}`);
  }

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
      usdc_transaction_id: usdcTxIds[0] || null,
    })
    .select()
    .single();

  // Link ALL contributing transactions to this payment
  // This prevents them from being counted again in future cron runs
  // IMPORTANT: Only link transactions that aren't already linked to another payment
  if (paymentRecord && usdcTxIds.length > 0) {
    await supabase
      .from('usdc_transactions')
      .update({ related_payment_id: paymentRecord.id })
      .in('id', usdcTxIds)
      .is('related_payment_id', null);

    console.log(`[DepositProcessor] Linked ${usdcTxIds.length} transaction(s) to initial payment ${paymentRecord.id}`);
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

  console.log(`[DepositProcessor] Created direct bonus of $${directBonusAmount} for referrer ${referrerId}`);

  // Send direct bonus notification to referrer
  try {
    const { notifyDirectBonus } = await import('@/lib/notifications/notification-service')
    const { data: newUser } = await supabase.from('users').select('name').eq('id', userId).single()
    await notifyDirectBonus({
      referrerId,
      referredName: newUser?.name || 'New Member',
      amount: directBonusAmount,
      commissionId: `direct_bonus_${userId}`,
    })
  } catch (notifError) {
    console.error('[DepositProcessor] Error sending direct bonus notification:', notifError)
  }

  console.log(`[DepositProcessor] Initial unlock completed for user ${userId}`);
}

/**
 * Process subscription payment
 * Rolls forward due dates from the current next_payment_due_date (not NOW)
 * @param currentNextDueDate - The user's current next_payment_due_date to roll forward from
 * @param usdcTxIds - Array of USDC transaction IDs to link to this payment (prevents double-counting)
 */
export async function processSubscriptionPayment(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  amountUsdc: string,
  isMonthly: boolean,
  currentNextDueDate: Date,
  usdcTxIds: string[] = []
) {
  const now = new Date();
  const isWeekly = !isMonthly;
  const paymentType = isMonthly ? 'monthly' : 'weekly';

  // IDEMPOTENCY CHECK FIRST: Prevent duplicate processing
  // Check if a payment already exists for this user in the last 24 hours
  // Must happen BEFORE updating user status to prevent incorrect status/date updates
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
    console.log(`[DepositProcessor] IDEMPOTENCY: Payment already exists for user ${userId} at ${recentPayment.created_at}, skipping entirely`);
    return;
  }

  // If user is overdue/inactive, one payment brings them current (anchor from NOW)
  // Otherwise, roll forward from the current next_payment_due_date
  let newPreviousDueDate: Date;
  let newNextDueDate: Date;

  if (currentNextDueDate <= now) {
    // User is overdue/inactive — one payment brings them current
    newPreviousDueDate = getInitialAnchorDate(now);
    newNextDueDate = calculateNextDueDate(isWeekly, newPreviousDueDate);
  } else {
    // Normal on-time payment — roll forward from current dates
    newPreviousDueDate = currentNextDueDate;
    newNextDueDate = calculateNextDueDate(isWeekly, currentNextDueDate);
  }

  // Determine if this is a late payment (on or after due date)
  // Late payments cover the previous period only - user still owes for new period
  // Early payments (before due date) cover the current period
  const isLatePayment = now >= currentNextDueDate;

  // Check if user was inactive before update (for reactivation notification)
  const { data: userBefore } = await supabase.from('users').select('is_active').eq('id', userId).single()
  const wasInactive = !userBefore?.is_active

  // Update user status (only reached if no duplicate payment found)
  const updateData: Record<string, unknown> = {
    is_active: true,
    paid_for_period: currentNextDueDate <= now ? true : !isLatePayment,
    last_payment_date: now.toISOString(),
    payment_schedule: isMonthly ? 'monthly' : 'weekly',
    previous_payment_due_date: newPreviousDueDate.toISOString(),
    next_payment_due_date: newNextDueDate.toISOString(),
  };
  // Clear inactive_since when reactivating
  if (wasInactive) {
    updateData.inactive_since = null;
  }
  const { error: userUpdateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (userUpdateError) {
    console.error(`[DepositProcessor] CRITICAL: Failed to update user ${userId} after payment:`, userUpdateError);
    // Do NOT continue — if we create a payment record and link transactions
    // without the user being activated, the cron will never retry (it only
    // counts unlinked transactions). Bail out so the cron can pick this up.
    return;
  }

  // Send payment succeeded notification
  try {
    const { notifyPaymentSucceeded } = await import('@/lib/notifications/notification-service')
    await notifyPaymentSucceeded({ userId, amount: parseFloat(amountUsdc) })
  } catch (notifError) {
    console.error('[DepositProcessor] Error sending payment succeeded notification:', notifError)
  }

  // Send account reactivated notification if user was inactive
  if (wasInactive) {
    try {
      const { notifyAccountReactivated } = await import('@/lib/notifications/notification-service')
      await notifyAccountReactivated({ userId })
    } catch (notifError) {
      console.error('[DepositProcessor] Error sending reactivated notification:', notifError)
    }
  }

  // Create payment record (link to first transaction if available)
  const { data: paymentRecord } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      amount: amountUsdc,
      payment_type: paymentType,
      status: 'succeeded',
      usdc_transaction_id: usdcTxIds[0] || null,
    })
    .select()
    .single();

  // Link ALL contributing transactions to this payment
  // This prevents them from being counted again in future cron runs
  // IMPORTANT: Only link transactions that aren't already linked to another payment
  if (paymentRecord && usdcTxIds.length > 0) {
    await supabase
      .from('usdc_transactions')
      .update({ related_payment_id: paymentRecord.id })
      .in('id', usdcTxIds)
      .is('related_payment_id', null);

    console.log(`[DepositProcessor] Linked ${usdcTxIds.length} transaction(s) to payment ${paymentRecord.id}`);
  }

  // Distribute to upline
  const { data: distributeResult, error: distributeError } = await supabase.rpc('distribute_to_upline_batch', {
    p_user_id: userId,
    p_amount: amountUsdc,
  });

  if (distributeError) {
    console.error(`[DepositProcessor] CRITICAL: distribute_to_upline_batch failed for user ${userId}, amount ${amountUsdc}:`, distributeError);
    await supabase.from('crypto_audit_log').insert({
      event_type: 'volume_distribution_failure',
      entity_type: 'payment',
      entity_id: paymentRecord?.id || null,
      details: {
        user_id: userId,
        amount: amountUsdc,
        error: distributeError.message,
        source: 'deposit_processor',
      },
    }).then(() => {}, () => {});
  } else {
    console.log(`[DepositProcessor] Distributed $${amountUsdc} volume to ${distributeResult} ancestors for user ${userId}`);
  }

  // Check for volume milestone
  try {
    const { data: volumeData } = await supabase
      .from('users')
      .select('sniper_volume_current_month')
      .eq('id', userId)
      .single()

    if (volumeData) {
      const newVolume = volumeData.sniper_volume_current_month || 0
      const oldVolume = newVolume - parseFloat(amountUsdc)
      const thresholds = [1000, 5000, 10000, 25000, 50000, 100000]
      const crossedThreshold = thresholds.find(t => oldVolume < t && newVolume >= t)

      if (crossedThreshold) {
        const { notifyVolumeUpdate } = await import('@/lib/notifications/notification-service')
        const vNow = new Date()
        const month = `${vNow.toLocaleString('en-US', { month: 'long' })} ${vNow.getFullYear()}`
        await notifyVolumeUpdate({ userId, newVolume, month })
      }
    }
  } catch (volError) {
    console.error('[DepositProcessor] Error checking volume milestones:', volError)
  }

  console.log(`[DepositProcessor] Subscription payment completed for user ${userId}`);
}
