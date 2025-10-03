import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/network/upline?userId=xxx
 * Get upline chain (all ancestors) for a user
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get user's network position
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('network_position_id')
      .eq('id', userId)
      .single()

    if (userError || !user || !user.network_position_id) {
      return NextResponse.json({ error: 'User not found or has no network position' }, { status: 404 })
    }

    // Get upline chain using database function
    const { data: uplineChain, error: uplineError } = await supabase
      .rpc('get_upline_chain', {
        start_position_id: user.network_position_id
      })

    if (uplineError) {
      console.error('Error getting upline chain:', uplineError)
      return NextResponse.json({ error: 'Failed to get upline chain' }, { status: 500 })
    }

    // Get full user details for each member in upline
    const uplineWithDetails = []

    for (const member of uplineChain || []) {
      if (member.user_id) {
        const { data: memberData } = await supabase
          .from('users')
          .select('id, name, email, network_position_id, is_active')
          .eq('id', member.user_id)
          .single()

        if (memberData) {
          uplineWithDetails.push({
            userId: memberData.id,
            name: memberData.name,
            email: memberData.email,
            networkPositionId: memberData.network_position_id,
            level: member.network_level,
            position: member.network_position,
            isActive: memberData.is_active
          })
        }
      }
    }

    return NextResponse.json({
      upline: uplineWithDetails,
      count: uplineWithDetails.length,
      depth: uplineWithDetails.length > 0 ? uplineWithDetails[0].level : 0
    })
  } catch (error) {
    console.error('Error fetching upline:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
