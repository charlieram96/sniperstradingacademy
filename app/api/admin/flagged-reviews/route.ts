import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { roleRank } from '@/lib/admin/permissions';
import { computeMissedWeeks, getWindowStart } from '@/lib/payments/review-window';

export const runtime = 'nodejs';

/**
 * GET /api/admin/flagged-reviews
 * Get users flagged for payment compliance review
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('role, permissions')
      .eq('id', user.id)
      .single();

    if (!(roleRank(currentUser?.role) >= roleRank('superadmin+') || (currentUser?.permissions ?? []).includes('view_flagged_reviews'))) {
      return NextResponse.json({ error: 'Unauthorized - superadmin+ only' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const schedule = searchParams.get('schedule') || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    const serviceSupabase = createServiceRoleClient();

    // Build query for flagged users
    let query = serviceSupabase
      .from('users')
      .select('id, email, name, payment_schedule, flagged_for_review_at, is_active, network_position_id, initial_payment_date', { count: 'exact' })
      .eq('flagged_for_review', true);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (schedule !== 'all') {
      query = query.eq('payment_schedule', schedule);
    }

    query = query.order('flagged_for_review_at', { ascending: false });

    const { data: flaggedUsers, count: totalCount, error: queryError } = await query
      .range(offset, offset + limit - 1);

    if (queryError) {
      console.error('[FlaggedReviews] Query error:', queryError);
      return NextResponse.json({ error: 'Failed to query flagged users' }, { status: 500 });
    }

    // Get payment data for these users to calculate missed_weeks and last_payment_date
    const userIds = (flaggedUsers || []).map(u => u.id);
    const now = new Date();
    const windowStart = getWindowStart(now);

    let usersWithPaymentData = (flaggedUsers || []).map(u => ({
      ...u,
      missed_weeks: 0,
      last_payment_date: null as string | null,
    }));

    if (userIds.length > 0) {
      // Get payment counts in window
      const { data: payments } = await serviceSupabase
        .from('payments')
        .select('user_id, id, payment_type, created_at')
        .in('user_id', userIds)
        .eq('status', 'succeeded')
        .in('payment_type', ['weekly', 'monthly'])
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: false });

      // Get last payment per user
      const { data: lastPayments } = await serviceSupabase
        .from('payments')
        .select('user_id, created_at')
        .in('user_id', userIds)
        .eq('status', 'succeeded')
        .in('payment_type', ['weekly', 'monthly'])
        .order('created_at', { ascending: false });

      // Count weekly and monthly payments separately so coverage matches the
      // cron's math: each weekly payment covers 1 week, each monthly covers 4.
      const weeklyCountMap = new Map<string, number>();
      const monthlyCountMap = new Map<string, number>();
      const lastPaymentMap = new Map<string, string>();

      for (const p of payments || []) {
        const target = p.payment_type === 'weekly' ? weeklyCountMap : monthlyCountMap;
        target.set(p.user_id, (target.get(p.user_id) || 0) + 1);
      }

      for (const p of lastPayments || []) {
        if (!lastPaymentMap.has(p.user_id)) {
          lastPaymentMap.set(p.user_id, p.created_at);
        }
      }

      usersWithPaymentData = (flaggedUsers || []).map(u => {
        const coverageWeeks = (weeklyCountMap.get(u.id) || 0) + (monthlyCountMap.get(u.id) || 0) * 4;
        // Anchor to the user's own liability start (consistent with the flagging cron).
        const initialPaymentDate = u.initial_payment_date ? new Date(u.initial_payment_date) : null;
        const missedWeeks = computeMissedWeeks(coverageWeeks, now, initialPaymentDate);

        return {
          ...u,
          missed_weeks: missedWeeks,
          last_payment_date: lastPaymentMap.get(u.id) || null,
        };
      });
    }

    // Calculate stats
    const { count: totalFlagged } = await serviceSupabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('flagged_for_review', true);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { count: flaggedThisWeek } = await serviceSupabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('flagged_for_review', true)
      .gte('flagged_for_review_at', oneWeekAgo.toISOString());

    const { count: weeklyCount } = await serviceSupabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('flagged_for_review', true)
      .eq('payment_schedule', 'weekly');

    const { count: monthlyCount } = await serviceSupabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('flagged_for_review', true)
      .eq('payment_schedule', 'monthly');

    return NextResponse.json({
      success: true,
      users: usersWithPaymentData,
      stats: {
        totalFlagged: totalFlagged || 0,
        flaggedThisWeek: flaggedThisWeek || 0,
        weeklyCount: weeklyCount || 0,
        monthlyCount: monthlyCount || 0,
      },
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasMore: offset + limit < (totalCount || 0),
      },
    });
  } catch (error: unknown) {
    console.error('[FlaggedReviews] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
