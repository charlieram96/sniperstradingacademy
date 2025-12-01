import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/cron/expire-intents
// Marks expired payment intents
// Vercel Cron: every 5 minutes (schedule: "* /5 * * * *" without space)
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Use the database function to expire old intents
    const { data: expiredCount, error } = await supabase
      .rpc('expire_old_payment_intents');

    if (error) {
      console.error('[ExpireIntents] Database error:', error);

      // Fallback: Direct update if function doesn't exist
      const { data: expiredIntents } = await supabase
        .from('payment_intents')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .in('status', ['created', 'awaiting_funds'])
        .lt('expires_at', new Date().toISOString())
        .select('id');

      return NextResponse.json({
        success: true,
        message: `Expired ${expiredIntents?.length || 0} intents`,
        expiredCount: expiredIntents?.length || 0,
      });
    }

    console.log(`[ExpireIntents] Expired ${expiredCount} payment intents`);

    return NextResponse.json({
      success: true,
      message: `Expired ${expiredCount} intents`,
      expiredCount,
    });
  } catch (error: unknown) {
    console.error('[ExpireIntents] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
