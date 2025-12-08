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
  const isWeekly = user.payment_schedule === 'weekly';

  let paymentType: 'initial_unlock' | 'subscription';
  let expectedAmountUsdc: number;

  if (needsInitialPayment) {
    paymentType = 'initial_unlock';
    expectedAmountUsdc = parseFloat(PAYMENT_AMOUNTS.INITIAL_UNLOCK);
  } else {
    paymentType = 'subscription';
    expectedAmountUsdc = isWeekly
      ? parseFloat(PAYMENT_AMOUNTS.WEEKLY_SUBSCRIPTION)
      : parseFloat(PAYMENT_AMOUNTS.MONTHLY_SUBSCRIPTION);
  }

  const receivedAmountUsdc = transfer.amountUsdc;
  const tolerance = expectedAmountUsdc * 0.01; // 1% tolerance

  // PERIOD-BASED LOGIC: Record this transaction first, then check period total
  await supabase.from('usdc_transactions').insert({
    transaction_type: 'deposit',
    from_address: transfer.from,
    to_address: transfer.to,
    amount: receivedAmountUsdc.toFixed(2),
    user_id: user.id,
    status: 'confirmed',
    polygon_tx_hash: transfer.txHash,
    confirmed_at: new Date().toISOString(),
  });

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
  if (paymentType === 'initial_unlock') {
    await processInitialUnlock(supabase, user.id, paidThisPeriod.toFixed(2));
  } else {
    // Roll forward from current next_payment_due_date
    const currentNextDueDate = user.next_payment_due_date
      ? new Date(user.next_payment_due_date)
      : new Date(); // Fallback if not set
    await processSubscriptionPayment(supabase, user.id, paidThisPeriod.toFixed(2), !isWeekly, currentNextDueDate);
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
  // Assign network position
  await supabase.rpc('assign_network_position', { p_user_id: userId });

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

    console.log(`[AlchemyWebhook] Created direct bonus of $${directBonusAmount} for referrer ${referral.referrer_id}`);
  }

  console.log(`[AlchemyWebhook] Initial unlock completed for user ${userId}`);
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
  currentNextDueDate: Date
) {
  const now = new Date();
  const isWeekly = !isMonthly;

  // Roll forward from the CURRENT next_payment_due_date, not NOW
  // previous becomes current next, next becomes one period after current next
  const newPreviousDueDate = currentNextDueDate;
  const newNextDueDate = calculateNextDueDate(isWeekly, currentNextDueDate);

  // Update user active status, payment dates, and due dates
  await supabase
    .from('users')
    .update({
      is_active: true,
      last_payment_date: now.toISOString(),
      payment_schedule: isMonthly ? 'monthly' : 'weekly',
      previous_payment_due_date: newPreviousDueDate.toISOString(),
      next_payment_due_date: newNextDueDate.toISOString(),
    })
    .eq('id', userId);

  // Create payment record
  await supabase
    .from('payments')
    .insert({
      user_id: userId,
      amount: amountUsdc,
      payment_type: isMonthly ? 'monthly' : 'weekly',
      status: 'succeeded',
    });

  // Distribute to upline
  await supabase.rpc('distribute_to_upline_batch', {
    p_user_id: userId,
    p_payment_amount: amountUsdc,
  });

  console.log(`[AlchemyWebhook] Subscription payment completed for user ${userId}, next due: ${newNextDueDate.toISOString()}`);
}
