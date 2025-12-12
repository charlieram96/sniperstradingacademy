import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/admin/users/reject-deletion
 * Reject a pending deletion request
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify superadmin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!['superadmin', 'superadmin+'].includes(adminData?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized - Superadmin required' }, { status: 401 });
    }

    // Parse request body
    const { requestId, reason } = await req.json();

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }

    // Get the deletion request
    const { data: request, error: requestError } = await supabase
      .from('user_deletion_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      return NextResponse.json({ error: 'Pending deletion request not found' }, { status: 404 });
    }

    // Update request status to rejected
    const { error: updateError } = await supabase
      .from('user_deletion_requests')
      .update({
        status: 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason || null
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[RejectDeletionAPI] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update deletion request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Deletion request rejected',
      requestId
    });
  } catch (error: unknown) {
    console.error('[RejectDeletionAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
