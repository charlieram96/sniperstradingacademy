import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/admin/users/deletion-requests
 * List all deletion requests (with optional status filter)
 */
export async function GET(req: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // pending, approved, rejected, completed, or null for all

    // Build query
    let query = supabase
      .from('user_deletion_requests')
      .select(`
        id,
        user_id,
        requested_by,
        requested_at,
        approved_by,
        approved_at,
        status,
        rejection_reason,
        user_email,
        user_name,
        requester:users!user_deletion_requests_requested_by_fkey (
          name,
          email
        ),
        approver:users!user_deletion_requests_approved_by_fkey (
          name,
          email
        )
      `)
      .order('requested_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: requests, error: queryError } = await query;

    if (queryError) {
      console.error('[DeletionRequestsAPI] Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch deletion requests' },
        { status: 500 }
      );
    }

    // Count pending requests
    const { count: pendingCount } = await supabase
      .from('user_deletion_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    return NextResponse.json({
      success: true,
      requests,
      pendingCount: pendingCount || 0,
      currentUserId: user.id // So UI knows who the current user is
    });
  } catch (error: unknown) {
    console.error('[DeletionRequestsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
