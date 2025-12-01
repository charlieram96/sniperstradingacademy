import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/cron/monitor-payment-intents
 * Monitors active payment intents for incoming funds
 * Vercel Cron: "* * * * *" (every minute) or every 30 seconds via external cron
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/monitor-payment-intents",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get active payment intents (created or awaiting_funds)
    const { data: activeIntents, error } = await supabase
      .from('payment_intents')
      .select('*')
      .in('status', ['created', 'awaiting_funds'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50); // Process 50 at a time

    if (error) {
      console.error('[MonitorIntents] Database error:', error);
      return NextResponse.json({
        success: false,
        error: 'Database error',
      }, { status: 500 });
    }

    if (!activeIntents || activeIntents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active intents to monitor',
        processed: 0,
      });
    }

    const results = {
      processed: 0,
      fundsDetected: 0,
      readyToProcess: [] as string[],
      errors: 0,
    };

    // Check each intent for funds
    for (const intent of activeIntents) {
      try {
        const balanceResponse = await polygonUSDCClient.getBalance(intent.user_wallet_address);

        if (!balanceResponse.success || !balanceResponse.data) {
          results.errors++;
          continue;
        }

        const currentBalance = parseFloat(balanceResponse.data.balance);
        const requiredAmount = parseFloat(intent.amount_usdc);

        // Check if funds detected (99% tolerance for rounding)
        if (currentBalance >= requiredAmount * 0.99) {
          results.fundsDetected++;

          // Update intent status if not already awaiting_funds
          if (intent.status === 'created') {
            await supabase
              .from('payment_intents')
              .update({
                status: 'awaiting_funds',
                funds_detected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', intent.id);
          }

          results.readyToProcess.push(intent.id);

          // Trigger processing via internal call
          try {
            const processResponse = await fetch(
              `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/crypto/payments/process-payment`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${cronSecret}`,
                },
                body: JSON.stringify({ intentId: intent.id }),
              }
            );

            if (!processResponse.ok) {
              console.warn(`[MonitorIntents] Failed to process intent ${intent.id}`);
            }
          } catch (processError) {
            console.error(`[MonitorIntents] Error processing intent ${intent.id}:`, processError);
          }
        }

        results.processed++;
      } catch (intentError) {
        console.error(`[MonitorIntents] Error checking intent ${intent.id}:`, intentError);
        results.errors++;
      }
    }

    console.log(`[MonitorIntents] Processed ${results.processed} intents, ${results.fundsDetected} with funds`);

    return NextResponse.json({
      success: true,
      message: `Monitored ${results.processed} intents`,
      results,
    });
  } catch (error: unknown) {
    console.error('[MonitorIntents] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
