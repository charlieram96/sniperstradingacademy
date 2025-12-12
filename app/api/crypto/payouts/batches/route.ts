/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/crypto/payouts/batches
 * List payout batches with filtering
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!['admin', 'superadmin', 'superadmin+'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('payout_batches')
      .select(`
        *,
        approved_by_user:users!payout_batches_approved_by_fkey(id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: batches, error, count } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch batches',
        details: error.message,
      }, { status: 500 });
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from('payout_batches')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      batches: batches?.map(batch => ({
        id: batch.id,
        name: batch.batch_name,
        type: batch.batch_type,
        totalAmount: batch.total_amount_usdc,
        totalPayouts: batch.total_payouts,
        estimatedGas: batch.estimated_gas_matic,
        status: batch.status,
        successfulPayouts: batch.successful_payouts,
        failedPayouts: batch.failed_payouts,
        totalGasSpent: batch.total_gas_spent_matic,
        approvedBy: batch.approved_by_user,
        approvedAt: batch.approved_at,
        completedAt: batch.completed_at,
        createdAt: batch.created_at,
        errorCount: batch.error_log?.length || 0,
      })) || [],
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        hasMore: (totalCount || 0) > offset + limit,
      },
    });
  } catch (error: any) {
    console.error('[ListBatches] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crypto/payouts/batches/[id]
 * Get a specific batch with full details
 */
