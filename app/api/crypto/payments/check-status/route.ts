import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';

export const runtime = 'nodejs';

/**
 * GET /api/crypto/payments/check-status?intentId=xxx
 * Check payment status and wallet balance for a payment intent
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

    // Get intent ID from query params
    const { searchParams } = new URL(req.url);
    const intentId = searchParams.get('intentId');

    if (!intentId) {
      return NextResponse.json(
        { error: 'Missing intentId parameter' },
        { status: 400 }
      );
    }

    // Get payment intent
    const { data: intent, error: intentError } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', intentId)
      .eq('user_id', user.id) // Security: ensure user owns this intent
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
        intent,
        status: 'completed',
        fundsDetected: true,
        message: 'Payment already completed',
      });
    }

    // Check if expired
    if (new Date(intent.expires_at) < new Date()) {
      // Mark as expired if not already
      if (intent.status !== 'expired') {
        await supabase
          .from('payment_intents')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', intentId);
      }

      return NextResponse.json({
        success: true,
        intent: { ...intent, status: 'expired' },
        status: 'expired',
        fundsDetected: false,
        message: 'Payment intent expired',
      });
    }

    // Check wallet balance
    const balanceResponse = await polygonUSDCClient.getBalance(intent.user_wallet_address);

    if (!balanceResponse.success || !balanceResponse.data) {
      console.error('[CheckStatus] Failed to check balance:', balanceResponse.error);
      return NextResponse.json({
        success: true,
        intent,
        status: intent.status,
        fundsDetected: false,
        error: 'Could not check wallet balance',
      });
    }

    const currentBalance = parseFloat(balanceResponse.data.balance);
    const requiredAmount = parseFloat(intent.amount_usdc);

    // Check if sufficient funds detected
    const fundsDetected = currentBalance >= requiredAmount;

    let updatedIntent = intent;

    if (fundsDetected && intent.status === 'created') {
      // Update status to awaiting_funds
      const { data: updated, error: updateError } = await supabase
        .from('payment_intents')
        .update({
          status: 'awaiting_funds',
          funds_detected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', intentId)
        .select()
        .single();

      if (!updateError && updated) {
        updatedIntent = updated;
        console.log(`[CheckStatus] Funds detected for intent ${intentId}: ${currentBalance} USDC`);
      }
    }

    return NextResponse.json({
      success: true,
      intent: updatedIntent,
      walletBalance: balanceResponse.data.balance,
      requiredAmount: intent.amount_usdc,
      fundsDetected,
      status: updatedIntent.status,
      expiresIn: Math.floor((new Date(intent.expires_at).getTime() - Date.now()) / 1000),
    });
  } catch (error: unknown) {
    console.error('[CheckStatus] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
