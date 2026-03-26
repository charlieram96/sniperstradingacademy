import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/admin/users/toggle-active
 * Toggle a user's active status
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin authentication
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
    const { userId, isActive, nextPaymentDueDate } = await req.json();

    if (!userId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'userId and isActive (boolean) are required' },
        { status: 400 }
      );
    }

    // Prevent self-deactivation
    if (userId === user.id && !isActive) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS for the update
    const serviceSupabase = createServiceRoleClient();

    // Build update payload
    const updatePayload: Record<string, unknown> = { is_active: isActive };

    // When reactivating, clear inactive_since and optionally set next payment due date
    if (isActive) {
      updatePayload.inactive_since = null;

      if (nextPaymentDueDate) {
        const dueDate = new Date(nextPaymentDueDate);
        if (isNaN(dueDate.getTime())) {
          return NextResponse.json(
            { error: 'nextPaymentDueDate must be a valid date string' },
            { status: 400 }
          );
        }
        updatePayload.next_payment_due_date = dueDate.toISOString();
        updatePayload.paid_for_period = true;
        updatePayload.last_payment_date = new Date().toISOString();
      }
    }

    // Update user active status
    const { data: updatedUser, error: updateError } = await serviceSupabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('id, name, email, is_active')
      .single();

    if (updateError) {
      console.error('[ToggleActiveAPI] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error: unknown) {
    console.error('[ToggleActiveAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
