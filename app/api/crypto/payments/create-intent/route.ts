/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { coinbaseWalletService } from '@/lib/coinbase/wallet-service';
import { PAYMENT_AMOUNTS, PAYMENT_INTENT_EXPIRY } from '@/lib/coinbase/wallet-types';
import { checkRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit';

export const runtime = 'nodejs';

/**
 * POST /api/crypto/payments/create-intent
 * Create a new payment intent for initial unlock or subscription payment
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

    // Determine amount based on intent type
    let amountUSDC: string;
    let expirySeconds: number;

    switch (intentType) {
      case 'initial_unlock':
        amountUSDC = PAYMENT_AMOUNTS.INITIAL_UNLOCK;
        expirySeconds = PAYMENT_INTENT_EXPIRY.INITIAL_UNLOCK;

        // Check if user already completed initial payment
        const { data: userData } = await supabase
          .from('users')
          .select('initial_payment_completed')
          .eq('id', user.id)
          .single();

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

    // Get or create user's crypto wallet
    let walletResponse = await coinbaseWalletService.getWalletByUserId(user.id, supabase);

    if (!walletResponse.success) {
      // Create wallet if doesn't exist
      console.log('[CreateIntent] Creating new wallet for user:', user.id);
      walletResponse = await coinbaseWalletService.createWalletForUser(user.id, supabase);

      if (!walletResponse.success || !walletResponse.data) {
        return NextResponse.json(
          {
            error: 'Failed to create wallet',
            details: walletResponse.error?.message,
          },
          { status: 500 }
        );
      }
    }

    const userWallet = walletResponse.data;

    // Get platform wallet address (for receiving payments)
    const platformWalletAddress = process.env.PLATFORM_TREASURY_WALLET_ADDRESS;

    if (!platformWalletAddress) {
      console.error('[CreateIntent] Platform treasury wallet not configured');
      return NextResponse.json(
        { error: 'Platform wallet not configured' },
        { status: 500 }
      );
    }

    // Check for existing active intent
    const { data: existingIntent } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('user_id', user.id)
      .eq('intent_type', intentType)
      .in('status', ['created', 'awaiting_funds', 'processing'])
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingIntent) {
      // Return existing intent instead of creating duplicate
      return NextResponse.json({
        success: true,
        intent: existingIntent,
        userWalletAddress: userWallet.wallet_address,
        qrCodeData: userWallet.wallet_address, // For QR code generation
        expiresIn: Math.floor((new Date(existingIntent.expires_at).getTime() - Date.now()) / 1000),
      });
    }

    // Create payment intent
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    const { data: intent, error: intentError } = await supabase
      .from('payment_intents')
      .insert({
        user_id: user.id,
        intent_type: intentType,
        amount_usdc: amountUSDC,
        status: 'created',
        user_wallet_address: userWallet.wallet_address,
        platform_wallet_address: platformWalletAddress,
        expires_at: expiresAt.toISOString(),
        metadata: {
          created_via: 'api',
          user_agent: req.headers.get('user-agent') || 'unknown',
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

    console.log(`[CreateIntent] Created intent ${intent.id} for user ${user.id}: ${amountUSDC} USDC`);

    // Return success with intent details
    return NextResponse.json({
      success: true,
      intent,
      userWalletAddress: userWallet.wallet_address,
      platformWalletAddress,
      amountUSDC,
      qrCodeData: userWallet.wallet_address,
      expiresIn: expirySeconds,
      instructions: {
        title: `Pay ${amountUSDC} USDC`,
        steps: [
          {
            step: 1,
            description: intentType === 'initial_unlock'
              ? 'Buy USDC using the widget below, OR send USDC from your external wallet'
              : 'Send USDC from your wallet to complete payment',
          },
          {
            step: 2,
            description: `Send exactly ${amountUSDC} USDC to your wallet address`,
          },
          {
            step: 3,
            description: 'Wait for confirmation (usually under 30 seconds)',
          },
        ],
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
export async function GET(req: NextRequest) {
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

    // Get active intents
    const { data: intents, error: intentsError } = await supabase
      .from('payment_intents')
      .select('*')
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

    return NextResponse.json({
      success: true,
      intents,
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
