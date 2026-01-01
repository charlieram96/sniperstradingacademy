/**
 * Sweep Deposits Cron Job
 * Consolidates USDC from user deposit addresses to treasury wallet
 * Run frequency: Daily or on-demand via admin trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  sweepAllPendingDeposits,
  getMasterXprv,
  fundDepositForSweep,
  getUsersToSweep,
} from '@/lib/treasury/sweep-service';
import { getTreasurySetting } from '@/lib/treasury/treasury-service';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for batch processing

/**
 * Handle status request for admin UI
 * Returns sweep configuration status, users with deposit addresses, and last sweep info
 */
async function handleStatusRequest() {
  const supabase = createServiceRoleClient();

  // Check if sweep is configured
  const masterXprv = await getMasterXprv();
  const treasuryAddress = await getTreasurySetting('treasury_wallet_address');
  const configured = !!(masterXprv && treasuryAddress);

  // Get users with deposit addresses
  const usersToSweep = await getUsersToSweep(100);

  // Get USDC balances for users
  const pendingDeposits = await Promise.all(
    usersToSweep.slice(0, 20).map(async (user) => {
      try {
        const balanceResult = await polygonUSDCClient.getBalance(user.crypto_deposit_address);
        return {
          id: user.id,
          address: user.crypto_deposit_address,
          usdcBalance: balanceResult.success ? parseFloat(balanceResult.data?.balance || '0') : 0,
        };
      } catch {
        return {
          id: user.id,
          address: user.crypto_deposit_address,
          usdcBalance: 0,
        };
      }
    })
  );

  // Get last sweep from audit log
  const { data: lastSweepLog } = await supabase
    .from('crypto_audit_log')
    .select('created_at, details')
    .eq('event_type', 'deposit_swept')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSweep = lastSweepLog ? {
    date: lastSweepLog.created_at,
    totalUsdc: (lastSweepLog.details as { amount_usdc?: number })?.amount_usdc || 0,
  } : null;

  return NextResponse.json({
    success: true,
    configured,
    pendingDeposits,
    totalPending: usersToSweep.length,
    lastSweep,
  });
}

/**
 * GET /api/cron/sweep-deposits
 * - With ?status=true: Returns sweep status for admin UI (requires admin auth)
 * - Without: Automated sweep via Vercel cron (requires CRON_SECRET)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const isStatusRequest = url.searchParams.get('status') === 'true';

    // Status request for admin UI
    if (isStatusRequest) {
      return await handleStatusRequest();
    }

    // Verify cron secret for automated sweep
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[SweepDeposits] Unauthorized cron attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[SweepDeposits] Starting automated sweep...');

    // Check if sweep is configured
    const masterXprv = await getMasterXprv();
    if (!masterXprv) {
      console.log('[SweepDeposits] Sweep not configured - master xprv not set');
      return NextResponse.json({
        success: true,
        message: 'Sweep not configured - master xprv not set',
        results: null,
      });
    }

    const treasuryAddress = await getTreasurySetting('treasury_wallet_address');
    if (!treasuryAddress) {
      console.log('[SweepDeposits] Sweep not configured - treasury address not set');
      return NextResponse.json({
        success: true,
        message: 'Sweep not configured - treasury address not set',
        results: null,
      });
    }

    // Check for users with deposit addresses
    const usersToSweep = await getUsersToSweep(100);
    if (usersToSweep.length === 0) {
      console.log('[SweepDeposits] No users with deposit addresses');
      return NextResponse.json({
        success: true,
        message: 'No users to sweep',
        results: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          totalSweptUsdc: 0,
        },
      });
    }

    // Pre-fund addresses that need gas
    console.log(`[SweepDeposits] Checking gas for ${usersToSweep.length} addresses`);
    let fundedCount = 0;

    for (const user of usersToSweep) {
      // Check POL balance (Polygon's native token, formerly MATIC)
      const polResult = await polygonUSDCClient.getMATICBalance(user.crypto_deposit_address);
      const polBalance = parseFloat(polResult.data || '0');

      // Fund if less than 0.02 POL (need ~0.01 for transfer)
      if (polBalance < 0.02) {
        console.log(`[SweepDeposits] Funding ${user.crypto_deposit_address} (has ${polBalance} POL)`);
        const fundResult = await fundDepositForSweep(user.crypto_deposit_address, '0.05');
        if (fundResult.success) {
          fundedCount++;
          // Wait a bit for the funding to confirm
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          console.error(`[SweepDeposits] Failed to fund ${user.crypto_deposit_address}:`, fundResult.error);
        }
      }
    }

    if (fundedCount > 0) {
      console.log(`[SweepDeposits] Funded ${fundedCount} addresses with POL for gas`);
    }

    // Execute sweeps
    const summary = await sweepAllPendingDeposits(100);

    // Log summary audit event
    const supabase = createServiceRoleClient();
    await supabase.from('crypto_audit_log').insert({
      event_type: 'sweep_cron_completed',
      entity_type: 'treasury',
      details: {
        trigger: 'cron',
        total_processed: summary.totalProcessed,
        successful: summary.successful,
        failed: summary.failed,
        total_swept_usdc: summary.totalSweptUsdc,
        funded_with_gas: fundedCount,
      },
    });

    console.log(`[SweepDeposits] Complete. Swept ${summary.totalSweptUsdc} USDC from ${summary.successful} addresses`);

    return NextResponse.json({
      success: true,
      results: {
        totalProcessed: summary.totalProcessed,
        successful: summary.successful,
        failed: summary.failed,
        totalSweptUsdc: summary.totalSweptUsdc,
        fundedWithGas: fundedCount,
      },
    });
  } catch (error) {
    console.error('[SweepDeposits] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/sweep-deposits
 * Manual sweep trigger from admin panel
 */
