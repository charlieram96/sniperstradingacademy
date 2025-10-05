import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/network/tree-children?userId=xxx
 * Get the 3 direct tree positions below a user
 *
 * Returns the user's tree children (positions directly below them in the ternary tree)
 * This is different from direct referrals (people who used their code)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the user's 3 tree children
    const { data: treeChildren, error } = await supabase
      .rpc('get_tree_children', { p_user_id: userId })

    if (error) {
      console.error('Error fetching tree children:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Calculate tree statistics
    const filledSlots = treeChildren?.filter((c: { is_filled: boolean }) => c.is_filled).length || 0
    const emptySlots = 3 - filledSlots
    const directReferralSlots = treeChildren?.filter((c: { is_direct_referral: boolean }) => c.is_direct_referral).length || 0
    const spilloverSlots = filledSlots - directReferralSlots

    return NextResponse.json({
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
