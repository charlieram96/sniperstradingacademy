/**
 * Check Subscriptions Cron Job
 * Deactivates users who have missed their subscription payments
 * Respects bypass flags (bypass_subscription, superadmin role)
 *
 * Uses period-based logic:
 * - Deactivates users where NOW > next_payment_due_date + 3 days
 *
 * Vercel Cron: "0 4 * * *" (4:00 AM UTC daily)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Grace period: 3 days after next_payment_due_date
const GRACE_PERIOD_DAYS = 3;

interface DeactivationResult {
  userId: string;
  email: string;
  daysOverdue: number;
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

    // Reset paid_for_period = false for users whose period has ended
    // (NOW > next_payment_due_date means new period started, need to pay again)
    const { data: resetUsers, error: resetError } = await supabase
      .from('users')
      .update({ paid_for_period: false })
      .eq('paid_for_period', true)
      .lt('next_payment_due_date', now.toISOString())
      .select('id');

    if (resetError) {
      console.error('[CheckSubscriptions] Failed to reset paid_for_period:', resetError);
    } else {
      console.log(`[CheckSubscriptions] Reset paid_for_period for ${resetUsers?.length || 0} users`);
    }

    // Calculate cutoff: NOW - 3 days grace period
    // Users with next_payment_due_date before this are overdue
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - GRACE_PERIOD_DAYS);

    // Query users who might be overdue
    // Conditions:
    // - initial_payment_completed = true (has unlocked platform)
    // - is_active = true (currently active)
    // - NOT bypassed (bypass_subscription or superadmin)
    // - has next_payment_due_date set
    const { data: activeUsers, error: queryError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        payment_schedule,
        next_payment_due_date,
        network_position_id,
        bypass_subscription,
        role
      `)
      .eq('initial_payment_completed', true)
      .eq('is_active', true)
      .or('bypass_subscription.is.null,bypass_subscription.eq.false')
      .not('role', 'in', '("superadmin","superadmin+")')
      .not('next_payment_due_date', 'is', null);

    if (queryError) {
      console.error('[CheckSubscriptions] Query error:', queryError);
      return NextResponse.json({
        success: false,
        error: 'Failed to query users',
        details: queryError.message,
      }, { status: 500 });
    }

    if (!activeUsers || activeUsers.length === 0) {
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

    console.log(`[CheckSubscriptions] Checking ${activeUsers.length} active users...`);

    // Filter users who are overdue: NOW > next_payment_due_date + 3 days
    const usersToDeactivate = activeUsers.filter((user) => {
      // Skip if bypassed (double-check in case query didn't filter perfectly)
      if (user.bypass_subscription || user.role === 'superadmin' || user.role === 'superadmin+') {
        return false;
      }

      // If no next_payment_due_date, skip (shouldn't happen with our query)
      if (!user.next_payment_due_date) {
        return false;
      }

      const nextDueDate = new Date(user.next_payment_due_date);
      const gracePeriodEnd = new Date(nextDueDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

      // User is overdue if NOW > next_payment_due_date + 3 days
      return now > gracePeriodEnd;
    });

    console.log(`[CheckSubscriptions] Found ${usersToDeactivate.length} overdue users`);

    if (usersToDeactivate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No overdue users found',
        stats: {
          checked: activeUsers.length,
          deactivated: 0,
          duration: Date.now() - startTime,
        },
      });
    }

    // Deactivate each overdue user
    const results: DeactivationResult[] = [];

    for (const user of usersToDeactivate) {
      const nextDueDate = new Date(user.next_payment_due_date!);
      const daysOverdue = Math.floor(
        (now.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

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
            days_overdue: daysOverdue,
            payment_schedule: user.payment_schedule || 'monthly',
            next_payment_due_date: user.next_payment_due_date,
            grace_period_days: GRACE_PERIOD_DAYS,
          },
        });

        results.push({
          userId: user.id,
          email: user.email,
          daysOverdue,
          paymentSchedule: user.payment_schedule || 'monthly',
          success: true,
        });

        console.log(`[CheckSubscriptions] Deactivated user ${user.email} (${daysOverdue} days past due date)`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          userId: user.id,
          email: user.email,
          daysOverdue,
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
        users_checked: activeUsers.length,
        users_deactivated: successCount,
        users_failed: failCount,
        duration_ms: duration,
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        checked: activeUsers.length,
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
