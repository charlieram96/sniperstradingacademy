/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Deposit Monitoring Cron Job
 * Checks active deposit addresses for incoming USDC payments
 * Run frequency: Every 30-60 seconds (configurable via cron service)
 *
 * Edge case handling:
 * - Underpayment: Keep active, track shortfall, user can send more
 * - Overpayment: Accept, flag for admin review
 * - Late payment: Auto-accept with is_late flag
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  getActiveDepositAddresses,
  markDepositAddressReceived,
  markAsUnderpaid,
  getExpiredAddressesForLateCheck,
  weiToUsdc,
  usdcToWei,
} from '@/lib/treasury/treasury-service';
import {
  findDepositTransactionHash,
  getUsdcBalance,
} from '@/lib/polygon/event-scanner';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max execution time

// Maximum addresses to process per run (for scaling)
const MAX_ADDRESSES_PER_RUN = 100;

/**
 * POST /api/cron/monitor-deposits
 * Check all active deposit addresses for incoming payments
 * Protected by CRON_SECRET
 */
export async function POST(req: NextRequest) {
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
    const results: {
      processed: number;
      detected: number;
      underpaid: number;
      overpaid: number;
      latePayments: number;
      expired: number;
      errors: string[];
    } = {
      processed: 0,
      detected: 0,
      underpaid: 0,
      overpaid: 0,
      latePayments: 0,
      expired: 0,
      errors: [],
    };

    console.log('[MonitorDeposits] Starting deposit monitoring run...');

    // Get active deposit addresses (with limit for scaling)
    const activeAddresses = await getActiveDepositAddresses(MAX_ADDRESSES_PER_RUN);

    if (activeAddresses.length === 0) {
      console.log('[MonitorDeposits] No active deposit addresses to monitor');
      // Still check for late payments on expired addresses
      await checkLatePayments(supabase, results);
      return NextResponse.json({
        success: true,
        message: 'No active deposit addresses',
        results,
      });
    }

    console.log(`[MonitorDeposits] Monitoring ${activeAddresses.length} active addresses (limit: ${MAX_ADDRESSES_PER_RUN})`);

    // First, expire old deposit addresses
    const { data: expiredCount } = await supabase.rpc('expire_old_deposit_addresses');
    results.expired = expiredCount || 0;

    // Also expire related payment intents
    const { data: expiredIntentsCount } = await supabase.rpc('expire_old_payment_intents');

    // Process each active address
    for (const depositRecord of activeAddresses) {
      results.processed++;

      try {
        // Check if already expired
        if (new Date(depositRecord.expires_at) < new Date()) {
          // Mark as expired if not already
          await supabase
            .from('deposit_addresses')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', depositRecord.id)
            .eq('status', 'active');
          continue;
        }

        // Get current balance using event scanner (in smallest units)
        const currentBalanceWei = await getUsdcBalance(depositRecord.deposit_address);
        const currentBalanceNumber = Number(currentBalanceWei);

        // Expected amount is already in smallest units (BIGINT)
        const expectedAmountWei = Number(depositRecord.expected_amount);

        // Skip if no funds received yet
        if (currentBalanceNumber === 0) {
          continue;
        }

        // 1% tolerance for small rounding/gas differences
        const tolerance = Math.floor(expectedAmountWei * 0.01);

        // CASE 1: UNDERPAYMENT - Partial funds received but not enough
        if (currentBalanceNumber > 0 && currentBalanceNumber < (expectedAmountWei - tolerance)) {
          const shortfall = expectedAmountWei - currentBalanceNumber;

          console.log(`[MonitorDeposits] Underpayment detected for ${depositRecord.deposit_address}: ${weiToUsdc(currentBalanceNumber)} USDC (expected: ${weiToUsdc(expectedAmountWei)}, shortfall: ${weiToUsdc(shortfall)})`);

          results.underpaid++;

          // Mark as underpaid - keep status='active' so user can send more
          await markAsUnderpaid(depositRecord.id, currentBalanceNumber, shortfall);

          // Log audit event for partial payment
          await supabase.from('crypto_audit_log').insert({
            event_type: 'deposit_underpaid',
            user_id: depositRecord.user_id,
            entity_type: 'deposit_address',
            entity_id: depositRecord.id,
            details: {
              deposit_address: depositRecord.deposit_address,
              expected_amount_wei: expectedAmountWei,
              received_amount_wei: currentBalanceNumber,
              shortfall_wei: shortfall,
            },
          });

          continue;
        }

        // CASE 2: SUFFICIENT FUNDS (possibly overpaid)
        if (currentBalanceNumber >= (expectedAmountWei - tolerance)) {
          console.log(`[MonitorDeposits] Payment detected for address ${depositRecord.deposit_address}: ${weiToUsdc(currentBalanceNumber)} USDC (expected: ${weiToUsdc(expectedAmountWei)})`);

          results.detected++;

          // Check for overpayment
          const isOverpaid = currentBalanceNumber > (expectedAmountWei + tolerance);
          const overpaymentAmount = isOverpaid ? currentBalanceNumber - expectedAmountWei : 0;

          if (isOverpaid) {
            console.log(`[MonitorDeposits] Overpayment detected: ${weiToUsdc(overpaymentAmount)} USDC extra`);
            results.overpaid++;
          }

          // Find transaction hash from blockchain events
          let txHash = '';
          try {
            const txEvent = await findDepositTransactionHash(depositRecord.deposit_address);
            if (txEvent) {
              txHash = txEvent.txHash;
              console.log(`[MonitorDeposits] Found tx hash: ${txHash}`);
            }
          } catch (err) {
            console.error(`[MonitorDeposits] Failed to find tx hash:`, err);
          }

          // Mark deposit address as received
          const markResult = await markDepositAddressReceived(
            depositRecord.id,
            currentBalanceNumber,
            txHash,
            {
              isOverpaid,
              overpaymentAmount,
            }
          );

          if (!markResult.success) {
            results.errors.push(`Failed to mark deposit ${depositRecord.id} as received`);
            continue;
          }

          // Update the associated payment intent
          if (depositRecord.payment_intent_id) {
            await supabase
              .from('payment_intents')
              .update({
                status: 'processing',
                funds_detected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {
                  ...(typeof depositRecord.metadata === 'object' ? depositRecord.metadata : {}),
                  deposit_detected_at: new Date().toISOString(),
                  deposit_amount_wei: currentBalanceNumber,
                  is_overpaid: isOverpaid,
                  overpayment_wei: overpaymentAmount,
                  tx_hash: txHash,
                },
              })
              .eq('id', depositRecord.payment_intent_id);

            // Log audit event
            await supabase.from('crypto_audit_log').insert({
              event_type: isOverpaid ? 'deposit_overpaid' : 'deposit_detected',
              user_id: depositRecord.user_id,
              entity_type: 'deposit_address',
              entity_id: depositRecord.id,
              details: {
                deposit_address: depositRecord.deposit_address,
                expected_amount_wei: expectedAmountWei,
                received_amount_wei: currentBalanceNumber,
                overpayment_wei: overpaymentAmount,
                payment_intent_id: depositRecord.payment_intent_id,
                tx_hash: txHash,
              },
            });

            // Trigger payment processing (complete the payment)
            await processDetectedPayment(supabase, depositRecord.payment_intent_id);
          }
        }
      } catch (error: any) {
        console.error(`[MonitorDeposits] Error processing address ${depositRecord.deposit_address}:`, error);
        results.errors.push(`Error processing ${depositRecord.deposit_address}: ${error.message}`);
      }
    }

    // Check for late payments on recently expired addresses
    await checkLatePayments(supabase, results);

    console.log(`[MonitorDeposits] Run complete. Processed: ${results.processed}, Detected: ${results.detected}, Underpaid: ${results.underpaid}, Overpaid: ${results.overpaid}, Late: ${results.latePayments}, Expired: ${results.expired}`);

    return NextResponse.json({
      success: true,
      message: 'Deposit monitoring complete',
      results,
    });
  } catch (error: any) {
    console.error('[MonitorDeposits] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Check expired addresses for late payments
 * Auto-accepts them with is_late flag
 */
async function checkLatePayments(supabase: any, results: { latePayments: number; errors: string[] }) {
  try {
    const expiredAddresses = await getExpiredAddressesForLateCheck();

    if (expiredAddresses.length === 0) {
      return;
    }

    console.log(`[MonitorDeposits] Checking ${expiredAddresses.length} expired addresses for late payments`);

    for (const expired of expiredAddresses) {
      try {
        // Check current balance
        const balanceWei = await getUsdcBalance(expired.deposit_address);
        const balanceNumber = Number(balanceWei);
        const expectedAmountWei = Number(expired.expected_amount);

        // Check if funds have arrived (with tolerance)
        const tolerance = Math.floor(expectedAmountWei * 0.01);

        if (balanceNumber >= (expectedAmountWei - tolerance)) {
          console.log(`[MonitorDeposits] Late payment detected for ${expired.deposit_address}: ${weiToUsdc(balanceNumber)} USDC`);

          results.latePayments++;

          // Check for overpayment on late arrival
          const isOverpaid = balanceNumber > (expectedAmountWei + tolerance);
          const overpaymentAmount = isOverpaid ? balanceNumber - expectedAmountWei : 0;

          // Find transaction hash
          let txHash = '';
          try {
            const txEvent = await findDepositTransactionHash(expired.deposit_address);
            if (txEvent) {
              txHash = txEvent.txHash;
            }
          } catch (err) {
            console.error(`[MonitorDeposits] Failed to find tx hash for late payment:`, err);
          }

          // Mark as received with late flag
          await markDepositAddressReceived(
            expired.id,
            balanceNumber,
            txHash,
            {
              isOverpaid,
              overpaymentAmount,
              isLate: true,
            }
          );

          // Log audit event
          await supabase.from('crypto_audit_log').insert({
            event_type: 'deposit_late',
            user_id: expired.user_id,
            entity_type: 'deposit_address',
            entity_id: expired.id,
            details: {
              deposit_address: expired.deposit_address,
              expected_amount_wei: expectedAmountWei,
              received_amount_wei: balanceNumber,
              expired_at: expired.expires_at,
              tx_hash: txHash,
            },
          });

          // Process the payment if there's an associated intent
          if (expired.payment_intent_id) {
            // Update the intent first
            await supabase
              .from('payment_intents')
              .update({
                status: 'processing',
                funds_detected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {
                  is_late: true,
                  late_arrival_detected_at: new Date().toISOString(),
                  deposit_amount_wei: balanceNumber,
                  tx_hash: txHash,
                },
              })
              .eq('id', expired.payment_intent_id);

            await processDetectedPayment(supabase, expired.payment_intent_id);
          }
        }
      } catch (error: any) {
        console.error(`[MonitorDeposits] Error checking late payment for ${expired.deposit_address}:`, error);
        results.errors.push(`Error checking late payment ${expired.deposit_address}: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error('[MonitorDeposits] Error in checkLatePayments:', error);
    results.errors.push(`Late payment check failed: ${error.message}`);
  }
}

/**
 * Process a detected payment
 * This completes the payment flow after funds are detected
 */
async function processDetectedPayment(supabase: any, paymentIntentId: string) {
  try {
    // Get the payment intent with user info
    const { data: intent, error: intentError } = await supabase
      .from('payment_intents')
      .select('*, deposit_addresses(*)')
      .eq('id', paymentIntentId)
      .single();

    if (intentError || !intent) {
      console.error('[MonitorDeposits] Payment intent not found:', paymentIntentId);
      return;
    }

    // Check if already completed
    if (intent.status === 'completed') {
      console.log(`[MonitorDeposits] Intent ${paymentIntentId} already completed`);
      return;
    }

    console.log(`[MonitorDeposits] Processing payment for intent ${paymentIntentId}, type: ${intent.intent_type}`);

    // Create USDC transaction record
    const { data: txRecord, error: txError } = await supabase
      .from('usdc_transactions')
      .insert({
        transaction_type: 'deposit',
        from_address: 'external', // User's external wallet (unknown)
        to_address: intent.deposit_addresses?.deposit_address || intent.user_wallet_address,
        amount: intent.amount_usdc,
        user_id: intent.user_id,
        related_payment_id: null, // Will be updated when payment record is created
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Process based on intent type
    switch (intent.intent_type) {
      case 'initial_unlock':
        await processInitialUnlock(supabase, intent, txRecord?.id);
        break;
      case 'monthly_subscription':
      case 'weekly_subscription':
        await processSubscriptionPayment(supabase, intent, txRecord?.id);
        break;
    }

    // Check for overpayment and create credit commission
    const depositAddress = intent.deposit_addresses;
    if (depositAddress?.is_overpaid && depositAddress?.overpayment_amount) {
      const overpaymentUsdc = weiToUsdc(Number(depositAddress.overpayment_amount));

      await supabase
        .from('commissions')
        .insert({
          referrer_id: intent.user_id,
          referred_id: intent.user_id,
          commission_type: 'overpayment_credit',
          amount: overpaymentUsdc,
          net_amount_usdc: overpaymentUsdc,
          status: 'pending',
          description: `Overpayment credit from ${intent.intent_type} payment`,
        });

      // Log audit event for overpayment credit
      await supabase.from('crypto_audit_log').insert({
        event_type: 'overpayment_credited',
        user_id: intent.user_id,
        entity_type: 'commission',
        details: {
          overpayment_amount_usdc: overpaymentUsdc,
          intent_type: intent.intent_type,
          payment_intent_id: intent.id,
        },
      });

      console.log(`[MonitorDeposits] Created overpayment credit of $${overpaymentUsdc} for user ${intent.user_id}`);
    }

    // Mark payment intent as completed
    await supabase
      .from('payment_intents')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        usdc_transaction_id: txRecord?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentIntentId);

    console.log(`[MonitorDeposits] Payment intent ${paymentIntentId} completed successfully`);

  } catch (error: any) {
    console.error(`[MonitorDeposits] Error processing payment ${paymentIntentId}:`, error);
    // Don't throw - we want to continue processing other deposits
  }
}

/**
 * Process initial unlock payment
 */
async function processInitialUnlock(supabase: any, intent: any, usdcTxId?: string) {
  const userId = intent.user_id;

  // 1. Assign network position if not already assigned
  await supabase.rpc('assign_network_position', { p_user_id: userId });

  // 2. Update user membership status
  await supabase
    .from('users')
    .update({
      membership_status: 'unlocked',
      is_active: true,
      initial_payment_completed: true,
      initial_payment_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // 3. Increment active count for upline
  await supabase.rpc('increment_upchain_active_count', { p_user_id: userId });

  // 4. Create payment record
  const { data: paymentRecord } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      amount: intent.amount_usdc,
      payment_type: 'initial',
      status: 'succeeded',
      payment_intent_id: intent.id,
      usdc_transaction_id: usdcTxId,
    })
    .select()
    .single();

  // Update USDC transaction with payment ID
  if (paymentRecord && usdcTxId) {
    await supabase
      .from('usdc_transactions')
      .update({ related_payment_id: paymentRecord.id })
      .eq('id', usdcTxId);
  }

  // 5. Update referral status if exists
  await supabase
    .from('referrals')
    .update({ status: 'active' })
    .eq('referred_id', userId);

  // 6. Create direct bonus commission for referrer
  const { data: referral } = await supabase
    .from('referrals')
    .select('referrer_id')
    .eq('referred_id', userId)
    .single();

  if (referral?.referrer_id) {
    const directBonusAmount = 249.50; // 50% of $499

    await supabase
      .from('commissions')
      .insert({
        referrer_id: referral.referrer_id,
        referred_id: userId,
        commission_type: 'direct_bonus',
        amount: directBonusAmount,
        status: 'pending',
      });

    console.log(`[MonitorDeposits] Created direct bonus commission of $${directBonusAmount} for referrer ${referral.referrer_id}`);
  }

  console.log(`[MonitorDeposits] Initial unlock completed for user ${userId}`);
}

/**
 * Process subscription payment
 */
async function processSubscriptionPayment(supabase: any, intent: any, usdcTxId?: string) {
  const userId = intent.user_id;
  const isMonthly = intent.intent_type === 'monthly_subscription';

  // 1. Update user active status
  await supabase
    .from('users')
    .update({ is_active: true })
    .eq('id', userId);

  // 2. Calculate next billing date
  const daysToAdd = isMonthly ? 30 : 7;
  const nextBillingDate = new Date();
  nextBillingDate.setDate(nextBillingDate.getDate() + daysToAdd);

  // 3. Create or update subscription
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (existingSub) {
    await supabase
      .from('subscriptions')
      .update({
        next_billing_date: nextBillingDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSub.id);
  } else {
    await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        payment_schedule: isMonthly ? 'monthly' : 'weekly',
        status: 'active',
        next_billing_date: nextBillingDate.toISOString(),
      });
  }

  // 4. Create payment record
  const { data: paymentRecord } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      amount: intent.amount_usdc,
      payment_type: isMonthly ? 'monthly' : 'weekly',
      status: 'succeeded',
      payment_intent_id: intent.id,
      usdc_transaction_id: usdcTxId,
    })
    .select()
    .single();

  // Update USDC transaction with payment ID
  if (paymentRecord && usdcTxId) {
    await supabase
      .from('usdc_transactions')
      .update({ related_payment_id: paymentRecord.id })
      .eq('id', usdcTxId);
  }

  // 5. Distribute to upline (residual commissions)
  await supabase.rpc('distribute_to_upline_batch', {
    p_user_id: userId,
    p_payment_amount: intent.amount_usdc,
  });

  console.log(`[MonitorDeposits] Subscription payment completed for user ${userId}`);
}

/**
 * GET /api/cron/monitor-deposits
 * Vercel cron jobs use GET requests, so this is the main cron entry point
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Vercel sends it as Bearer token)
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
    const results: {
      processed: number;
      detected: number;
      underpaid: number;
      overpaid: number;
      latePayments: number;
      expired: number;
      errors: string[];
    } = {
      processed: 0,
      detected: 0,
      underpaid: 0,
      overpaid: 0,
      latePayments: 0,
      expired: 0,
      errors: [],
    };

    console.log('[MonitorDeposits] Starting deposit monitoring run...');

    // Get active deposit addresses (with limit for scaling)
    const activeAddresses = await getActiveDepositAddresses(MAX_ADDRESSES_PER_RUN);

    if (activeAddresses.length === 0) {
      console.log('[MonitorDeposits] No active deposit addresses to monitor');
      // Still check for late payments on expired addresses
      await checkLatePayments(supabase, results);
      return NextResponse.json({
        success: true,
        message: 'No active deposit addresses',
        results,
      });
    }

    console.log(`[MonitorDeposits] Monitoring ${activeAddresses.length} active addresses (limit: ${MAX_ADDRESSES_PER_RUN})`);

    // First, expire old deposit addresses
    const { data: expiredCount } = await supabase.rpc('expire_old_deposit_addresses');
    results.expired = expiredCount || 0;

    // Also expire related payment intents
    await supabase.rpc('expire_old_payment_intents');

    // Process each active address
    for (const depositRecord of activeAddresses) {
      results.processed++;

      try {
        // Check if already expired
        if (new Date(depositRecord.expires_at) < new Date()) {
          // Mark as expired if not already
          await supabase
            .from('deposit_addresses')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', depositRecord.id)
            .eq('status', 'active');
          continue;
        }

        // Get current balance using event scanner (in smallest units)
        const currentBalanceWei = await getUsdcBalance(depositRecord.deposit_address);
        const currentBalanceNumber = Number(currentBalanceWei);

        // Expected amount is already in smallest units (BIGINT)
        const expectedAmountWei = Number(depositRecord.expected_amount);

        // Skip if no funds received yet
        if (currentBalanceNumber === 0) {
          continue;
        }

        // 1% tolerance for small rounding/gas differences
        const tolerance = Math.floor(expectedAmountWei * 0.01);

        // CASE 1: UNDERPAYMENT - Partial funds received but not enough
        if (currentBalanceNumber > 0 && currentBalanceNumber < (expectedAmountWei - tolerance)) {
          const shortfall = expectedAmountWei - currentBalanceNumber;

          console.log(`[MonitorDeposits] Underpayment detected for ${depositRecord.deposit_address}: ${weiToUsdc(currentBalanceNumber)} USDC (expected: ${weiToUsdc(expectedAmountWei)}, shortfall: ${weiToUsdc(shortfall)})`);

          results.underpaid++;

          // Mark as underpaid - keep status='active' so user can send more
          await markAsUnderpaid(depositRecord.id, currentBalanceNumber, shortfall);

          // Log audit event for partial payment
          await supabase.from('crypto_audit_log').insert({
            event_type: 'deposit_underpaid',
            user_id: depositRecord.user_id,
            entity_type: 'deposit_address',
            entity_id: depositRecord.id,
            details: {
              deposit_address: depositRecord.deposit_address,
              expected_amount_wei: expectedAmountWei,
              received_amount_wei: currentBalanceNumber,
              shortfall_wei: shortfall,
            },
          });

          continue;
        }

        // CASE 2: SUFFICIENT FUNDS (possibly overpaid)
        if (currentBalanceNumber >= (expectedAmountWei - tolerance)) {
          console.log(`[MonitorDeposits] Payment detected for address ${depositRecord.deposit_address}: ${weiToUsdc(currentBalanceNumber)} USDC (expected: ${weiToUsdc(expectedAmountWei)})`);

          results.detected++;

          // Check for overpayment
          const isOverpaid = currentBalanceNumber > (expectedAmountWei + tolerance);
          const overpaymentAmount = isOverpaid ? currentBalanceNumber - expectedAmountWei : 0;

          if (isOverpaid) {
            console.log(`[MonitorDeposits] Overpayment detected: ${weiToUsdc(overpaymentAmount)} USDC extra`);
            results.overpaid++;
          }

          // Find transaction hash from blockchain events
          let txHash = '';
          try {
            const txEvent = await findDepositTransactionHash(depositRecord.deposit_address);
            if (txEvent) {
              txHash = txEvent.txHash;
              console.log(`[MonitorDeposits] Found tx hash: ${txHash}`);
            }
          } catch (err) {
            console.error(`[MonitorDeposits] Failed to find tx hash:`, err);
          }

          // Mark deposit address as received
          const markResult = await markDepositAddressReceived(
            depositRecord.id,
            currentBalanceNumber,
            txHash,
            {
              isOverpaid,
              overpaymentAmount,
            }
          );

          if (!markResult.success) {
            results.errors.push(`Failed to mark deposit ${depositRecord.id} as received`);
            continue;
          }

          // Update the associated payment intent
          if (depositRecord.payment_intent_id) {
            await supabase
              .from('payment_intents')
              .update({
                status: 'processing',
                funds_detected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {
                  ...(typeof depositRecord.metadata === 'object' ? depositRecord.metadata : {}),
                  deposit_detected_at: new Date().toISOString(),
                  deposit_amount_wei: currentBalanceNumber,
                  is_overpaid: isOverpaid,
                  overpayment_wei: overpaymentAmount,
                  tx_hash: txHash,
                },
              })
              .eq('id', depositRecord.payment_intent_id);

            // Log audit event
            await supabase.from('crypto_audit_log').insert({
              event_type: isOverpaid ? 'deposit_overpaid' : 'deposit_detected',
              user_id: depositRecord.user_id,
              entity_type: 'deposit_address',
              entity_id: depositRecord.id,
              details: {
                deposit_address: depositRecord.deposit_address,
                expected_amount_wei: expectedAmountWei,
                received_amount_wei: currentBalanceNumber,
                overpayment_wei: overpaymentAmount,
                payment_intent_id: depositRecord.payment_intent_id,
                tx_hash: txHash,
              },
            });

            // Trigger payment processing (complete the payment)
            await processDetectedPayment(supabase, depositRecord.payment_intent_id);
          }
        }
      } catch (error: any) {
        console.error(`[MonitorDeposits] Error processing address ${depositRecord.deposit_address}:`, error);
        results.errors.push(`Error processing ${depositRecord.deposit_address}: ${error.message}`);
      }
    }

    // Check for late payments on recently expired addresses
    await checkLatePayments(supabase, results);

    console.log(`[MonitorDeposits] Run complete. Processed: ${results.processed}, Detected: ${results.detected}, Underpaid: ${results.underpaid}, Overpaid: ${results.overpaid}, Late: ${results.latePayments}, Expired: ${results.expired}`);

    return NextResponse.json({
      success: true,
      message: 'Deposit monitoring complete',
      results,
    });
  } catch (error: any) {
    console.error('[MonitorDeposits] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
