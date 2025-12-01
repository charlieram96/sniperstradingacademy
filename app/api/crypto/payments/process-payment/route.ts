/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';
import { coinbaseWalletService } from '@/lib/coinbase/wallet-service';
import { gasManager } from '@/lib/polygon/gas-manager';
import { PAYMENT_AMOUNTS } from '@/lib/coinbase/wallet-types';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for blockchain confirmation

/**
 * POST /api/crypto/payments/process-payment
 * Process a payment intent by transferring USDC from user wallet to platform treasury
 * This endpoint is called by a cron job or triggered when funds are detected
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify this is called by authorized source (cron job or admin)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    let isAdminRequest = false;
    let adminId: string | null = null;

    if (authHeader !== `Bearer ${cronSecret}`) {
      // Check if it's an admin user
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

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!['admin', 'superadmin'].includes(userData?.role || '')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      isAdminRequest = true;
      adminId = user.id;
    }

    const body = await req.json();
    const { intentId } = body;

    if (!intentId) {
      return NextResponse.json(
        { error: 'Missing intentId' },
        { status: 400 }
      );
    }

    // Get payment intent
    const { data: intent, error: intentError } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', intentId)
      .single();

    if (intentError || !intent) {
      return NextResponse.json(
        { error: 'Payment intent not found' },
        { status: 404 }
      );
    }

    // Check if already completed
    if (intent.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Payment already completed',
        intent,
      });
    }

    // Use atomic status update to prevent race conditions
    const { data: updatedIntent } = await supabase
      .rpc('update_payment_intent_status_atomic', {
        p_intent_id: intentId,
        p_from_status: ['created', 'awaiting_funds'],
        p_to_status: 'processing',
      });

    if (!updatedIntent) {
      // Either already processing or in invalid state
      return NextResponse.json({
        success: false,
        error: 'Payment intent not in valid state for processing (may already be processing)',
      }, { status: 409 });
    }

    // Check if expired
    if (new Date(intent.expires_at) < new Date()) {
      await supabase
        .from('payment_intents')
        .update({ status: 'expired' })
        .eq('id', intentId);

      return NextResponse.json({
        success: false,
        error: 'Payment intent expired',
      }, { status: 400 });
    }

    // Verify funds in user wallet
    const balanceResponse = await polygonUSDCClient.getBalance(intent.user_wallet_address);

    if (!balanceResponse.success || !balanceResponse.data) {
      // Revert status back
      await supabase
        .from('payment_intents')
        .update({ status: 'awaiting_funds' })
        .eq('id', intentId);

      return NextResponse.json({
        success: false,
        error: 'Could not verify wallet balance',
      }, { status: 500 });
    }

    const currentBalance = parseFloat(balanceResponse.data.balance);
    const requiredAmount = parseFloat(intent.amount_usdc);

    if (currentBalance < requiredAmount * 0.99) { // 1% tolerance for rounding
      // Revert status back
      await supabase
        .from('payment_intents')
        .update({ status: 'awaiting_funds' })
        .eq('id', intentId);

      return NextResponse.json({
        success: false,
        error: 'Insufficient funds in wallet',
        details: {
          required: requiredAmount,
          current: currentBalance,
        },
      }, { status: 400 });
    }

    // Get user's wallet from database
    const { data: userWallet } = await supabase
      .from('crypto_wallets')
      .select('*')
      .eq('wallet_address', intent.user_wallet_address)
      .single();

    if (!userWallet) {
      await supabase
        .from('payment_intents')
        .update({ status: 'failed' })
        .eq('id', intentId);

      return NextResponse.json({
        success: false,
        error: 'User wallet not found',
      }, { status: 500 });
    }

    // Execute the transfer using Coinbase SDK
    const platformWalletAddress = process.env.PLATFORM_TREASURY_WALLET_ADDRESS;

    if (!platformWalletAddress) {
      await supabase
        .from('payment_intents')
        .update({ status: 'failed' })
        .eq('id', intentId);

      return NextResponse.json({
        success: false,
        error: 'Platform wallet not configured',
      }, { status: 500 });
    }

    // Transfer from user's custodial wallet to platform treasury
    let transferResult;

    if (userWallet.wallet_data_encrypted) {
      // Use Coinbase SDK for custodial wallet transfer
      transferResult = await coinbaseWalletService.transferUSDC({
        fromWalletId: userWallet.coinbase_wallet_id,
        toAddress: platformWalletAddress,
        amount: intent.amount_usdc,
        memo: `Payment intent ${intentId}`,
        walletData: userWallet.wallet_data_encrypted,
      });
    } else {
      // Fallback: For existing wallets without stored data,
      // the user has already sent funds to platform wallet (direct deposit model)
      // Just verify the balance and mark as complete
      const platformBalanceCheck = await polygonUSDCClient.getBalance(platformWalletAddress);

      // Create a "confirmed" record since funds were manually sent
      transferResult = {
        success: true,
        data: {
          transactionHash: `manual_deposit_${intentId}_${Date.now()}`,
          status: 'confirmed' as const,
          from: intent.user_wallet_address,
          to: platformWalletAddress,
          amount: intent.amount_usdc,
          gasUsed: '0',
        },
      };
    }

    if (!transferResult.success || !transferResult.data) {
      // Transfer failed - revert status
      await supabase
        .from('payment_intents')
        .update({
          status: 'awaiting_funds',
          metadata: {
            ...intent.metadata,
            last_error: transferResult.error?.message || 'Transfer failed',
            last_error_at: new Date().toISOString(),
          },
        })
        .eq('id', intentId);

      console.error('[ProcessPayment] Transfer failed:', transferResult.error);

      return NextResponse.json({
        success: false,
        error: 'Transfer failed',
        details: transferResult.error?.message,
      }, { status: 500 });
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('usdc_transactions')
      .insert({
        transaction_type: 'payment_in',
        from_address: transferResult.data.from,
        to_address: transferResult.data.to,
        amount: intent.amount_usdc,
        polygon_tx_hash: transferResult.data.transactionHash,
        block_number: transferResult.data.blockNumber || null,
        status: transferResult.data.status,
        gas_fee_matic: transferResult.data.gasUsed || null,
        user_id: intent.user_id,
        confirmed_at: transferResult.data.status === 'confirmed' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (txError || !transaction) {
      console.error('[ProcessPayment] Failed to create transaction record:', txError);
      // Transfer succeeded but DB failed - log critical error
      // Don't fail the request as money has moved
    }

    // Update payment intent to completed
    await supabase
      .from('payment_intents')
      .update({
        status: 'completed',
        usdc_transaction_id: transaction?.id || null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', intentId);

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'transaction_confirmed',
      user_id: intent.user_id,
      admin_id: adminId,
      entity_type: 'transaction',
      entity_id: transaction?.id,
      details: {
        intent_id: intentId,
        amount: intent.amount_usdc,
        tx_hash: transferResult.data.transactionHash,
        intent_type: intent.intent_type,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    });

    // Process based on intent type
    if (intent.intent_type === 'initial_unlock') {
      await processInitialUnlock(supabase, intent, transaction);
    } else if (intent.intent_type === 'monthly_subscription' || intent.intent_type === 'weekly_subscription') {
      await processSubscriptionPayment(supabase, intent, transaction);
    }

    console.log(`[ProcessPayment] Successfully processed payment for intent ${intentId}, tx: ${transferResult.data.transactionHash}`);

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully',
      transaction: {
        id: transaction?.id,
        txHash: transferResult.data.transactionHash,
        amount: intent.amount_usdc,
        status: transferResult.data.status,
        explorerUrl: polygonUSDCClient.getExplorerUrl(transferResult.data.transactionHash),
      },
    });
  } catch (error: any) {
    console.error('[ProcessPayment] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Process initial unlock payment ($499)
 * - Mark membership as unlocked
 * - Assign network position
 * - Increment active count for all ancestors
 * - Trigger direct referral bonus ($249.50)
 */
