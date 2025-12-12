import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/admin/users/request-deletion
 * Request deletion of a user account (requires second superadmin approval)
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
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Prevent self-deletion request
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot request deletion of your own account' },
        { status: 400 }
      );
    }

    // Get the user to be deleted
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deletion of superadmins
    if (['superadmin', 'superadmin+'].includes(targetUser.role)) {
      return NextResponse.json(
        { error: 'Cannot delete superadmin accounts' },
        { status: 400 }
      );
    }

    // Check if there's already a pending deletion request for this user
    const { data: existingRequest } = await supabase
      .from('user_deletion_requests')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A pending deletion request already exists for this user' },
        { status: 400 }
      );
    }

    // Create the deletion request
    const { data: request, error: insertError } = await supabase
      .from('user_deletion_requests')
      .insert({
        user_id: userId,
        requested_by: user.id,
        user_email: targetUser.email,
        user_name: targetUser.name,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[RequestDeletionAPI] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create deletion request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      request,
      message: 'Deletion request created. Requires approval from another superadmin.'
    });
  } catch (error: unknown) {
    console.error('[RequestDeletionAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
