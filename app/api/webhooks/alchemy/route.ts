/**
 * Alchemy Webhook Endpoint
 * Receives real-time USDC transfer notifications from Alchemy
 * Uses permanent user deposit addresses for payment detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  verifyAlchemySignature,
  parseUSDCTransfers,
  getAlchemySigningKey,
  formatWebhookEventForLog,
  AlchemyWebhookPayload,
  ParsedUSDCTransfer,
} from '@/lib/alchemy/webhook-service';
import {
  getUserByDepositAddress,
  calculateNextDueDate,
  getInitialAnchorDate,
} from '@/lib/treasury/treasury-service';
import { PAYMENT_AMOUNTS } from '@/lib/coinbase/wallet-types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/webhooks/alchemy
 * Receives webhook notifications from Alchemy Address Activity
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();

    // Verify signature
    const signature = req.headers.get('x-alchemy-signature') || '';
    const signingKey = getAlchemySigningKey();

    if (!signingKey) {
      console.error('[AlchemyWebhook] No signing key configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    if (!verifyAlchemySignature(rawBody, signature, signingKey)) {
      console.warn('[AlchemyWebhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    const payload: AlchemyWebhookPayload = JSON.parse(rawBody);

    console.log('[AlchemyWebhook] Received:', formatWebhookEventForLog(payload));

    // Parse USDC transfers from the payload
    const transfers = parseUSDCTransfers(payload);

    if (transfers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No USDC transfers in payload',
        processed: 0,
      });
    }

    console.log(`[AlchemyWebhook] Found ${transfers.length} USDC transfer(s)`);

    const supabase = createServiceRoleClient();
    const results = {
      processed: 0,
      matched: 0,
      errors: [] as string[],
    };

    // Process each transfer 
    for (const transfer of transfers) {
      results.processed++;

      try {
        await processTransfer(supabase, transfer, results);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[AlchemyWebhook] Error processing transfer ${transfer.txHash}:`, error);
        results.errors.push(`${transfer.txHash}: ${errorMsg}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[AlchemyWebhook] Complete in ${duration}ms. Processed: ${results.processed}, Matched: ${results.matched}`);

    return NextResponse.json({
      success: true,
      processed: results.processed,
      matched: results.matched,
      duration,
    });
  } catch (error) {
    console.error('[AlchemyWebhook] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Process a single USDC transfer
 * Looks up user by deposit address and processes payment based on user status
 */