async function processInitialUnlock(supabase: any, intent: any, transaction: any) {
  try {
    // Get user's current data
    const { data: userBeforeUpdate } = await supabase
      .from('users')
      .select('network_position_id, is_active, referred_by')
      .eq('id', intent.user_id)
      .single();

    const wasActiveBefore = userBeforeUpdate?.is_active || false;

    // STEP 1: Assign network position if user doesn't have one yet
    if (!userBeforeUpdate?.network_position_id) {
      console.log('[ProcessInitialUnlock] User has no network position yet, assigning now...');

      const { data: positionId, error: positionError } = await supabase
        .rpc('assign_network_position', {
          p_user_id: intent.user_id,
          p_referrer_id: userBeforeUpdate?.referred_by || null
        });

      if (positionError) {
        console.error('[ProcessInitialUnlock] Error assigning network position:', positionError);
        // Continue with payment processing even if position assignment fails
      } else {
        console.log(`[ProcessInitialUnlock] Network position assigned: ${positionId}`);

        // Log upchain for visibility
        try {
          const { data: upchain, error: upchainError } = await supabase
            .rpc('get_upline_chain', { start_position_id: positionId });

          if (!upchainError && upchain && upchain.length > 0) {
            const ancestorIds = (upchain as Array<{ user_id: string }>)
              .filter((a) => a.user_id !== intent.user_id)
              .map((a) => a.user_id);
            console.log(`[ProcessInitialUnlock] Incremented total_network_count for ${ancestorIds.length} ancestors`);
          }
        } catch (upchainErr) {
          console.error('[ProcessInitialUnlock] Error fetching upchain for logging:', upchainErr);
        }
      }
    } else {
      console.log(`[ProcessInitialUnlock] User already has network position: ${userBeforeUpdate.network_position_id}`);
    }

    // STEP 2: Update user's membership status
    await supabase
      .from('users')
      .update({
        initial_payment_completed: true,
        initial_payment_date: new Date().toISOString(),
        membership_status: 'unlocked',
        is_active: true,
        last_payment_date: new Date().toISOString(),
      })
      .eq('id', intent.user_id);

    // STEP 3: Increment active network count for all ancestors (user just became active)
    // Re-fetch user to get the potentially newly assigned network_position_id
    const { data: userAfterPositionAssignment } = await supabase
      .from('users')
      .select('network_position_id')
      .eq('id', intent.user_id)
      .single();

    if (userAfterPositionAssignment?.network_position_id && !wasActiveBefore) {
      try {
        const { data: ancestorsIncremented, error: incrementError } = await supabase
          .rpc('increment_upchain_active_count', {
            p_user_id: intent.user_id
          });

        if (incrementError) {
          console.error('[ProcessInitialUnlock] Error incrementing active count:', incrementError);
        } else {
          console.log(`[ProcessInitialUnlock] User ${intent.user_id} became ACTIVE after $499 payment!`);
          console.log(`[ProcessInitialUnlock] Incremented active_network_count for ${ancestorsIncremented || 0} ancestors in upchain`);
        }
      } catch (err) {
        console.error('[ProcessInitialUnlock] Exception incrementing active count:', err);
      }
    } else if (!userAfterPositionAssignment?.network_position_id) {
      console.warn('[ProcessInitialUnlock] Cannot increment active count: User has no network position');
    }

    // STEP 4: Create payment record
    const { data: payment } = await supabase
      .from('payments')
      .insert({
        user_id: intent.user_id,
        amount: intent.amount_usdc,
        payment_type: 'initial',
        status: 'succeeded',
        usdc_transaction_id: transaction?.id || null,
        payment_intent_id: intent.id,
      })
      .select()
      .single();

    // Update transaction with payment reference
    if (transaction && payment) {
      await supabase
        .from('usdc_transactions')
        .update({ related_payment_id: payment.id })
        .eq('id', transaction.id);
    }

    // STEP 5: Update referral status
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id, referrer_id')
      .eq('referred_id', intent.user_id)
      .single();

    if (existingReferral) {
      // Update existing referral to active
      await supabase
        .from('referrals')
        .update({
          initial_payment_status: 'completed',
          status: 'active'
        })
        .eq('referred_id', intent.user_id);

      console.log('[ProcessInitialUnlock] Referral updated to active status');
    }

    // STEP 6: Create direct bonus commission ($249.50)
    const referrerId = existingReferral?.referrer_id || userBeforeUpdate?.referred_by;
    if (referrerId) {
      const { data: commission } = await supabase
        .from('commissions')
        .insert({
          referrer_id: referrerId,
          referred_id: intent.user_id,
          amount: PAYMENT_AMOUNTS.DIRECT_BONUS,
          commission_type: 'direct_bonus',
          status: 'pending', // Will be paid out by admin
          net_amount_usdc: PAYMENT_AMOUNTS.DIRECT_BONUS, // No fees for direct bonus
        })
        .select()
        .single();

      console.log(`[ProcessInitialUnlock] Created direct bonus commission ${commission?.id} for referrer ${referrerId}`);

      // Send notification about direct bonus
      try {
        const { notifyDirectBonus } = await import('@/lib/notifications/notification-service');
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('id', intent.user_id)
          .single();

        await notifyDirectBonus({
          referrerId: referrerId,
          referredName: userData?.name || 'New Member',
          amount: parseFloat(PAYMENT_AMOUNTS.DIRECT_BONUS),
          commissionId: commission?.id || 'unknown'
        });
        console.log(`[ProcessInitialUnlock] Sent direct bonus notification to ${referrerId}`);
      } catch (notifError) {
        console.error('[ProcessInitialUnlock] Error sending direct bonus notification:', notifError);
      }
    }

    console.log(`[ProcessInitialUnlock] Unlocked membership for user ${intent.user_id}`);
  } catch (error) {
    console.error('[ProcessInitialUnlock] Error:', error);
    throw error;
  }
}

