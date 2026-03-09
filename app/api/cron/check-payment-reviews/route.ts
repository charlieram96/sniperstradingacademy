/**
 * Check Payment Reviews Cron Job
 * Flags users who have missed 12+ weeks of payments in a rolling 26-week window
 * for superadmin+ review.
 *
 * - No retroactive flagging: only checks from REVIEW_TRACKING_START_DATE forward
 * - Checks all paying users (active + inactive)
 * - Does NOT auto-unflag — superadmin+ must manually dismiss
 *
 * Vercel Cron: "0 5 * * *" (5:00 AM UTC daily)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Date from which we start tracking — no retroactive flagging
const REVIEW_TRACKING_START_DATE = new Date('2026-03-08T00:00:00Z');

// 26 weeks in days
const WINDOW_DAYS = 182;

// Threshold: 12+ missed weeks triggers a flag
const MISSED_WEEKS_THRESHOLD = 12;

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron authorization
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[CheckPaymentReviews] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CheckPaymentReviews] Starting payment review check...');

    const supabase = createServiceRoleClient();
    const now = new Date();

    // Check if full 26-week window has elapsed since tracking start
    const msSinceTrackingStart = now.getTime() - REVIEW_TRACKING_START_DATE.getTime();
    const daysSinceTrackingStart = msSinceTrackingStart / (1000 * 60 * 60 * 24);

    if (daysSinceTrackingStart < WINDOW_DAYS) {
      console.log(`[CheckPaymentReviews] Only ${Math.floor(daysSinceTrackingStart)} days since tracking start. Need ${WINDOW_DAYS} days. Exiting early.`);

      await supabase.from('crypto_audit_log').insert({
        event_type: 'payment_review_check_skipped',
        entity_type: 'system',
        details: {
          trigger: isVercelCron ? 'vercel_cron' : 'manual',
          reason: 'window_not_elapsed',
          days_since_start: Math.floor(daysSinceTrackingStart),
          days_required: WINDOW_DAYS,
        },
      });

      return NextResponse.json({
        success: true,
        message: `26-week window not yet elapsed. ${Math.floor(daysSinceTrackingStart)}/${WINDOW_DAYS} days since tracking start.`,
        stats: {
          checked: 0,
          flagged: 0,
          duration: Date.now() - startTime,
        },
      });
    }

    // Calculate window start: max(now - 182 days, REVIEW_TRACKING_START_DATE)
    const windowStartFromNow = new Date(now);
    windowStartFromNow.setDate(windowStartFromNow.getDate() - WINDOW_DAYS);
    const windowStart = windowStartFromNow > REVIEW_TRACKING_START_DATE
      ? windowStartFromNow
      : REVIEW_TRACKING_START_DATE;

    console.log(`[CheckPaymentReviews] Window: ${windowStart.toISOString()} to ${now.toISOString()}`);

    // Single aggregate query to get payment counts per user
    const { data: users, error: queryError } = await supabase.rpc('get_payment_review_data', {
      p_window_start: windowStart.toISOString(),
    });

    // If RPC doesn't exist, fall back to raw query
    let userData: Array<{
      id: string;
      email: string;
      payment_schedule: string | null;
      flagged_for_review: boolean;
      network_position_id: string | null;
      payment_count: number;
    }>;

    if (queryError || !users) {
      // Fallback: use direct queries
      console.log('[CheckPaymentReviews] Using direct query fallback');

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, payment_schedule, flagged_for_review, network_position_id')
        .eq('initial_payment_completed', true)
        .not('role', 'in', '("superadmin","superadmin+")');

      if (usersError) {
        console.error('[CheckPaymentReviews] Users query error:', usersError);
        return NextResponse.json({
          success: false,
          error: 'Failed to query users',
          details: usersError.message,
        }, { status: 500 });
      }

      if (!usersData || usersData.length === 0) {
        console.log('[CheckPaymentReviews] No users to check');
        return NextResponse.json({
          success: true,
          message: 'No users to check',
          stats: { checked: 0, flagged: 0, duration: Date.now() - startTime },
        });
      }

      // Filter out bypassed users in code
      const eligibleUsers = usersData.filter(u => {
        // We can't filter bypass_subscription with .or() easily, do it here
        return true;
      });

      // Get payment counts for all eligible users
      const { data: paymentCounts, error: paymentsError } = await supabase
        .from('payments')
        .select('user_id, id')
        .eq('status', 'succeeded')
        .in('payment_type', ['weekly', 'monthly'])
        .gte('created_at', windowStart.toISOString());

      if (paymentsError) {
        console.error('[CheckPaymentReviews] Payments query error:', paymentsError);
        return NextResponse.json({
          success: false,
          error: 'Failed to query payments',
          details: paymentsError.message,
        }, { status: 500 });
      }

      // Build payment count map
      const paymentCountMap = new Map<string, number>();
      for (const p of paymentCounts || []) {
        paymentCountMap.set(p.user_id, (paymentCountMap.get(p.user_id) || 0) + 1);
      }

      // Also check bypass_subscription
      const { data: bypassUsers } = await supabase
        .from('users')
        .select('id')
        .eq('bypass_subscription', true);

      const bypassSet = new Set((bypassUsers || []).map(u => u.id));

      userData = eligibleUsers
        .filter(u => !bypassSet.has(u.id))
        .map(u => ({
          ...u,
          payment_count: paymentCountMap.get(u.id) || 0,
        }));
    } else {
      userData = users;
    }

    console.log(`[CheckPaymentReviews] Checking ${userData.length} users...`);

    let flaggedCount = 0;
    const flaggedUsers: Array<{ userId: string; email: string; missedWeeks: number }> = [];

    for (const user of userData) {
      const schedule = user.payment_schedule || 'monthly';
      let missedWeeks: number;

      if (schedule === 'weekly') {
        missedWeeks = Math.max(0, 26 - user.payment_count);
      } else {
        // monthly: each payment covers 4 weeks
        missedWeeks = Math.max(0, 26 - (user.payment_count * 4));
      }

      if (missedWeeks >= MISSED_WEEKS_THRESHOLD && !user.flagged_for_review) {
        // Flag this user
        const { error: updateError } = await supabase
          .from('users')
          .update({
            flagged_for_review: true,
            flagged_for_review_at: now.toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`[CheckPaymentReviews] Failed to flag user ${user.email}:`, updateError);
          continue;
        }

        // Log flagging event
        await supabase.from('crypto_audit_log').insert({
          event_type: 'account_flagged_for_review',
          user_id: user.id,
          entity_type: 'user',
          entity_id: user.id,
          details: {
            missed_weeks: missedWeeks,
            payment_count: user.payment_count,
            payment_schedule: schedule,
            window_start: windowStart.toISOString(),
            window_end: now.toISOString(),
          },
        });

        flaggedCount++;
        flaggedUsers.push({
          userId: user.id,
          email: user.email,
          missedWeeks,
        });

        console.log(`[CheckPaymentReviews] Flagged user ${user.email} (${missedWeeks} missed weeks, schedule: ${schedule})`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CheckPaymentReviews] Complete. Checked: ${userData.length}, Flagged: ${flaggedCount}, Duration: ${duration}ms`);

    // Log cron summary
    await supabase.from('crypto_audit_log').insert({
      event_type: 'payment_review_check_completed',
      entity_type: 'system',
      details: {
        trigger: isVercelCron ? 'vercel_cron' : 'manual',
        users_checked: userData.length,
        users_flagged: flaggedCount,
        window_start: windowStart.toISOString(),
        window_end: now.toISOString(),
        duration_ms: duration,
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        checked: userData.length,
        flagged: flaggedCount,
        duration,
      },
      flaggedUsers: flaggedUsers.slice(0, 20),
    });
  } catch (error) {
    console.error('[CheckPaymentReviews] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