async function processTransfer(
  supabase: ReturnType<typeof createServiceRoleClient>,
  transfer: ParsedUSDCTransfer,
  results: { matched: number; errors: string[] }
) {
  // Look up user by their permanent deposit address
  const user = await getUserByDepositAddress(transfer.to);

  if (!user) {
    // Not a tracked user deposit address - ignore
    console.log(`[AlchemyWebhook] Transfer to ${transfer.to} - not a tracked address`);
    return;
  }

  console.log(`[AlchemyWebhook] Matched deposit address ${transfer.to} for user ${user.id} (${user.email})`);
  results.matched++;

  // Check for duplicate transaction (idempotency)
  const { data: existingTx } = await supabase
    .from('usdc_transactions')
    .select('id')
    .eq('polygon_tx_hash', transfer.txHash)
    .single();

  if (existingTx) {
    console.log(`[AlchemyWebhook] Transfer ${transfer.txHash} already processed`);
    return;
  }

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
    // Detect which payment type based on amount received
    // If amount is closer to weekly, treat as weekly; otherwise monthly
    const receivedAmount = transfer.amountUsdc;
    const weeklyDiff = Math.abs(receivedAmount - weeklyAmount);
    const monthlyDiff = Math.abs(receivedAmount - monthlyAmount);

    if (weeklyDiff < monthlyDiff && receivedAmount >= weeklyAmount * 0.99) {
      // Amount is closer to weekly and meets minimum
      detectedSchedule = 'weekly';
      expectedAmountUsdc = weeklyAmount;
    } else {
      // Amount is closer to monthly (or not enough for weekly)
      detectedSchedule = 'monthly';
      expectedAmountUsdc = monthlyAmount;
    }
  }

  const receivedAmountUsdc = transfer.amountUsdc;
  const tolerance = expectedAmountUsdc * 0.01; // 1% tolerance

  // PERIOD-BASED LOGIC: Record this transaction first, then check period total
  // Get the ID back so we can link it to the payment record later
  const { data: txRecord, error: txInsertError } = await supabase.from('usdc_transactions').insert({
    transaction_type: 'deposit',
    from_address: transfer.from,
    to_address: transfer.to,
    amount: receivedAmountUsdc.toFixed(2),
    user_id: user.id,
    status: 'confirmed',
    polygon_tx_hash: transfer.txHash,
    confirmed_at: new Date().toISOString(),
  }).select('id').single();

  // If transaction recording fails, don't process the payment
  // This prevents duplicate payments on retry/race conditions
  if (txInsertError) {
    console.error(`[AlchemyWebhook] Failed to record transaction for ${user.email}:`, txInsertError);
    results.errors.push(`${transfer.txHash}: ${txInsertError.message}`);
    return;
  }

  console.log(`[AlchemyWebhook] Recorded ${receivedAmountUsdc.toFixed(2)} USDC deposit for ${user.email}`);

  // Now get period total (including the transaction we just recorded)
  const periodStart = user.previous_payment_due_date || '1970-01-01';

  const { data: periodTxs } = await supabase
    .from('usdc_transactions')
    .select('amount')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .eq('transaction_type', 'deposit')
    .gt('created_at', periodStart);

  const paidThisPeriod = periodTxs?.reduce(
    (sum, tx) => sum + parseFloat(tx.amount || '0'),
    0
  ) || 0;

  const remaining = expectedAmountUsdc - paidThisPeriod;

  console.log(`[AlchemyWebhook] User ${user.id}: expects ${paymentType}, ${expectedAmountUsdc} USDC. Received ${receivedAmountUsdc} USDC this tx, total paid this period: ${paidThisPeriod} USDC, remaining: ${remaining}`);

  // Check if period is now fully paid
  if (remaining > tolerance) {
    // Still underpaid for this period
    console.log(`[AlchemyWebhook] Partial payment: ${paidThisPeriod} USDC paid, need ${remaining.toFixed(2)} more`);

    // Log audit event for partial payment
    await supabase.from('crypto_audit_log').insert({
      event_type: 'deposit_partial_webhook',
      user_id: user.id,
      entity_type: 'user',
      entity_id: user.id,
      details: {
        source: 'alchemy_webhook',
        tx_hash: transfer.txHash,
        expected_usdc: expectedAmountUsdc,
        received_usdc: receivedAmountUsdc,
        paid_this_period: paidThisPeriod,
        remaining_usdc: remaining,
        payment_type: paymentType,
      },
    });

    return;
  }

  // Period is fully paid!
  const overpayment = paidThisPeriod - expectedAmountUsdc;
  const isOverpaid = overpayment > tolerance;

  console.log(`[AlchemyWebhook] Payment complete for period: ${paidThisPeriod} USDC (overpaid: ${isOverpaid})`);

  // Log audit event
  await supabase.from('crypto_audit_log').insert({
    event_type: 'deposit_detected_webhook',
    user_id: user.id,
    entity_type: 'user',
    entity_id: user.id,
    details: {
      source: 'alchemy_webhook',
      tx_hash: transfer.txHash,
      block_number: transfer.blockNumber,
      expected_usdc: expectedAmountUsdc,
      paid_this_period: paidThisPeriod,
      is_overpaid: isOverpaid,
      overpayment_amount: isOverpaid ? overpayment : 0,
      payment_type: paymentType,
    },
  });

  // Process the payment based on type
  // Use expectedAmountUsdc for distribution (not overpayment)
  if (paymentType === 'initial_unlock') {
    await processInitialUnlock(supabase, user.id, expectedAmountUsdc.toFixed(2));
  } else {
    // Roll forward from current next_payment_due_date
    const currentNextDueDate = user.next_payment_due_date
      ? new Date(user.next_payment_due_date)
      : new Date(); // Fallback if not set
    const isMonthly = detectedSchedule === 'monthly';
    // Pass transaction ID so it gets linked to the payment record
    const txIds = txRecord ? [txRecord.id] : [];
    await processSubscriptionPayment(supabase, user.id, expectedAmountUsdc.toFixed(2), isMonthly, currentNextDueDate, txIds);
  }

  // Handle overpayment credit
  if (isOverpaid && overpayment > 0) {
    await supabase
      .from('commissions')
      .insert({
        referrer_id: user.id,
        referred_id: user.id,
        commission_type: 'overpayment_credit',
        amount: overpayment,
        net_amount_usdc: overpayment,
        status: 'pending',
        description: `Overpayment credit from ${paymentType} payment (via webhook)`,
      });

    console.log(`[AlchemyWebhook] Created overpayment credit of $${overpayment.toFixed(2)}`);
  }

  console.log(`[AlchemyWebhook] Payment processed for user ${user.id}, type: ${paymentType}`);
}

