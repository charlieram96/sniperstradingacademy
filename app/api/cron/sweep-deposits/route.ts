/**
 * Sweep Deposits Cron Job
 * Consolidates USDC from deposit addresses to treasury wallet
 * Run frequency: Daily or on-demand via admin trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  sweepAllPendingDeposits,
  getMasterXprv,
  fundDepositForSweep,
  getDepositsToSweep,
} from '@/lib/treasury/sweep-service';
import { getTreasurySetting } from '@/lib/treasury/treasury-service';
import { polygonUSDCClient } from '@/lib/polygon/usdc-client';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for batch processing

/**
 * GET /api/cron/sweep-deposits
 * Automated sweep via Vercel cron
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
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

    // Check for deposits to sweep first
    const depositsToSweep = await getDepositsToSweep(100);
    if (depositsToSweep.length === 0) {
      console.log('[SweepDeposits] No deposits pending sweep');
      return NextResponse.json({
        success: true,
        message: 'No deposits to sweep',
        results: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          totalSweptUsdc: 0,
        },
      });
    }

    // Pre-fund addresses that need gas
    console.log(`[SweepDeposits] Checking gas for ${depositsToSweep.length} addresses`);
    let fundedCount = 0;

    for (const deposit of depositsToSweep) {
      // Check POL balance (Polygon's native token, formerly MATIC)
      const polResult = await polygonUSDCClient.getMATICBalance(deposit.deposit_address);
      const polBalance = parseFloat(polResult.data || '0');

      // Fund if less than 0.02 POL (need ~0.01 for transfer)
      if (polBalance < 0.02) {
        console.log(`[SweepDeposits] Funding ${deposit.deposit_address} (has ${polBalance} POL)`);
        const fundResult = await fundDepositForSweep(deposit.deposit_address, '0.05');
        if (fundResult.success) {
          fundedCount++;
          // Wait a bit for the funding to confirm
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          console.error(`[SweepDeposits] Failed to fund ${deposit.deposit_address}:`, fundResult.error);
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

    if (userData?.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Access denied. Superadmin only.' },
        { status: 403 }
      );
    }

    console.log(`[SweepDeposits] Manual sweep triggered by admin ${authUser.id}`);

    // Parse optional parameters
    const body = await req.json().catch(() => ({}));
    const { depositAddressId, limit = 50, autoFund = true } = body;

    // If specific deposit ID provided, sweep just that one
    if (depositAddressId) {
      const { sweepDepositById } = await import('@/lib/treasury/sweep-service');
      const result = await sweepDepositById(depositAddressId);

      // Log audit event
      const supabase = createServiceRoleClient();
      await supabase.from('crypto_audit_log').insert({
        event_type: result.success ? 'manual_sweep_success' : 'manual_sweep_failed',
        admin_id: authUser.id,
        entity_type: 'deposit_address',
        entity_id: depositAddressId,
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

    // Otherwise sweep all pending
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

    // Get deposits to sweep
    const depositsToSweep = await getDepositsToSweep(limit);
    if (depositsToSweep.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No deposits pending sweep',
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
      for (const deposit of depositsToSweep) {
        // Check POL balance (Polygon's native token, formerly MATIC)
        const polResult = await polygonUSDCClient.getMATICBalance(deposit.deposit_address);
        const polBalance = parseFloat(polResult.data || '0');

        if (polBalance < 0.02) {
          const fundResult = await fundDepositForSweep(deposit.deposit_address, '0.05');
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