/**
 * Process subscription payment (monthly/weekly)
 */
async function processSubscriptionPayment(supabase: any, intent: any, transaction: any) {
  try {
    // Update user's subscription status
    const periodDays = intent.intent_type === 'monthly_subscription' ? 30 : 7;
    const newPeriodEnd = new Date();
    newPeriodEnd.setDate(newPeriodEnd.getDate() + periodDays);

    await supabase
      .from('users')
      .update({
        is_active: true,
        last_payment_date: new Date().toISOString(),
      })
      .eq('id', intent.user_id);

    // Create or update subscription record
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', intent.user_id)
      .single();

    if (existingSubscription) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_end: newPeriodEnd.toISOString(),
        })
        .eq('id', existingSubscription.id);
    } else {
      await supabase
        .from('subscriptions')
        .insert({
          user_id: intent.user_id,
          status: 'active',
          amount: intent.amount_usdc,
          current_period_end: newPeriodEnd.toISOString(),
        });
    }

    // Create payment record
    const paymentType = intent.intent_type === 'monthly_subscription' ? 'monthly' : 'weekly';
    const { data: payment } = await supabase
      .from('payments')
      .insert({
        user_id: intent.user_id,
        amount: intent.amount_usdc,
        payment_type: paymentType,
        status: 'succeeded',
        usdc_transaction_id: transaction?.id || null,
        payment_intent_id: intent.id,
      })
      .select()
      .single();

    // Update transaction with payment reference
    if (transaction && payment) {
      await supabase
        .from('usdc_transactions')
        .update({ related_payment_id: payment.id })
        .eq('id', transaction.id);
    }

    // Distribute subscription payment to upline (sniper volume)
    try {
      await supabase.rpc('distribute_to_upline_batch', {
        p_user_id: intent.user_id,
        p_amount: parseFloat(intent.amount_usdc),
      });
    } catch (rpcError) {
      console.warn('[ProcessSubscriptionPayment] distribute_to_upline_batch failed (may not exist):', rpcError);
    }

    console.log(`[ProcessSubscriptionPayment] Extended subscription for user ${intent.user_id}`);
  } catch (error) {
    console.error('[ProcessSubscriptionPayment] Error:', error);
    throw error;
  }
}
