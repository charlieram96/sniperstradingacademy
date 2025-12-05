/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PAYMENT_AMOUNTS, PAYMENT_INTENT_EXPIRY } from '@/lib/coinbase/wallet-types';
import { checkRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit';
import {
  generateDepositAddress,
  getTreasurySetting,
  isTreasuryConfigured,
} from '@/lib/treasury/treasury-service';

export const runtime = 'nodejs';

/**
 * POST /api/crypto/payments/create-intent
 * Create a new payment intent for initial unlock or subscription payment
 * Now uses unique deposit addresses derived from treasury HD wallet
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

    // Parse request body
    const body = await req.json();
    const { intentType } = body;

    // Validate intent type
    if (!['initial_unlock', 'monthly_subscription', 'weekly_subscription'].includes(intentType)) {
      return NextResponse.json(
        { error: 'Invalid intent type' },
        { status: 400 }
      );
    }

    // Use service role client for database operations
    const serviceSupabase = createServiceRoleClient();

    // Get user data including payout wallet
    const { data: userData, error: userDataError } = await serviceSupabase
      .from('users')
      .select('initial_payment_completed, payout_wallet_address')
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

    // Determine amount based on intent type
    let amountUSDC: string;
    let expirySeconds: number;

    switch (intentType) {
      case 'initial_unlock':
        amountUSDC = PAYMENT_AMOUNTS.INITIAL_UNLOCK;
        expirySeconds = PAYMENT_INTENT_EXPIRY.INITIAL_UNLOCK;

        if (userData?.initial_payment_completed) {
          return NextResponse.json(
            { error: 'Initial payment already completed' },
            { status: 400 }
          );
        }
        break;

      case 'monthly_subscription':
        amountUSDC = PAYMENT_AMOUNTS.MONTHLY_SUBSCRIPTION;
        expirySeconds = PAYMENT_INTENT_EXPIRY.SUBSCRIPTION;
        break;

      case 'weekly_subscription':
        amountUSDC = PAYMENT_AMOUNTS.WEEKLY_SUBSCRIPTION;
        expirySeconds = PAYMENT_INTENT_EXPIRY.SUBSCRIPTION;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid intent type' },
          { status: 400 }
        );
    }

    // Check if treasury is configured
    const treasuryConfigured = await isTreasuryConfigured();
    if (!treasuryConfigured) {
      console.error('[CreateIntent] Treasury not configured');
      return NextResponse.json(
        { error: 'Payment system not configured. Please contact support.' },
        { status: 503 }
      );
    }

    // Get treasury wallet address for reference
    const treasuryWalletAddress = await getTreasurySetting('treasury_wallet_address');

    const now = new Date();
    const nowISO = now.toISOString();

    // Check for ANY existing intent with active status (regardless of expiry)
    // This is more defensive to prevent unique constraint violations
    const { data: existingIntents, error: existingError } = await serviceSupabase
      .from('payment_intents')
      .select('*')
      .eq('user_id', user.id)
      .eq('intent_type', intentType)
      .in('status', ['created', 'awaiting_funds', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1);

    console.log('[CreateIntent] Existing intent check:', {
      userId: user.id,
      intentType,
      found: existingIntents?.length || 0,
      error: existingError?.message,
      existingId: existingIntents?.[0]?.id,
      existingStatus: existingIntents?.[0]?.status,
      existingExpiresAt: existingIntents?.[0]?.expires_at,
      now: nowISO,
    });

    const existingIntent = existingIntents?.[0];

    if (existingIntent) {
      const expiresAt = new Date(existingIntent.expires_at);
      const isExpired = expiresAt < now;

      if (isExpired) {
        // Expire this intent first, then we can create a new one
        console.log('[CreateIntent] Expiring stale intent:', existingIntent.id);
        await serviceSupabase
          .from('payment_intents')
          .update({
            status: 'expired',
            updated_at: nowISO
          })
          .eq('id', existingIntent.id);
        // Continue to create a new intent below
      } else {
        // Intent is still valid, return it
        const { data: depositAddressData } = await serviceSupabase
          .from('deposit_addresses')
          .select('deposit_address')
          .eq('payment_intent_id', existingIntent.id)
          .single();

        const depositAddress = depositAddressData?.deposit_address || existingIntent.user_wallet_address;

        console.log('[CreateIntent] Returning existing valid intent:', existingIntent.id);
        return NextResponse.json({
          success: true,
          intent: existingIntent,
          depositAddress,
          qrCodeData: depositAddress,
          expiresIn: Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
        });
      }
    }

    // Create payment intent first (to get the ID for deposit address)
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    const { data: intent, error: intentError } = await serviceSupabase
      .from('payment_intents')
      .insert({
        user_id: user.id,
        intent_type: intentType,
        amount_usdc: amountUSDC,
        status: 'created',
        user_wallet_address: '', // Will be updated with deposit address
        platform_wallet_address: treasuryWalletAddress || '',
        expires_at: expiresAt.toISOString(),
        metadata: {
          created_via: 'api',
          user_agent: req.headers.get('user-agent') || 'unknown',
          simplified_crypto_system: true,
        },
      })
      .select()
      .single();

    if (intentError) {
      console.error('[CreateIntent] Failed to create intent:', intentError);
      return NextResponse.json(
        { error: 'Failed to create payment intent', details: intentError },
        { status: 500 }
      );
    }

    // Generate unique deposit address
    const depositResult = await generateDepositAddress(
      user.id,
      intent.id,
      intentType as 'initial_unlock' | 'monthly_subscription' | 'weekly_subscription',
      parseFloat(amountUSDC),
      expiresAt
    );

    if (!depositResult.success || !depositResult.data) {
      // Rollback the payment intent
      await serviceSupabase
        .from('payment_intents')
        .delete()
        .eq('id', intent.id);

      return NextResponse.json(
        { error: depositResult.error || 'Failed to generate deposit address' },
        { status: 500 }
      );
    }

    const { address: depositAddress, derivationIndex } = depositResult.data;

    // Update payment intent with deposit address info
    const { data: depositAddressRecord } = await serviceSupabase
      .from('deposit_addresses')
      .select('id')
      .eq('deposit_address', depositAddress)
      .single();

    const { error: updateError } = await serviceSupabase
      .from('payment_intents')
      .update({
        user_wallet_address: depositAddress, // Store deposit address for backwards compatibility
        deposit_address_id: depositAddressRecord?.id,
      })
      .eq('id', intent.id);

    if (updateError) {
      console.error('[CreateIntent] Failed to update intent with deposit address:', updateError);
    }

    console.log(`[CreateIntent] Created intent ${intent.id} for user ${user.id}: ${amountUSDC} USDC, deposit address index ${derivationIndex}`);

    // Return success with intent details
    return NextResponse.json({
      success: true,
      intent: {
        ...intent,
        user_wallet_address: depositAddress,
        deposit_address_id: depositAddressRecord?.id,
      },
      depositAddress,
      amountUSDC,
      qrCodeData: depositAddress,
      expiresIn: expirySeconds,
      instructions: {
        title: `Pay ${amountUSDC} USDC`,
        steps: [
          {
            step: 1,
            description: 'Open your crypto wallet (MetaMask, Coinbase Wallet, etc.)',
          },
          {
            step: 2,
            description: `Send exactly ${amountUSDC} USDC on the Polygon network to the address below`,
          },
          {
            step: 3,
            description: 'Wait for confirmation (usually under 2 minutes)',
          },
        ],
        note: 'Make sure you are sending USDC on the Polygon network. Sending on other networks may result in loss of funds.',
      },
    });
  } catch (error: any) {
    console.error('[CreateIntent] Unexpected error:', error);
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
 * Get active payment intents for current user
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

    // Get active intents with deposit address info
    const { data: intents, error: intentsError } = await supabase
      .from('payment_intents')
      .select('*, deposit_addresses(*)')
      .eq('user_id', user.id)
      .in('status', ['created', 'awaiting_funds', 'processing'])
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (intentsError) {
      return NextResponse.json(
        { error: 'Failed to fetch intents', details: intentsError },
        { status: 500 }
      );
    }

    // Add deposit address to each intent for convenience
    const intentsWithDepositAddress = intents?.map((intent: any) => ({
      ...intent,
      depositAddress: intent.deposit_addresses?.deposit_address || intent.user_wallet_address,
    }));

    return NextResponse.json({
      success: true,
      intents: intentsWithDepositAddress,
    });
  } catch (error: any) {
    console.error('[CreateIntent GET] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
