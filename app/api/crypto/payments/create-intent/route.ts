/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PAYMENT_AMOUNTS } from '@/lib/coinbase/wallet-types';
import { checkRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit';
import {
  getOrCreateUserDepositAddress,
  getUserPaymentSchedule,
  isTreasuryConfigured,
} from '@/lib/treasury/treasury-service';

export const runtime = 'nodejs';

/**
 * POST /api/crypto/payments/create-intent
 * Get user's permanent deposit address and expected payment amount
 * Payment type is determined by user's status, not request params
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit check
    const rateLimitResponse = await checkRateLimit(req, RATE_LIMITS.payment);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createClient();

    // Get authenticated user
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

    // Use service role client for database operations
    const serviceSupabase = createServiceRoleClient();

    // Get user data
    const { data: userData, error: userDataError } = await serviceSupabase
      .from('users')
      .select(`
        initial_payment_completed,
        bypass_initial_payment,
        payout_wallet_address,
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

    // Check if user has payout wallet configured (required before any payment)
    if (!userData.payout_wallet_address) {
      return NextResponse.json(
        {
          error: 'Payout wallet required',
          code: 'PAYOUT_WALLET_REQUIRED',
          message: 'Please set your payout wallet address before making a payment. This is where you will receive commissions and bonuses.',
        },
        { status: 400 }
      );
    }

    // Check if treasury is configured
    const treasuryConfigured = await isTreasuryConfigured();
    if (!treasuryConfigured) {
      console.error('[GetDepositAddress] Treasury not configured');
      return NextResponse.json(
        { error: 'Payment system not configured. Please contact support.' },
        { status: 503 }
      );
    }

    // Determine what the user needs to pay
    const needsInitialPayment = !userData.initial_payment_completed && !userData.bypass_initial_payment;

    let paymentType: 'initial_unlock' | 'subscription';
    let amountUSDC: string;

    if (needsInitialPayment) {
      paymentType = 'initial_unlock';
      amountUSDC = PAYMENT_AMOUNTS.INITIAL_UNLOCK;
    } else {
      paymentType = 'subscription';
      // Get user's subscription schedule to determine amount
      const schedule = await getUserPaymentSchedule(user.id);
      amountUSDC = schedule === 'weekly'
        ? PAYMENT_AMOUNTS.WEEKLY_SUBSCRIPTION
        : PAYMENT_AMOUNTS.MONTHLY_SUBSCRIPTION;
    }

    // Get or create permanent deposit address
    const depositResult = await getOrCreateUserDepositAddress(user.id);

    if (!depositResult.success || !depositResult.data) {
      return NextResponse.json(
        { error: depositResult.error || 'Failed to get deposit address' },
        { status: 500 }
      );
    }

    const { address: depositAddress } = depositResult.data;

    console.log(`[GetDepositAddress] User ${user.id}: ${paymentType}, ${amountUSDC} USDC, address: ${depositAddress}`);

    // Return deposit address and payment info
    return NextResponse.json({
      success: true,
      depositAddress,
      amountUSDC,
      paymentType,
      qrCodeData: depositAddress,
      // No expiration for permanent addresses
      instructions: {
        title: paymentType === 'initial_unlock'
          ? `Unlock Membership - Pay ${amountUSDC} USDC`
          : `Subscription Payment - Pay ${amountUSDC} USDC`,
        steps: [
          {
            step: 1,
            description: 'Open your crypto wallet (MetaMask, Coinbase Wallet, etc.)',
          },
          {
            step: 2,
            description: `Send exactly ${amountUSDC} USDC on the Polygon network to your deposit address`,
          },
          {
            step: 3,
            description: 'Wait for confirmation (usually under 2 minutes)',
          },
        ],
        note: 'Make sure you are sending USDC on the Polygon network. This is your permanent deposit address - you can save it for future payments.',
      },
    });
  } catch (error: any) {
    console.error('[GetDepositAddress] Unexpected error:', error);
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
 * GET /api/crypto/payments/create-intent
 * Get user's current deposit address and payment status
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

    // Determine what the user needs to pay
    const needsInitialPayment = !userData.initial_payment_completed && !userData.bypass_initial_payment;

    let paymentType: 'initial_unlock' | 'subscription' | 'none';
    let amountUSDC: string | null = null;

    if (needsInitialPayment) {
      paymentType = 'initial_unlock';
      amountUSDC = PAYMENT_AMOUNTS.INITIAL_UNLOCK;
    } else if (!userData.is_active) {
      paymentType = 'subscription';
      const schedule = await getUserPaymentSchedule(user.id);
      amountUSDC = schedule === 'weekly'
        ? PAYMENT_AMOUNTS.WEEKLY_SUBSCRIPTION
        : PAYMENT_AMOUNTS.MONTHLY_SUBSCRIPTION;
    } else {
      paymentType = 'none';
    }

    return NextResponse.json({
      success: true,
      depositAddress: userData.crypto_deposit_address,
      paymentType,
      amountUSDC,
      needsPayment: paymentType !== 'none',
    });
  } catch (error: any) {
    console.error('[GetDepositAddress GET] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
