import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * API endpoint to assign network position to a user
 * This should be called after user signup and referral creation
 *
 * Security: Uses service role to bypass RLS
 * - Position can only be assigned once per user
 * - Validates user exists before assignment
 * - Server-side only with service role credentials
 * - Bypasses RLS to work for both authenticated and unauthenticated users
 */
export async function POST(request: Request) {
  try {
    const supabase = createServiceRoleClient()

    const body = await request.json()
    const { userId, referrerId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Verify user exists and get their details
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, network_position_id, created_at')
      .eq('id', userId)
      .single()

    if (userError || !existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user already has a position
    if (existingUser.network_position_id) {
      return NextResponse.json({
        success: true,
        message: 'User already has a network position',
        positionId: existingUser.network_position_id
      })
    }

    // Optional: Verify user was created recently
    // This prevents old users from being assigned positions maliciously
    // More lenient in development (60 min), strict in production (10 min)
    const windowMinutes = process.env.NODE_ENV === 'development' ? 60 : 10
    const userCreatedAt = new Date(existingUser.created_at)
    const windowAgo = new Date(Date.now() - windowMinutes * 60 * 1000)

    if (userCreatedAt < windowAgo) {
      console.error(`Position assignment window expired. User created at ${userCreatedAt}, window is ${windowMinutes} minutes`)
      return NextResponse.json(
        { error: `Position assignment window expired. User must have been created within last ${windowMinutes} minutes.` },
        { status: 400 }
      )
    }

    // If referrer provided, verify they exist
    if (referrerId) {
      const { data: referrer, error: referrerError } = await supabase
        .from('users')
        .select('id, network_position_id')
        .eq('id', referrerId)
        .single()

      if (referrerError || !referrer) {
        return NextResponse.json(
          { error: 'Referrer not found' },
          { status: 404 }
        )
      }

      if (!referrer.network_position_id) {
        return NextResponse.json(
          { error: 'Referrer does not have a network position yet' },
          { status: 400 }
        )
      }
    }

    // Call the database function to assign position
    console.log('Calling assign_network_position:', { userId, referrerId })

    const { data, error } = await supabase.rpc('assign_network_position', {
      p_user_id: userId,
      p_referrer_id: referrerId || null
    })

    if (error) {
      console.error('Error assigning network position:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json(
        {
          error: error.message || 'Failed to assign network position',
          details: error.details,
          hint: error.hint
        },
        { status: 500 }
      )
    }

    console.log('Position assigned successfully:', data)

    // Fetch the updated user data
    const { data: updatedUser, error: fetchError } = await supabase
      .from('users')
      .select('network_position_id, network_level, network_position, tree_parent_network_position_id')
      .eq('id', userId)
      .single()

    if (fetchError) {
      console.error('Error fetching updated user:', fetchError)
    }

    console.log('Updated user data:', updatedUser)

    // Log upchain total_network_count increment
    if (updatedUser?.network_position_id) {
      try {
        const { data: upchain, error: upchainError } = await supabase
          .rpc('get_upline_chain', { start_position_id: updatedUser.network_position_id })

        if (!upchainError && upchain && upchain.length > 0) {
          const ancestorIds = upchain.filter((a: any) => a.user_id !== userId).map((a: any) => a.user_id)
          console.log(`✅ Upchain found: ${upchain.length - 1} ancestors (excluding self)`)
          console.log(`✅ Incremented total_network_count for ${ancestorIds.length} ancestors`)

          if (ancestorIds.length > 0) {
            const preview = ancestorIds.slice(0, 3)
            console.log(`   Affected ancestor IDs: [${preview.join(', ')}${ancestorIds.length > 3 ? `, ... +${ancestorIds.length - 3} more` : ''}]`)
          }
        } else if (upchainError) {
          console.error('Error fetching upchain for logging:', upchainError)
        } else {
          console.log('No upchain found (user might be root)')
        }
      } catch (err) {
        console.error('Exception while logging upchain:', err)
      }
    }

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
