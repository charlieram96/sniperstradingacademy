import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/team/member-payments
 *
 * Query params:
 *   userId   (required) — the team leader's user ID
 *   memberId (optional) — if provided, returns full payment history for that member
 *
 * Without memberId: returns aggregate downline data (members, recent payments, stats).
 * With memberId: returns that member's user record and payment history (after verifying
 *   the member is in the caller's downline via position-range math).
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const memberId = searchParams.get('memberId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Verify the caller is authenticated and matches the userId
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser || authUser.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Shared: look up caller's network position ──
    const { data: caller, error: callerError } = await supabase
      .from('users')
      .select('network_position_id, network_level, network_position')
      .eq('id', userId)
      .single()

    if (callerError || !caller) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!caller.network_position_id) {
      return NextResponse.json(
        { error: 'User has no network position' },
        { status: 400 }
      )
    }

    // ────────────────────────────────────────────────
    // With memberId — single-member payment history
    // ────────────────────────────────────────────────
    if (memberId) {
      // Fetch member's position info for authorization check
      const { data: member, error: memberError } = await supabase
        .from('users')
        .select(
          'id, name, email, is_active, last_payment_date, next_payment_due_date, payment_schedule, initial_payment_completed, initial_payment_date, inactive_since, created_at, network_level, network_position'
        )
        .eq('id', memberId)
        .single()

      if (memberError || !member) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 })
      }

      // Authorization: verify member is in caller's downline using position-range math
      const callerLevel = caller.network_level as number
      const callerPos = caller.network_position as number
      const memberLevel = member.network_level as number
      const memberPos = member.network_position as number

      if (memberLevel <= callerLevel) {
        return NextResponse.json(
          { error: 'Member is not in your downline' },
          { status: 403 }
        )
      }

      const levelDiff = memberLevel - callerLevel
      const span = Math.pow(3, levelDiff)
      const rangeStart = (callerPos - 1) * span + 1
      const rangeEnd = (callerPos - 1) * span + span

      if (memberPos < rangeStart || memberPos > rangeEnd) {
        return NextResponse.json(
          { error: 'Member is not in your downline' },
          { status: 403 }
        )
      }

      // Fetch member's payments
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, payment_type, status, created_at')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false })
        .limit(50)

      return NextResponse.json({ member, payments: payments || [] })
    }

    // ────────────────────────────────────────────────
    // Without memberId — aggregate downline data
    // ────────────────────────────────────────────────

    // 1. Get downline member IDs via RPC
    const { data: downlineRows, error: downlineError } = await supabase
      .rpc('get_downline_contributors', { p_user_id: userId })

    if (downlineError) {
      console.error('[MemberPayments] Downline RPC error:', downlineError)
      return NextResponse.json(
        { error: 'Failed to fetch downline members' },
        { status: 500 }
      )
    }

    const memberIds: string[] = (downlineRows || []).map(
      (r: { contributor_id: string }) => r.contributor_id
    )

    // If no downline, return empty result
    if (memberIds.length === 0) {
      return NextResponse.json({
        members: [],
        recentPayments: [],
        stats: {
          totalMembers: 0,
          activeMembers: 0,
          atRiskCount: 0,
          recentlyLapsedCount: 0,
          revenueThisMonth: 0,
        },
      })
    }

    // 2. Fetch member details
    const { data: members } = await supabase
      .from('users')
      .select(
        'id, name, email, is_active, last_payment_date, next_payment_due_date, payment_schedule, initial_payment_completed, initial_payment_date, inactive_since, created_at'
      )
      .in('id', memberIds)

    // 3. Fetch recent payments for those members
    const { data: recentPaymentsRaw } = await supabase
      .from('payments')
      .select('id, user_id, amount, payment_type, status, created_at')
      .in('user_id', memberIds)
      .order('created_at', { ascending: false })
      .limit(50)

    // Attach user_name to each payment
    const memberMap = new Map(
      (members || []).map((m: { id: string; name: string | null }) => [m.id, m.name])
    )

    const recentPayments = (recentPaymentsRaw || []).map(
      (p: { id: string; user_id: string; amount: number; payment_type: string; status: string; created_at: string }) => ({
        ...p,
        user_name: memberMap.get(p.user_id) || null,
      })
    )

    // 4. Compute stats
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Start of current calendar month (UTC)
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    const allMembers = members || []
    const totalMembers = allMembers.length
    const activeMembers = allMembers.filter(
      (m: { is_active: boolean }) => m.is_active
    ).length

    const atRiskCount = allMembers.filter((m: { is_active: boolean; next_payment_due_date: string | null }) => {
      if (!m.is_active || !m.next_payment_due_date) return false
      const dueDate = new Date(m.next_payment_due_date)
      return dueDate <= sevenDaysFromNow
    }).length

    const recentlyLapsedCount = allMembers.filter(
      (m: { is_active: boolean; inactive_since: string | null }) => {
        if (m.is_active || !m.inactive_since) return false
        return new Date(m.inactive_since) >= thirtyDaysAgo
      }
    ).length

    // Revenue this month: separate query to get accurate sum (not limited to 50)
    const { data: revenueData } = await supabase
      .from('payments')
      .select('amount')
      .in('user_id', memberIds)
      .in('status', ['succeeded', 'completed'])
      .gte('created_at', monthStart.toISOString())

    const revenueThisMonth = (revenueData || [])
      .reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0)

    return NextResponse.json({
      members: allMembers,
      recentPayments,
      stats: {
        totalMembers,
        activeMembers,
        atRiskCount,
        recentlyLapsedCount,
        revenueThisMonth,
      },
    })
  } catch (error) {
    console.error('[MemberPayments] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
