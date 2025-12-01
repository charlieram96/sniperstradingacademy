/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/crypto/payouts/approve-batch
 * Admin approves a payout batch for execution
 */
export async function POST(req: NextRequest) {
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

    if (!['admin', 'superadmin'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { batchId } = body;

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batchId' }, { status: 400 });
    }

    // Get the batch
    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({
        success: false,
        error: 'Batch not found',
      }, { status: 404 });
    }

    // Check batch status
    if (batch.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: `Batch cannot be approved from status: ${batch.status}`,
      }, { status: 400 });
    }

    // Update batch to approved
    const { data: updatedBatch, error: updateError } = await supabase
      .from('payout_batches')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', batchId)
      .eq('status', 'pending') // Ensure atomic update
      .select()
      .single();

    if (updateError || !updatedBatch) {
      return NextResponse.json({
        success: false,
        error: 'Failed to approve batch (may have changed state)',
      }, { status: 409 });
    }

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'payout_approved',
      user_id: null,
      admin_id: user.id,
      entity_type: 'payout_batch',
      entity_id: batchId,
      details: {
        batch_name: batch.batch_name,
        total_amount: batch.total_amount_usdc,
        total_payouts: batch.total_payouts,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Batch approved successfully',
      batch: {
        id: updatedBatch.id,
        name: updatedBatch.batch_name,
        status: updatedBatch.status,
        approvedBy: user.id,
        approvedAt: updatedBatch.approved_at,
      },
    });
  } catch (error: any) {
    console.error('[ApproveBatch] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
