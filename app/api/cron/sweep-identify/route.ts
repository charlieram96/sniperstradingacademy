/**
 * Sweep Identify Cron Job
 * Step 1 of the sweep pipeline: Identifies users with USDC to sweep
 *
 * This job:
 * 1. Finds users with deposit addresses in 'idle' or 'failed' status
 * 2. Checks their USDC and POL balances
 * 3. Updates sweep_status to 'needs_funding' or 'ready'
 *
 * Run frequency: Every 5 minutes
 * Expected duration: < 30 seconds
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Minimum USDC balance to sweep (avoid dust)
const MIN_SWEEP_AMOUNT = 1;
// Minimum POL needed for gas
const MIN_POL_FOR_GAS = 0.08;
// Max users to process per run
const BATCH_SIZE = 50;

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[SweepIdentify] Starting identification run...');

    const supabase = createServiceRoleClient();

    // Find users with deposit addresses that are idle or failed (retry)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, crypto_deposit_address')
      .not('crypto_deposit_address', 'is', null)
      .in('sweep_status', ['idle', 'failed'])
      .limit(BATCH_SIZE);

    if (error) {
      console.error('[SweepIdentify] Error fetching users:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!users || users.length === 0) {
      console.log('[SweepIdentify] No users to check');
      return NextResponse.json({
        success: true,
        message: 'No users to check',
        stats: { checked: 0, needsFunding: 0, ready: 0 },
        duration: Date.now() - startTime,
      });
    }

    console.log(`[SweepIdentify] Checking ${users.length} users...`);

    let needsFunding = 0;
    let ready = 0;
    let skipped = 0;

    // Check balances in parallel (faster than sequential)
    const results = await Promise.allSettled(
      users.map(async (user) => {
        try {
          // Get USDC balance
          const usdcResult = await polygonUSDCClient.getBalance(user.crypto_deposit_address);
          const usdcBalance = usdcResult.success ? parseFloat(usdcResult.data?.balance || '0') : 0;

          // Skip if below minimum
          if (usdcBalance < MIN_SWEEP_AMOUNT) {
            return { userId: user.id, action: 'skip', usdcBalance };
          }

          // Get POL balance
          const polResult = await polygonUSDCClient.getMATICBalance(user.crypto_deposit_address);
          const polBalance = parseFloat(polResult.data || '0');

          // Determine status
          const newStatus = polBalance >= MIN_POL_FOR_GAS ? 'ready' : 'needs_funding';

          // Update user
          await supabase
            .from('users')
            .update({
              sweep_status: newStatus,
              sweep_usdc_balance: usdcBalance,
              sweep_identified_at: new Date().toISOString(),
              sweep_error: null, // Clear any previous error
            })
            .eq('id', user.id);

          return { userId: user.id, action: newStatus, usdcBalance, polBalance };
        } catch (err) {
          console.error(`[SweepIdentify] Error checking ${user.email}:`, err);
          return { userId: user.id, action: 'error', error: err };
        }
      })
    );

    // Count results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.action === 'needs_funding') needsFunding++;
        else if (result.value.action === 'ready') ready++;
        else if (result.value.action === 'skip') skipped++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SweepIdentify] Complete in ${duration}ms. Needs funding: ${needsFunding}, Ready: ${ready}, Skipped: ${skipped}`);

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'sweep_identify_completed',
      entity_type: 'treasury',
      details: {
        users_checked: users.length,
        needs_funding: needsFunding,
        ready,
        skipped,
        duration_ms: duration,
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        checked: users.length,
        needsFunding,
        ready,
        skipped,
      },
      duration,
    });
  } catch (error) {
    console.error('[SweepIdentify] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