export async function POST(req: NextRequest) {
  try {
    // Use regular client for auth
    const { createClient } = await import('@/lib/supabase/server');
    const authSupabase = await createClient();
    const { data: { user: authUser }, error: authError } = await authSupabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is superadmin
    const { data: userData } = await authSupabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (userData?.role !== 'superadmin' && userData?.role !== 'superadmin+') {
      return NextResponse.json(
        { error: 'Access denied. Superadmin only.' },
        { status: 403 }
      );
    }

    console.log(`[SweepDeposits] Manual sweep triggered by admin ${authUser.id}`);

    // Parse optional parameters
    const body = await req.json().catch(() => ({}));
    const { userId, limit = 50, autoFund = true } = body;

    // If specific user ID provided, sweep just that user
    if (userId) {
      const { sweepDepositById } = await import('@/lib/treasury/sweep-service');
      const result = await sweepDepositById(userId);

      // Log audit event
      const supabase = createServiceRoleClient();
      await supabase.from('crypto_audit_log').insert({
        event_type: result.success ? 'manual_sweep_success' : 'manual_sweep_failed',
        admin_id: authUser.id,
        user_id: userId,
        entity_type: 'user',
        entity_id: userId,
        details: {
          trigger: 'admin_manual',
          amount_usdc: result.amount,
          tx_hash: result.txHash,
          error: result.error,
        },
      });

      return NextResponse.json({
        success: result.success,
        result,
      });
    }

    // Otherwise sweep all users with deposit addresses
    // Check configuration first
    const masterXprv = await getMasterXprv();
    if (!masterXprv) {
      return NextResponse.json({
        success: false,
        error: 'Master wallet xprv not configured in treasury settings',
      }, { status: 400 });
    }

    const treasuryAddress = await getTreasurySetting('treasury_wallet_address');
    if (!treasuryAddress) {
      return NextResponse.json({
        success: false,
        error: 'Treasury wallet address not configured',
      }, { status: 400 });
    }

    // Get users to sweep
    const usersToSweep = await getUsersToSweep(limit);
    if (usersToSweep.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with deposit addresses to sweep',
        results: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          totalSweptUsdc: 0,
        },
      });
    }

    // Pre-fund addresses if requested
    let fundedCount = 0;
    if (autoFund) {
      for (const user of usersToSweep) {
        // Check POL balance (Polygon's native token, formerly MATIC)
        const polResult = await polygonUSDCClient.getMATICBalance(user.crypto_deposit_address);
        const polBalance = parseFloat(polResult.data || '0');

        if (polBalance < 0.02) {
          const fundResult = await fundDepositForSweep(user.crypto_deposit_address, '0.05');
          if (fundResult.success) {
            fundedCount++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }
    }

    // Execute sweeps
    const summary = await sweepAllPendingDeposits(limit);

    // Log audit event
    const supabase = createServiceRoleClient();
    await supabase.from('crypto_audit_log').insert({
      event_type: 'manual_sweep_batch_completed',
      admin_id: authUser.id,
      entity_type: 'treasury',
      details: {
        trigger: 'admin_manual',
        total_processed: summary.totalProcessed,
        successful: summary.successful,
        failed: summary.failed,
        total_swept_usdc: summary.totalSweptUsdc,
        funded_with_gas: fundedCount,
      },
    });

    return NextResponse.json({
      success: true,
      results: {
        totalProcessed: summary.totalProcessed,
        successful: summary.successful,
        failed: summary.failed,
        totalSweptUsdc: summary.totalSweptUsdc,
        fundedWithGas: fundedCount,
        details: summary.results,
      },
    });
  } catch (error) {
    console.error('[SweepDeposits] Manual sweep error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
