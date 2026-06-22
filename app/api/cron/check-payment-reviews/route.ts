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
import {
  MISSED_WEEKS_THRESHOLD,
  computeMissedWeeks,
  expectedCoverageWeeks,
  isFlaggingActive,
  getWindowStart,
} from '@/lib/payments/review-window';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    // Flagging only becomes possible once at least MISSED_WEEKS_THRESHOLD weeks
    // have elapsed since tracking start (you can't miss 12 weeks before 12 weeks
    // have passed). Missed weeks are measured against elapsed weeks (capped at
    // the full 26-week window), so users are flagged as soon as they fall behind
    // rather than waiting for the entire window to pass.
    if (!isFlaggingActive(now)) {
      const expectedWeeks = expectedCoverageWeeks(now);
      console.log(`[CheckPaymentReviews] Only ${expectedWeeks} weeks elapsed since tracking start. Need ${MISSED_WEEKS_THRESHOLD}. Exiting early.`);

      await supabase.from('crypto_audit_log').insert({
        event_type: 'payment_review_check_skipped',
        entity_type: 'system',
        details: {
          trigger: isVercelCron ? 'vercel_cron' : 'manual',
          reason: 'threshold_not_reachable',
          weeks_elapsed: expectedWeeks,
          weeks_required: MISSED_WEEKS_THRESHOLD,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Flagging not yet active. ${expectedWeeks}/${MISSED_WEEKS_THRESHOLD} weeks elapsed since tracking start.`,
        stats: {
          checked: 0,
          flagged: 0,
          duration: Date.now() - startTime,
        },
      });
    }

    // Payment-counting window: max(now - 182 days, REVIEW_TRACKING_START_DATE)
    const windowStart = getWindowStart(now);

    console.log(`[CheckPaymentReviews] Window: ${windowStart.toISOString()} to ${now.toISOString()}`);

    // Coverage is per-payment: each weekly payment covers 1 week, each monthly covers 4.
    // We can't rely on a per-user schedule, so we count by payment_type.
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, email, payment_schedule, flagged_for_review, network_position_id, initial_payment_date')
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

    const { data: paymentRows, error: paymentsError } = await supabase
      .from('payments')
      .select('user_id, payment_type')
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

    const weeklyCountMap = new Map<string, number>();
    const monthlyCountMap = new Map<string, number>();
    for (const p of paymentRows || []) {
      const target = p.payment_type === 'weekly' ? weeklyCountMap : monthlyCountMap;
      target.set(p.user_id, (target.get(p.user_id) || 0) + 1);
    }

    const { data: bypassUsers } = await supabase
      .from('users')
      .select('id')
      .eq('bypass_subscription', true);

    const bypassSet = new Set((bypassUsers || []).map(u => u.id));

    const userData = usersData
      .filter(u => !bypassSet.has(u.id))
      .map(u => ({
        ...u,
        weekly_count: weeklyCountMap.get(u.id) || 0,
        monthly_count: monthlyCountMap.get(u.id) || 0,
      }));

    console.log(`[CheckPaymentReviews] Checking ${userData.length} users...`);

    let flaggedCount = 0;
    const flaggedUsers: Array<{ userId: string; email: string; missedWeeks: number }> = [];

    for (const user of userData) {
      const coverageWeeks = user.weekly_count + user.monthly_count * 4;
      // Anchor expectation to when THIS user became liable (initial unlock + grace),
      // so recently-joined members aren't flagged for weeks they were never due.
      const initialPaymentDate = user.initial_payment_date ? new Date(user.initial_payment_date) : null;
      const missedWeeks = computeMissedWeeks(coverageWeeks, now, initialPaymentDate);

      if (missedWeeks >= MISSED_WEEKS_THRESHOLD && !user.flagged_for_review) {
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

        await supabase.from('crypto_audit_log').insert({
          event_type: 'account_flagged_for_review',
          user_id: user.id,
          entity_type: 'user',
          entity_id: user.id,
          details: {
            missed_weeks: missedWeeks,
            weekly_payment_count: user.weekly_count,
            monthly_payment_count: user.monthly_count,
            coverage_weeks: coverageWeeks,
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

        console.log(`[CheckPaymentReviews] Flagged user ${user.email} (${missedWeeks} missed weeks, weekly: ${user.weekly_count}, monthly: ${user.monthly_count})`);
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
