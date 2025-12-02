/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { transfiClient } from '@/lib/transfi/client';
import { checkRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit';

export const runtime = 'nodejs';

/**
 * POST /api/crypto/on-ramp/create-session
 * Create a TransFi on-ramp session for fiat-to-crypto payment
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
    const { walletAddress, amount, intentId, email, useRedirect } = body;

    // Validate required fields
    if (!walletAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress and amount' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Check if TransFi is configured
    if (!transfiClient.isConfigured()) {
      transfiClient.initialize();
      if (!transfiClient.isConfigured()) {
        return NextResponse.json(
          {
            error: 'Fiat payment not available',
            message: 'TransFi integration is not configured. Please contact support.',
          },
          { status: 503 }
        );
      }
    }

    // Get user's email for KYC
    const userEmail = email || user.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Email is required for fiat payments' },
        { status: 400 }
      );
    }

    // Generate redirect URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || '';
    const redirectUrl = useRedirect
      ? `${baseUrl}/payment/complete?intentId=${intentId || ''}`
      : undefined;

    // Create TransFi widget URL (no server-side session creation needed)
    const widgetResponse = transfiClient.createWidgetUrl({
      userId: user.id,
      email: userEmail,
      walletAddress,
      cryptoCurrency: 'USDC',
      cryptoNetwork: 'polygon',
      fiatAmount: amount,
      fiatCurrency: 'USD',
      redirectUrl,
      partnerContext: {
        intentId,
        platform: 'tradinghub',
      },
    });

    if (!widgetResponse.success || !widgetResponse.data) {
      console.error('[OnRamp] Widget URL creation failed:', widgetResponse.error);
      return NextResponse.json(
        {
          success: false,
          error: widgetResponse.error?.message || 'Failed to create payment widget',
          details: widgetResponse.error,
        },
        { status: 500 }
      );
    }

    // Generate a local session ID for tracking
    const localSessionId = `onramp_${Date.now()}_${user.id.substring(0, 8)}`;
    const session = {
      ...widgetResponse.data,
      sessionId: localSessionId,
    };

    // Save session to database
    const serviceSupabase = createServiceRoleClient();
    const { data: dbSession, error: dbError } = await serviceSupabase
      .from('on_ramp_sessions')
      .insert({
        user_id: user.id,
        provider: 'transfi',
        provider_session_id: session.sessionId,
        destination_wallet_address: walletAddress,
        crypto_amount: amountNum,
        fiat_currency: 'USD',
        status: 'initiated',
        metadata: {
          intent_id: intentId,
          widget_url: session.widgetUrl,
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('[OnRamp] Database error:', dbError);
      // Continue anyway - the session was created with TransFi
    }

    // If we have an intent, link the on-ramp session to it
    if (intentId && dbSession) {
      await serviceSupabase
        .from('payment_intents')
        .update({
          on_ramp_session_id: dbSession.id,
          status: 'awaiting_funds',
          updated_at: new Date().toISOString(),
        })
        .eq('id', intentId)
        .eq('user_id', user.id);
    }

    // Log audit event
    await serviceSupabase.from('crypto_audit_log').insert({
      event_type: 'on_ramp_initiated',
      user_id: user.id,
      entity_type: 'on_ramp_session',
      entity_id: dbSession?.id || session.sessionId,
      details: {
        provider: 'transfi',
        amount,
        wallet_address: walletAddress,
        intent_id: intentId,
      },
    });

    console.log(`[OnRamp] Created session ${session.sessionId} for user ${user.id}: $${amount} USDC`);

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      widgetUrl: session.widgetUrl,
      databaseSessionId: dbSession?.id,
    });
  } catch (error: any) {
    console.error('[OnRamp] Unexpected error:', error);
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
 * GET /api/crypto/on-ramp/create-session
 * Get status of an on-ramp session
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

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      // Return all active sessions for user
      const { data: sessions, error } = await supabase
        .from('on_ramp_sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['initiated', 'pending'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch sessions', details: error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        sessions,
      });
    }

    // Get specific session
    const { data: session, error: sessionError } = await supabase
      .from('on_ramp_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider_session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // TransFi widget approach doesn't have server-side session status
    // Status is tracked via webhooks

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    console.error('[OnRamp GET] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
