/**
 * Deposit Monitoring Cron Job
 * Backup to Alchemy webhooks - checks permanent user deposit addresses for USDC
 * Uses user's status to determine payment type (initial unlock vs subscription)
 *
 * Run frequency: Every 1-5 minutes via Vercel cron
 *
 * The actual deposit detection + payment processing lives in the shared
 * lib/treasury/deposit-processor module so the same idempotent logic is reused by
 * the sweep pipeline (sweep-identify), which records deposits BEFORE they are swept.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  checkAndProcessUserDeposit,
  type DepositProcessResults,
} from '@/lib/treasury/deposit-processor';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Maximum users to process per run (for scaling)
const MAX_USERS_PER_RUN = 100;

/**
 * GET /api/cron/monitor-deposits
 * Check deposit addresses for users who need to make payments
 * Protected by CRON_SECRET
 */
export async function GET(req: NextRequest) {
  return runMonitor(req);
}

/**
 * POST /api/cron/monitor-deposits
 * Same as GET but for manual triggers
 */
export async function POST(req: NextRequest) {
  return runMonitor(req);
}

async function runMonitor(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[MonitorDeposits] Unauthorized cron attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();
    const results: DepositProcessResults = {
      processed: 0,
      detected: 0,
      underpaid: 0,
      overpaid: 0,
      errors: [],
    };

    console.log('[MonitorDeposits] Starting deposit monitoring run...');

    // Get ALL users who have deposit addresses
    // We check for unprocessed funds regardless of active status
    // Users can (and should) pay BEFORE becoming inactive
    const { data: usersWithAddresses, error: queryError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        crypto_deposit_address,
        crypto_derivation_index,
        initial_payment_completed,
        bypass_initial_payment,
        is_active,
        payment_schedule,
        previous_payment_due_date,
        next_payment_due_date,
        last_payment_date
      `)
      .not('crypto_deposit_address', 'is', null)
      .limit(MAX_USERS_PER_RUN);

    if (queryError) {
      console.error('[MonitorDeposits] Failed to fetch users:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    const usersToCheck = usersWithAddresses || [];

    if (usersToCheck.length === 0) {
      console.log('[MonitorDeposits] No users with deposit addresses');
      return NextResponse.json({
        success: true,
        message: 'No users with deposit addresses',
        results,
      });
    }

    console.log(`[MonitorDeposits] Checking ${usersToCheck.length} user(s) with deposit addresses`);

    // Process each user
    for (const user of usersToCheck) {
      results.processed++;

      try {
        await checkAndProcessUserDeposit(supabase, user, results);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[MonitorDeposits] Error checking user ${user.id}:`, error);
        results.errors.push(`User ${user.id}: ${errorMsg}`);
      }
    }

    console.log(`[MonitorDeposits] Run complete. Processed: ${results.processed}, Detected: ${results.detected}, Underpaid: ${results.underpaid}, Overpaid: ${results.overpaid}`);

    return NextResponse.json({
      success: true,
      message: 'Deposit monitoring complete',
      results,
    });
  } catch (error) {
    console.error('[MonitorDeposits] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
