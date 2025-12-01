/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { transfiClient, WebhookPayload } from '@/lib/transfi/client';

export const runtime = 'nodejs';

// Disable body parsing for webhook signature verification
export const dynamic = 'force-dynamic';

/**
 * POST /api/crypto/on-ramp/webhook
 * Handle TransFi webhook events for on-ramp status updates
 */
export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature
    const signature = req.headers.get('x-transfi-signature') || '';

    // Initialize client if needed
    if (!transfiClient.isConfigured()) {
      transfiClient.initialize();
    }

    // Verify signature in production (skip in development for testing)
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !transfiClient.verifyWebhookSignature(rawBody, signature)) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const payload = transfiClient.parseWebhookPayload(rawBody);

    if (!payload) {
      console.error('[Webhook] Failed to parse payload');
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received event: ${payload.event} for order: ${payload.orderId}`);

    // Process the webhook event
    const result = await processWebhookEvent(payload);

    if (!result.success) {
      console.error('[Webhook] Processing failed:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error: any) {
    console.error('[Webhook] Unexpected error:', error);
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
 * Process webhook event and update database
 */
async function processWebhookEvent(
  payload: WebhookPayload
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();
  const { event, orderId, sessionId, data } = payload;

  try {
    // Find the on-ramp session by provider session ID
    const { data: session, error: sessionError } = await supabase
      .from('on_ramp_sessions')
      .select('*, payment_intents!on_ramp_session_id(*)')
      .eq('provider_session_id', sessionId)
      .single();

    if (sessionError) {
      // Try finding by order ID in metadata
      const { data: sessionByOrder } = await supabase
        .from('on_ramp_sessions')
        .select('*, payment_intents!on_ramp_session_id(*)')
        .eq('provider_order_id', orderId)
        .single();

      if (!sessionByOrder) {
        console.error('[Webhook] Session not found for:', sessionId, orderId);
        return { success: false, error: 'Session not found' };
      }
    }

    const currentSession = session || null;
    if (!currentSession) {
      return { success: false, error: 'Session not found' };
    }

    // Map TransFi status to our status
    let newStatus: string;
    switch (event) {
      case 'order.created':
        newStatus = 'pending';
        break;
      case 'order.processing':
        newStatus = 'pending';
        break;
      case 'order.completed':
        newStatus = 'completed';
        break;
      case 'order.failed':
        newStatus = 'failed';
        break;
      case 'order.cancelled':
        newStatus = 'cancelled';
        break;
      default:
        console.log('[Webhook] Unknown event type:', event);
        return { success: true }; // Acknowledge unknown events
    }

    // Update on-ramp session
    const updateData: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Add order ID if not set
    if (orderId && !currentSession.provider_order_id) {
      updateData.provider_order_id = orderId;
    }

    // Add financial details if provided
    if (data.fiatAmount) {
      updateData.fiat_amount = parseFloat(data.fiatAmount);
    }
    if (data.fiatCurrency) {
      updateData.fiat_currency = data.fiatCurrency;
    }
    if (data.cryptoAmount) {
      updateData.crypto_amount = parseFloat(data.cryptoAmount);
    }
    if (data.fee) {
      updateData.fee_amount = parseFloat(data.fee);
    }
    if (data.txHash) {
      updateData.deposit_tx_hash = data.txHash;
    }
    if (data.completedAt) {
      updateData.deposit_confirmed_at = data.completedAt;
      updateData.completed_at = data.completedAt;
    }

    // Update metadata
    updateData.metadata = {
      ...currentSession.metadata,
      last_webhook_event: event,
      last_webhook_timestamp: payload.timestamp,
      failure_reason: data.failureReason,
    };

    const { error: updateError } = await supabase
      .from('on_ramp_sessions')
      .update(updateData)
      .eq('id', currentSession.id);

    if (updateError) {
      console.error('[Webhook] Failed to update session:', updateError);
      return { success: false, error: 'Failed to update session' };
    }

    // If order completed, update the related payment intent
    if (event === 'order.completed' && currentSession.metadata?.intent_id) {
      const intentId = currentSession.metadata.intent_id;

      await supabase
        .from('payment_intents')
        .update({
          status: 'processing',
          funds_detected_at: new Date().toISOString(),
          metadata: {
            ...currentSession.metadata,
            on_ramp_completed: true,
            on_ramp_tx_hash: data.txHash,
            on_ramp_amount: data.cryptoAmount,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', intentId);

      console.log(`[Webhook] Updated payment intent ${intentId} - funds incoming`);
    }

    // If failed/cancelled, update the related payment intent
    if ((event === 'order.failed' || event === 'order.cancelled') && currentSession.metadata?.intent_id) {
      const intentId = currentSession.metadata.intent_id;

      await supabase
        .from('payment_intents')
        .update({
          metadata: {
            ...currentSession.metadata,
            on_ramp_failed: true,
            on_ramp_failure_reason: data.failureReason,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', intentId);
    }

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: `on_ramp_${event.replace('order.', '')}`,
      user_id: currentSession.user_id,
      entity_type: 'on_ramp_session',
      entity_id: currentSession.id,
      details: {
        provider: 'transfi',
        order_id: orderId,
        status: newStatus,
        fiat_amount: data.fiatAmount,
        crypto_amount: data.cryptoAmount,
        tx_hash: data.txHash,
        failure_reason: data.failureReason,
      },
    });

    // Create USDC transaction record if completed
    if (event === 'order.completed' && data.txHash && data.cryptoAmount) {
      await supabase.from('usdc_transactions').insert({
        transaction_type: 'on_ramp',
        from_address: 'transfi', // External on-ramp
        to_address: currentSession.destination_wallet_address,
        amount: parseFloat(data.cryptoAmount),
        polygon_tx_hash: data.txHash,
        status: 'confirmed',
        user_id: currentSession.user_id,
        confirmed_at: data.completedAt || new Date().toISOString(),
      });
    }

    console.log(`[Webhook] Successfully processed ${event} for session ${currentSession.id}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Webhook] Processing error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * GET /api/crypto/on-ramp/webhook
 * Webhook verification endpoint (some providers use GET for verification)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Echo back challenge for webhook verification
  const challenge = searchParams.get('challenge');
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    status: 'ok',
    message: 'TransFi webhook endpoint',
  });
}
