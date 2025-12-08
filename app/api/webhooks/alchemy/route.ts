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
  getUserPaymentSchedule,
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

  const receivedAmountUsdc = transfer.amountUsdc;
  const tolerance = expectedAmountUsdc * 0.01; // 1% tolerance

  console.log(`[AlchemyWebhook] User ${user.id}: expects ${paymentType}, ${expectedAmountUsdc} USDC, received ${receivedAmountUsdc} USDC`);

  // Check if this is an underpayment
  if (receivedAmountUsdc < (expectedAmountUsdc - tolerance)) {
    console.log(`[AlchemyWebhook] Underpayment: received ${receivedAmountUsdc} USDC, expected ${expectedAmountUsdc} USDC`);

    // Log audit event for underpayment
    await supabase.from('crypto_audit_log').insert({
      event_type: 'deposit_underpaid_webhook',
      user_id: user.id,
      entity_type: 'user',
      entity_id: user.id,
      details: {
        source: 'alchemy_webhook',
        tx_hash: transfer.txHash,
        expected_usdc: expectedAmountUsdc,
        received_usdc: receivedAmountUsdc,
        shortfall_usdc: expectedAmountUsdc - receivedAmountUsdc,
        payment_type: paymentType,
      },
    });

    // Still record the transaction but don't process as complete payment
    await supabase.from('usdc_transactions').insert({
      transaction_type: 'deposit',
      from_address: transfer.from,
      to_address: transfer.to,
      amount: receivedAmountUsdc.toFixed(2),
      user_id: user.id,
      status: 'partial',
      polygon_tx_hash: transfer.txHash,
      confirmed_at: new Date().toISOString(),
    });

    return;
  }

  // Sufficient funds received
  const isOverpaid = receivedAmountUsdc > (expectedAmountUsdc + tolerance);
  const overpaymentAmount = isOverpaid ? receivedAmountUsdc - expectedAmountUsdc : 0;

  console.log(`[AlchemyWebhook] Payment received: ${receivedAmountUsdc} USDC (overpaid: ${isOverpaid})`);

  // Create USDC transaction record
  const { data: txRecord } = await supabase
    .from('usdc_transactions')
    .insert({
      transaction_type: 'deposit',
      from_address: transfer.from,
      to_address: transfer.to,
      amount: receivedAmountUsdc.toFixed(2),
      user_id: user.id,
      status: 'confirmed',
      polygon_tx_hash: transfer.txHash,
      confirmed_at: new Date().toISOString(),
    })
    .select()
    .single();

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
      received_usdc: receivedAmountUsdc,
      is_overpaid: isOverpaid,
      overpayment_amount: overpaymentAmount,
      payment_type: paymentType,
    },
  });

  // Note: We no longer use deposit_addresses table - permanent addresses are stored on users table

  // Process the payment based on type
  if (paymentType === 'initial_unlock') {
    await processInitialUnlock(supabase, user.id, receivedAmountUsdc.toFixed(2), txRecord?.id);
  } else {
    const schedule = await getUserPaymentSchedule(user.id);
    const isMonthly = schedule === 'monthly';
    await processSubscriptionPayment(supabase, user.id, receivedAmountUsdc.toFixed(2), isMonthly, txRecord?.id);
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
        description: `Overpayment credit from ${paymentType} payment (via webhook)`,
      });

    console.log(`[AlchemyWebhook] Created overpayment credit of $${overpaymentAmount.toFixed(2)}`);
  }

  console.log(`[AlchemyWebhook] Payment processed for user ${user.id}, type: ${paymentType}`);
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

    console.log(`[AlchemyWebhook] Created direct bonus of $${directBonusAmount} for referrer ${referral.referrer_id}`);
  }

  console.log(`[AlchemyWebhook] Initial unlock completed for user ${userId}`);
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
  // Update user active status and last payment date
  await supabase
    .from('users')
    .update({
      is_active: true,
      last_payment_date: new Date().toISOString(),
      payment_schedule: isMonthly ? 'monthly' : 'weekly',
    })
    .eq('id', userId);

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

  console.log(`[AlchemyWebhook] Subscription payment completed for user ${userId}`);
}
