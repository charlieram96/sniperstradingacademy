import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * POST /api/admin/users/approve-deletion
 * Approve and execute a deletion request (must be different superadmin than requester)
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
    const { requestId } = await req.json();

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

    // Ensure approver is different from requester
    if (request.requested_by === user.id) {
      return NextResponse.json(
        { error: 'Cannot approve your own deletion request. Another superadmin must approve.' },
        { status: 400 }
      );
    }

    // Use service role client for admin operations
    const serviceSupabase = createServiceRoleClient();

    // Update request status to approved
    const { error: updateError } = await serviceSupabase
      .from('user_deletion_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[ApproveDeletionAPI] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update deletion request' },
        { status: 500 }
      );
    }

    // Create admin client for auth.users deletion
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Delete from public.users first (this will cascade to related tables)
    const { error: deleteUserError } = await serviceSupabase
      .from('users')
      .delete()
      .eq('id', request.user_id);

    if (deleteUserError) {
      console.error('[ApproveDeletionAPI] Delete user error:', deleteUserError);
      // Revert status
      await serviceSupabase
        .from('user_deletion_requests')
        .update({ status: 'pending', approved_by: null, approved_at: null })
        .eq('id', requestId);
      return NextResponse.json(
        { error: 'Failed to delete user from database' },
        { status: 500 }
      );
    }

    // Delete from auth.users
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(request.user_id);

    if (deleteAuthError) {
      console.error('[ApproveDeletionAPI] Delete auth user error:', deleteAuthError);
      // User is already deleted from public.users, mark as completed anyway
    }

    // Mark request as completed
    await serviceSupabase
      .from('user_deletion_requests')
      .update({ status: 'completed' })
      .eq('id', requestId);

    return NextResponse.json({
      success: true,
      message: `User ${request.user_email} has been permanently deleted`,
      deletedUserId: request.user_id,
      deletedUserEmail: request.user_email
    });
  } catch (error: unknown) {
    console.error('[ApproveDeletionAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
