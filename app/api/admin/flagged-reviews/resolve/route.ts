import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/admin/flagged-reviews/resolve
 * Resolve a flagged user review — dismiss or deactivate
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!currentUser || !['superadmin', 'superadmin+'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Unauthorized - superadmin+ only' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, action } = body;

    if (!userId || !['dismiss', 'deactivate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request. Required: userId, action (dismiss|deactivate)' }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();

    // Verify the user exists and is flagged
    const { data: targetUser, error: userError } = await serviceSupabase
      .from('users')
      .select('id, email, name, flagged_for_review, network_position_id')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!targetUser.flagged_for_review) {
      return NextResponse.json({ error: 'User is not flagged for review' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === 'dismiss') {
      // Clear the flag
      const { error: updateError } = await serviceSupabase
        .from('users')
        .update({
          flagged_for_review: false,
          flagged_for_review_at: null,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[FlaggedReviews] Failed to dismiss flag:', updateError);
        return NextResponse.json({ error: 'Failed to dismiss flag' }, { status: 500 });
      }

      // Log to audit
      await serviceSupabase.from('crypto_audit_log').insert({
        event_type: 'review_flag_dismissed',
        user_id: userId,
        entity_type: 'user',
        entity_id: userId,
        details: {
          dismissed_by: user.id,
          dismissed_by_email: user.email,
          target_email: targetUser.email,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Flag dismissed for ${targetUser.email}`,
      });
    }

    if (action === 'deactivate') {
      // Deactivate user and clear flag
      const { error: updateError } = await serviceSupabase
        .from('users')
        .update({
          is_active: false,
          inactive_since: now,
          flagged_for_review: false,
          flagged_for_review_at: null,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[FlaggedReviews] Failed to deactivate user:', updateError);
        return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
      }

      // Decrement upchain active count if user has network position
      if (targetUser.network_position_id) {
        const { error: rpcError } = await serviceSupabase.rpc('decrement_upchain_active_count', {
          p_user_id: userId,
        });

        if (rpcError) {
          console.warn(`[FlaggedReviews] Failed to update network counts for ${userId}:`, rpcError);
        }
      }

      // Log to audit
      await serviceSupabase.from('crypto_audit_log').insert({
        event_type: 'review_flag_deactivated',
        user_id: userId,
        entity_type: 'user',
        entity_id: userId,
        details: {
          deactivated_by: user.id,
          deactivated_by_email: user.email,
          target_email: targetUser.email,
        },
      });

      return NextResponse.json({
        success: true,
        message: `User ${targetUser.email} deactivated and flag cleared`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[FlaggedReviews] Resolve error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
