import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { coinbaseWalletService } from '@/lib/coinbase/wallet-service';

export const runtime = 'nodejs';
export const maxDuration = 120; // Allow up to 2 minutes for processing all users

/**
 * GET /api/cron/process-monthly-volumes
 * Processes end-of-month sniper volume archival and commission creation
 *
 * This cron job runs on the 1st of each month at 00:01 UTC and:
 * 1. Archives sniper_volume_current_month to sniper_volume_previous_month
 * 2. Creates sniper_volume_history records for all users with volume
 * 3. Creates residual_monthly commissions for eligible users
 * 4. Resets sniper_volume_current_month to 0 for all users
 *
 * Vercel Cron: "1 0 1 * *" (00:01 UTC on 1st of every month)
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron authorization
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[ProcessMonthlyVolumes] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[ProcessMonthlyVolumes] Starting monthly volume processing...');

    const supabase = await createClient();

    // Get the month period for logging (previous month since we're processing at start of new month)
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthPeriod = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

    console.log(`[ProcessMonthlyVolumes] Processing for period: ${monthPeriod}`);

    // Call the main orchestrator function
    const { data: result, error: processError } = await supabase
      .rpc('process_monthly_volumes');

    if (processError) {
      console.error('[ProcessMonthlyVolumes] RPC error:', processError);

      // Log the failure
      await supabase.from('monthly_processing_logs').insert({
        step_name: 'Full Process',
        success: false,
        error_message: processError.message,
        details: {
          month_period: monthPeriod,
          trigger: isVercelCron ? 'vercel_cron' : 'manual',
          error_code: processError.code,
        },
      });

      return NextResponse.json({
        success: false,
        error: 'Monthly processing failed',
        details: processError.message,
        monthPeriod,
      }, { status: 500 });
    }

    // Ensure wallets exist for all users who received monthly commissions
    // This is non-blocking - wallet creation at payout batch time will catch any misses
    try {
      const serviceSupabase = createServiceRoleClient();

      // Get all users who just received residual_monthly commissions this cycle
      const { data: newCommissions } = await serviceSupabase
        .from('commissions')
        .select('referrer_id')
        .eq('commission_type', 'residual_monthly')
        .eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - 120000).toISOString()); // Last 2 minutes

      if (newCommissions && newCommissions.length > 0) {
        const uniqueUserIds = [...new Set(newCommissions.map(c => c.referrer_id))];
        console.log(`[ProcessMonthlyVolumes] Ensuring wallets for ${uniqueUserIds.length} commission recipients`);

        let walletsCreated = 0;
        for (const userId of uniqueUserIds) {
          try {
            const walletResult = await coinbaseWalletService.ensureWalletForUser(userId, serviceSupabase);
            if (walletResult.success) {
              walletsCreated++;
            }
            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (walletError) {
            console.warn(`[ProcessMonthlyVolumes] Failed to create wallet for user ${userId}:`, walletError);
          }
        }

        console.log(`[ProcessMonthlyVolumes] Wallet creation complete. Created ${walletsCreated} wallets for ${uniqueUserIds.length} users`);
      }
    } catch (walletError) {
      console.error('[ProcessMonthlyVolumes] Non-blocking wallet creation failed:', walletError);
      // Don't fail the entire job - wallet creation can happen at payout time
    }

    const duration = Date.now() - startTime;

    // Fetch the logs that were created during processing for the response
    const { data: logs } = await supabase
      .from('monthly_processing_logs')
      .select('*')
      .gte('execution_date', new Date(now.getTime() - 60000).toISOString()) // Last minute
      .order('execution_date', { ascending: true });

    // Calculate summary from logs
    const archiveLog = logs?.find((l: { step_name: string }) => l.step_name === 'Archive');
    const commissionLog = logs?.find((l: { step_name: string }) => l.step_name === 'Commissions');
    const resetLog = logs?.find((l: { step_name: string }) => l.step_name === 'Reset');

    const summary = {
      monthPeriod,
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

    console.log('[ProcessMonthlyVolumes] Processing completed successfully:', summary);

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'admin_action',
      admin_id: null,
      entity_type: 'monthly_processing',
      entity_id: null,
      details: {
        action: 'monthly_volumes_processed',
        trigger: isVercelCron ? 'vercel_cron' : 'manual',
        month_period: monthPeriod,
        summary,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Monthly volume processing completed successfully',
      ...summary,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error('[ProcessMonthlyVolumes] Unexpected error:', error);

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
