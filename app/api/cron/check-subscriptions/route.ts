/**
 * Check Subscriptions Cron Job
 * Deactivates users who have missed their subscription payments
 * Respects bypass flags (bypass_subscription, superadmin role)
 *
 * Grace Periods:
 * - Monthly subscribers: 30 days + 3 day grace = 33 days
 * - Weekly subscribers: 7 days + 3 day grace = 10 days
 *
 * Vercel Cron: "0 4 * * *" (4:00 AM UTC daily)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Grace periods in days
const MONTHLY_GRACE_DAYS = 33; // 30 + 3 day grace
const WEEKLY_GRACE_DAYS = 10; // 7 + 3 day grace

interface DeactivationResult {
  userId: string;
  email: string;
  daysSincePayment: number;
  paymentSchedule: string;
  success: boolean;
  error?: string;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron authorization
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[CheckSubscriptions] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CheckSubscriptions] Starting subscription check...');

    const supabase = createServiceRoleClient();
    const now = new Date();

    // Calculate cutoff dates
    const monthlyCutoff = new Date(now);
    monthlyCutoff.setDate(monthlyCutoff.getDate() - MONTHLY_GRACE_DAYS);

    const weeklyCutoff = new Date(now);
    weeklyCutoff.setDate(weeklyCutoff.getDate() - WEEKLY_GRACE_DAYS);

    // Query users who are overdue
    // Conditions:
    // - initial_payment_completed = true (has unlocked platform)
    // - is_active = true (currently active)
    // - NOT bypassed (bypass_subscription or superadmin)
    // - last_payment_date is overdue based on payment_schedule
    const { data: overdueUsers, error: queryError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        last_payment_date,
        payment_schedule,
        network_position_id,
        bypass_subscription,
        role
      `)
      .eq('initial_payment_completed', true)
      .eq('is_active', true)
      .or('bypass_subscription.is.null,bypass_subscription.eq.false')
      .neq('role', 'superadmin');

    if (queryError) {
      console.error('[CheckSubscriptions] Query error:', queryError);
      return NextResponse.json({
        success: false,
        error: 'Failed to query users',
        details: queryError.message,
      }, { status: 500 });
    }

    if (!overdueUsers || overdueUsers.length === 0) {
      console.log('[CheckSubscriptions] No users to check');
      return NextResponse.json({
        success: true,
        message: 'No users to check',
        stats: {
          checked: 0,
          deactivated: 0,
          duration: Date.now() - startTime,
        },
      });
    }

    console.log(`[CheckSubscriptions] Checking ${overdueUsers.length} active users...`);

    // Filter users who are actually overdue based on their payment schedule
    const usersToDeactivate = overdueUsers.filter((user) => {
      // Skip if bypassed (double-check in case query didn't filter perfectly)
      if (user.bypass_subscription || user.role === 'superadmin') {
        return false;
      }

      // If no last_payment_date, they should be deactivated
      // (initial payment should have set this)
      if (!user.last_payment_date) {
        return true;
      }

      const lastPayment = new Date(user.last_payment_date);
      const daysSincePayment = Math.floor(
        (now.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24)
      );

      const isWeekly = user.payment_schedule === 'weekly';
      const threshold = isWeekly ? WEEKLY_GRACE_DAYS : MONTHLY_GRACE_DAYS;

      return daysSincePayment > threshold;
    });

    console.log(`[CheckSubscriptions] Found ${usersToDeactivate.length} overdue users`);

    if (usersToDeactivate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No overdue users found',
        stats: {
          checked: overdueUsers.length,
          deactivated: 0,
          duration: Date.now() - startTime,
        },
      });
    }

    // Deactivate each overdue user
    const results: DeactivationResult[] = [];

    for (const user of usersToDeactivate) {
      const lastPayment = user.last_payment_date ? new Date(user.last_payment_date) : null;
      const daysSincePayment = lastPayment
        ? Math.floor((now.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      try {
        // Deactivate user
        const { error: updateError } = await supabase
          .from('users')
          .update({
            is_active: false,
            inactive_since: now.toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          throw updateError;
        }

        // Update network counts if user has a network position
        if (user.network_position_id) {
          const { error: rpcError } = await supabase.rpc('decrement_upchain_active_count', {
            p_user_id: user.id,
          });

          if (rpcError) {
            console.warn(`[CheckSubscriptions] Failed to update network counts for ${user.id}:`, rpcError);
          }
        }

        // Log to audit
        await supabase.from('crypto_audit_log').insert({
          event_type: 'subscription_lapse_deactivation',
          user_id: user.id,
          entity_type: 'user',
          entity_id: user.id,
          details: {
            days_since_payment: daysSincePayment,
            payment_schedule: user.payment_schedule || 'monthly',
            last_payment_date: user.last_payment_date,
            threshold_days: user.payment_schedule === 'weekly' ? WEEKLY_GRACE_DAYS : MONTHLY_GRACE_DAYS,
          },
        });

        results.push({
          userId: user.id,
          email: user.email,
          daysSincePayment,
          paymentSchedule: user.payment_schedule || 'monthly',
          success: true,
        });

        console.log(`[CheckSubscriptions] Deactivated user ${user.email} (${daysSincePayment} days overdue)`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          userId: user.id,
          email: user.email,
          daysSincePayment,
          paymentSchedule: user.payment_schedule || 'monthly',
          success: false,
          error: errorMsg,
        });

        console.error(`[CheckSubscriptions] Failed to deactivate ${user.email}:`, error);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const duration = Date.now() - startTime;

    console.log(`[CheckSubscriptions] Complete. Deactivated: ${successCount}, Failed: ${failCount}, Duration: ${duration}ms`);

    // Log summary to audit
    await supabase.from('crypto_audit_log').insert({
      event_type: 'subscription_check_cron_completed',
      entity_type: 'system',
      details: {
        trigger: isVercelCron ? 'vercel_cron' : 'manual',
        users_checked: overdueUsers.length,
        users_deactivated: successCount,
        users_failed: failCount,
        duration_ms: duration,
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        checked: overdueUsers.length,
        deactivated: successCount,
        failed: failCount,
        duration,
      },
      results: results.slice(0, 20), // Limit results in response
    });
  } catch (error) {
    console.error('[CheckSubscriptions] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
