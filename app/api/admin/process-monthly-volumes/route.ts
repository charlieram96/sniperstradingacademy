import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 120; // Allow up to 2 minutes for processing

/**
 * POST /api/admin/process-monthly-volumes
 * Manually trigger monthly volume processing
 *
 * This endpoint allows admins to manually trigger the monthly processing
 * outside of the scheduled cron time. Useful for:
 * - Testing the monthly processing logic
 * - Catch-up processing if cron failed
 * - Re-running after bug fixes
 *
 * Requires admin or superadmin role.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or superadmin
    const { data: userData } = await supabase
      .from('users')
      .select('role, name')
      .eq('id', user.id)
      .single();

    if (!['admin', 'superadmin'].includes(userData?.role || '')) {
      return NextResponse.json(
        { error: 'Access denied. Admin or superadmin role required.' },
        { status: 403 }
      );
    }

    console.log(`[AdminProcessMonthlyVolumes] Manual trigger by ${userData?.name || user.email} (${userData?.role})`);

    // Parse request body for options
    let options: { dryRun?: boolean; monthPeriod?: string } = {};
    try {
      const body = await req.json();
      options = body || {};
    } catch {
      // No body or invalid JSON - use defaults
    }

    const { dryRun = false } = options;

    // Get the month period for logging (previous month since we're processing at start of new month)
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthPeriod = options.monthPeriod ||
      `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

    console.log(`[AdminProcessMonthlyVolumes] Processing for period: ${monthPeriod}, dryRun: ${dryRun}`);

    if (dryRun) {
      // Dry run - get detailed stats without making changes
      const warnings: string[] = [];

      // Check if this month was already processed
      const { data: existingLogs } = await supabase
        .from('monthly_processing_logs')
        .select('execution_date, success')
        .gte('execution_date', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
        .eq('step_name', 'Full Process')
        .eq('success', true)
        .limit(1);

      if (existingLogs && existingLogs.length > 0) {
        warnings.push(`This month may have already been processed on ${new Date(existingLogs[0].execution_date).toLocaleDateString()}`);
      }

      // Get last successful processing
      const { data: lastProcessing } = await supabase
        .from('monthly_processing_logs')
        .select('execution_date, details')
        .eq('step_name', 'Full Process')
        .eq('success', true)
        .order('execution_date', { ascending: false })
        .limit(1);

      const lastProcessedMonth = lastProcessing?.[0]?.details?.month_period || 'Never';

      // Get all users with volume including their details for commission calculation
      const { data: usersWithVolume } = await supabase
        .from('users')
        .select('id, name, email, sniper_volume_current_month, current_commission_rate, last_payment_date, is_active, bypass_subscription, qualified, payout_wallet_address, active_direct_referrals_count, bypass_direct_referrals')
        .gt('sniper_volume_current_month', 0)
        .order('sniper_volume_current_month', { ascending: false });

      const users = usersWithVolume || [];

      // Calculate eligibility and commissions for each user
      const eligibleUsers: Array<{
        userId: string;
        userName: string;
        userEmail: string;
        volume: number;
        commissionRate: number;
        commissionAmount: number;
        isActive: boolean;
        isQualified: boolean;
        directReferrals: number;
        hasWallet: boolean;
      }> = [];

      const ineligibleUsers: Array<{
        userId: string;
        userName: string;
        reason: string;
        volume: number;
        isQualified: boolean;
      }> = [];

      for (const user of users) {
        const volume = parseFloat(user.sniper_volume_current_month || '0');
        const commissionRate = parseFloat(user.current_commission_rate || '0.10');
        // Account for subscription bypass when checking active status
        const isActive = user.is_active || user.bypass_subscription;
        const isQualified = user.qualified === true;
        // Use effective referral count (actual or bypass, whichever is higher)
        const directReferrals = Math.max(user.active_direct_referrals_count || 0, user.bypass_direct_referrals || 0);
        const hasWallet = !!user.payout_wallet_address;

        if (isActive) {
          eligibleUsers.push({
            userId: user.id,
            userName: user.name || 'Unknown',
            userEmail: user.email || '',
            volume,
            commissionRate: commissionRate * 100, // Convert to percentage
            commissionAmount: volume * commissionRate,
            isActive: true,
            isQualified,
            directReferrals,
            hasWallet,
          });
        } else {
          // User not active (no active subscription and no bypass)
          ineligibleUsers.push({
            userId: user.id,
            userName: user.name || 'Unknown',
            reason: 'Not active (no subscription or bypass)',
            volume,
            isQualified,
          });
        }
      }

      const totalVolume = users.reduce(
        (sum, u) => sum + parseFloat(u.sniper_volume_current_month || '0'),
        0
      );

      const totalCommissionAmount = eligibleUsers.reduce(
        (sum, u) => sum + u.commissionAmount,
        0
      );

      // Add warning if no eligible users
      if (eligibleUsers.length === 0 && users.length > 0) {
        warnings.push('No active users are eligible for commissions this month');
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        message: 'Preview generated - no changes made',
        preview: {
          monthPeriod,
          lastProcessedMonth,
          usersWithVolume: users.length,
          totalVolumeToArchive: parseFloat(totalVolume.toFixed(2)),
          commissionsToCreate: {
            count: eligibleUsers.length,
            totalAmount: parseFloat(totalCommissionAmount.toFixed(2)),
            breakdown: eligibleUsers.slice(0, 50), // Limit to top 50 for response size
            hasMore: eligibleUsers.length > 50,
          },
          ineligibleUsers: {
            count: ineligibleUsers.length,
            samples: ineligibleUsers.slice(0, 10), // Show first 10 ineligible
          },
          warnings,
        },
      });
    }

    // Execute the actual monthly processing
    const { data: result, error: processError } = await supabase.rpc('process_monthly_volumes');

    if (processError) {
      console.error('[AdminProcessMonthlyVolumes] RPC error:', processError);

      // Log the failure
      await supabase.from('monthly_processing_logs').insert({
        step_name: 'Full Process (Admin Manual)',
        success: false,
        error_message: processError.message,
        details: {
          month_period: monthPeriod,
          triggered_by: user.id,
          triggered_by_name: userData?.name,
          error_code: processError.code,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Monthly processing failed',
          details: processError.message,
          monthPeriod,
        },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;

    // Fetch the logs that were created during processing
    const { data: logs } = await supabase
      .from('monthly_processing_logs')
      .select('*')
      .gte('execution_date', new Date(now.getTime() - 120000).toISOString()) // Last 2 minutes
      .order('execution_date', { ascending: true });

    // Calculate summary from logs
    const archiveLog = logs?.find((l: { step_name: string }) => l.step_name === 'Archive');
    const commissionLog = logs?.find((l: { step_name: string }) => l.step_name === 'Commissions');
    const resetLog = logs?.find((l: { step_name: string }) => l.step_name === 'Reset');

    const summary = {
      monthPeriod,
      triggeredBy: {
        userId: user.id,
        name: userData?.name,
        role: userData?.role,
      },
      archiveStep: {
        usersProcessed: archiveLog?.users_processed || 0,
        totalVolume: archiveLog?.total_volume || 0,
        success: archiveLog?.success ?? false,
      },
      commissionStep: {
        commissionsCreated: commissionLog?.commissions_created || 0,
        totalPayoutAmount: commissionLog?.total_payout_amount || 0,
        ineligibleUsers: commissionLog?.ineligible_users || 0,
        success: commissionLog?.success ?? false,
      },
      resetStep: {
        usersReset: resetLog?.users_processed || 0,
        success: resetLog?.success ?? false,
      },
      durationMs: duration,
    };

    console.log('[AdminProcessMonthlyVolumes] Processing completed:', summary);

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'admin_action',
      admin_id: user.id,
      entity_type: 'monthly_processing',
      entity_id: null,
      details: {
        action: 'manual_monthly_volumes_processed',
        trigger: 'admin_manual',
        month_period: monthPeriod,
        summary,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Monthly volume processing completed successfully',
      ...summary,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error('[AdminProcessMonthlyVolumes] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/process-monthly-volumes
 * Get the status of monthly processing, including last execution and logs
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or superadmin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!['admin', 'superadmin'].includes(userData?.role || '')) {
      return NextResponse.json(
        { error: 'Access denied. Admin or superadmin role required.' },
        { status: 403 }
      );
    }

    // Get recent processing logs
    const { data: recentLogs } = await supabase
      .from('monthly_processing_logs')
      .select('*')
      .order('execution_date', { ascending: false })
      .limit(20);

    // Get current month stats
    const { data: currentStats } = await supabase
      .from('users')
      .select('id, sniper_volume_current_month, sniper_volume_previous_month, is_active')
      .gt('sniper_volume_current_month', 0);

    const totalCurrentVolume = (currentStats || []).reduce(
      (sum, u) => sum + parseFloat(u.sniper_volume_current_month || '0'),
      0
    );

    const activeUsersWithVolume = (currentStats || []).filter(u => u.is_active).length;

    // Get pending commissions count
    const { count: pendingCommissions } = await supabase
      .from('commissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('commission_type', 'residual_monthly');

    // Group logs by month
    const logsByMonth = (recentLogs || []).reduce(
      (acc: Record<string, unknown[]>, log: { details?: { month_period?: string } }) => {
        const period = log.details?.month_period || 'unknown';
        if (!acc[period]) acc[period] = [];
        acc[period].push(log);
        return acc;
      },
      {}
    );

    return NextResponse.json({
      success: true,
      currentPeriodStats: {
        usersWithVolume: currentStats?.length || 0,
        activeUsersWithVolume,
        totalCurrentMonthVolume: totalCurrentVolume.toFixed(2),
        pendingResidualCommissions: pendingCommissions || 0,
      },
      recentLogs: logsByMonth,
      lastExecution: recentLogs?.[0] || null,
    });
  } catch (error: unknown) {
    console.error('[AdminProcessMonthlyVolumes GET] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