/**
 * Process initial unlock payment
 * Sets initial payment due dates with anchor date (capped at day 28)
 */
async function processInitialUnlock(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  amountUsdc: string
) {
  // IDEMPOTENCY CHECK: Verify user hasn't already been activated
  const { data: userCheck } = await supabase
    .from('users')
    .select('initial_payment_completed')
    .eq('id', userId)
    .single();

  if (userCheck?.initial_payment_completed) {
    console.log(`[AlchemyWebhook] User ${userId} already has initial payment completed, skipping processInitialUnlock`);
    return;
  }

  // Try referrals table first
  const { data: referralData } = await supabase
    .from('referrals')
    .select('referrer_id')
    .eq('referred_id', userId)
    .single();

  let referrerId = referralData?.referrer_id;

  // Fallback: check users.referred_by if no referral record exists
  // This handles cases where OAuth signup was interrupted before referral record was created
  if (!referrerId) {
    const { data: userReferralData } = await supabase
      .from('users')
      .select('referred_by')
      .eq('id', userId)
      .single();

    referrerId = userReferralData?.referred_by;

    // Create missing referral record for consistency
    if (referrerId) {
      const { error: insertError } = await supabase.from('referrals').insert({
        referrer_id: referrerId,
        referred_id: userId,
        status: 'pending',
      });

      if (!insertError) {
        console.log(`[AlchemyWebhook] Created missing referral record for user ${userId}`);
      } else {
        console.warn(`[AlchemyWebhook] Failed to create missing referral record:`, insertError);
      }
    }
  }

  if (!referrerId) {
    console.error(`[AlchemyWebhook] No referrer found for user ${userId} in referrals table or users.referred_by`);
    throw new Error(`No referrer found for user ${userId} - cannot assign network position`);
  }

  // Assign network position WITH referrer_id (required for non-root users)
  const { error: positionError } = await supabase.rpc('assign_network_position', {
    p_user_id: userId,
    p_referrer_id: referrerId,
  });

  if (positionError) {
    console.error(`[AlchemyWebhook] Failed to assign network position for ${userId}:`, positionError);
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
    console.error(`[AlchemyWebhook] CRITICAL: Failed to activate user ${userId}:`, userUpdateError);
    throw new Error(`Failed to activate user membership: ${userUpdateError.message}`);
  }

  // Increment active count for upline
  await supabase.rpc('increment_upchain_active_count', { p_user_id: userId });

  // Create payment record
  await supabase
    .from('payments')
    .insert({
      user_id: userId,
      amount: amountUsdc,
      payment_type: 'initial',
      status: 'succeeded',
    });

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

  console.log(`[AlchemyWebhook] Created direct bonus of $${directBonusAmount} for referrer ${referrerId}`);

  console.log(`[AlchemyWebhook] Initial unlock completed for user ${userId}`);
}

/**
 * Process subscription payment
 * Rolls forward due dates from the current next_payment_due_date (not NOW)
 * @param currentNextDueDate - The user's current next_payment_due_date to roll forward from
 * @param usdcTxIds - Array of USDC transaction IDs to link to this payment (prevents double-counting by cron)
 */
async function processSubscriptionPayment(
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
    console.log(`[AlchemyWebhook] IDEMPOTENCY: Payment already exists for user ${userId} at ${recentPayment.created_at}, skipping entirely`);
    return;
  }

  // Roll forward from the CURRENT next_payment_due_date, not NOW
  // previous becomes current next, next becomes one period after current next
  const newPreviousDueDate = currentNextDueDate;
  const newNextDueDate = calculateNextDueDate(isWeekly, currentNextDueDate);

  // Update user status (only reached if no duplicate payment found)
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

  // Create payment record
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
  if (paymentRecord && usdcTxIds.length > 0) {
    await supabase
      .from('usdc_transactions')
      .update({ related_payment_id: paymentRecord.id })
      .in('id', usdcTxIds);

    console.log(`[AlchemyWebhook] Linked ${usdcTxIds.length} transaction(s) to payment ${paymentRecord.id}`);
  }

  // Distribute to upline
  await supabase.rpc('distribute_to_upline_batch', {
    p_user_id: userId,
    p_amount: amountUsdc,
  });

  console.log(`[AlchemyWebhook] Subscription payment completed for user ${userId}, next due: ${newNextDueDate.toISOString()}`);
}
