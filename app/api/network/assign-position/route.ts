import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * API endpoint to assign network position to a user
 * This should be called after user signup and referral creation
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, referrerId } = body

    // Verify the requesting user is either the user being positioned or an admin
    if (userId !== authUser.id) {
      // TODO: Add admin check here if needed
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if user already has a position
    const { data: existingUser } = await supabase
      .from('users')
      .select('network_position_id')
      .eq('id', userId)
      .single()

    if (existingUser?.network_position_id) {
      return NextResponse.json({
        success: true,
        message: 'User already has a network position',
        positionId: existingUser.network_position_id
      })
    }

    // Call the database function to assign position
    const { data, error } = await supabase.rpc('assign_network_position', {
      p_user_id: userId,
      p_referrer_id: referrerId || null
    })

    if (error) {
      console.error('Error assigning network position:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to assign network position' },
        { status: 500 }
      )
    }

    // Fetch the updated user data
    const { data: updatedUser } = await supabase
      .from('users')
      .select('network_position_id, network_level, network_position, tree_parent_network_position_id')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Network position assigned successfully',
      positionId: data,
      user: updatedUser
    })
  } catch (error) {
    console.error('Error in assign-position API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
