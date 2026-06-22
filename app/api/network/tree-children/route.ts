import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/network/tree-children?userId=xxx
 * Get a focus user's profile plus the 3 tree positions directly below them.
 *
 * Authorization: the requested userId must be the caller themselves, or a member
 * of the caller's downline (verified with position-range math). This lets the
 * team explorer drill down through the caller's own subtree, but not enumerate
 * arbitrary users elsewhere in the tree.
 *
 * Tree children are the positions directly below a user in the ternary tree —
 * different from direct referrals (people who used their referral code).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Caller must be authenticated.
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look up the caller's position (root of what they're allowed to see).
    const { data: caller, error: callerError } = await supabase
      .from('users')
      .select('network_level, network_position')
      .eq('id', authUser.id)
      .single()

    if (callerError || !caller || caller.network_position == null) {
      return NextResponse.json({ error: 'Caller has no network position' }, { status: 400 })
    }

    // Fetch the requested focus user's profile (also used for the auth check).
    const { data: focus, error: focusError } = await supabase
      .from('users')
      .select(
        'id, name, email, is_active, network_position_id, network_level, network_position, active_direct_referrals_count, active_network_count, total_network_count'
      )
      .eq('id', userId)
      .single()

    if (focusError || !focus) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Authorize: focus must be the caller, or within the caller's downline.
    if (focus.id !== authUser.id) {
      const callerLevel = caller.network_level as number
      const callerPos = caller.network_position as number
      const focusLevel = focus.network_level as number
      const focusPos = focus.network_position as number

      const levelDiff = focusLevel - callerLevel
      const span = Math.pow(3, levelDiff)
      const rangeStart = (callerPos - 1) * span + 1
      const rangeEnd = (callerPos - 1) * span + span

      if (levelDiff <= 0 || focusPos < rangeStart || focusPos > rangeEnd) {
        return NextResponse.json(
          { error: 'User is not in your downline' },
          { status: 403 }
        )
      }
    }

    // Get the focus user's 3 tree children.
    const { data: treeChildren, error } = await supabase
      .rpc('get_tree_children', { p_user_id: userId })

    if (error) {
      console.error('Error fetching tree children:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const filledSlots = treeChildren?.filter((c: { is_filled: boolean }) => c.is_filled).length || 0
    const emptySlots = 3 - filledSlots
    const directReferralSlots = treeChildren?.filter((c: { is_direct_referral: boolean }) => c.is_direct_referral).length || 0
    const spilloverSlots = filledSlots - directReferralSlots

    return NextResponse.json({
      focus: {
        id: focus.id,
        name: focus.name,
        email: focus.email,
        is_active: focus.is_active,
        network_position_id: focus.network_position_id,
        active_direct_referrals_count: focus.active_direct_referrals_count,
        active_network_count: focus.active_network_count,
        total_network_count: focus.total_network_count,
      },
      treeChildren: treeChildren || [],
      stats: {
        totalSlots: 3,
        filledSlots,
        emptySlots,
        directReferralSlots,
        spilloverSlots,
        isFull: filledSlots === 3
      }
    })
  } catch (error) {
    console.error('Error in tree-children API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
