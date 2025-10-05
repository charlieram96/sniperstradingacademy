import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Admin API to fix orphaned users (users without network positions)
 *
 * GET /api/admin/fix-positions
 * - Returns list of orphaned users
 *
 * POST /api/admin/fix-positions
 * - Fix a specific user by userId
 * - Or fix all orphaned users if no userId provided
 */

export async function GET() {
  try {
    const supabase = await createClient()

    // Find all orphaned users
    const { data: orphanedUsers, error } = await supabase
      .from('users')
      .select('id, email, name, created_at, referred_by, network_position_id')
      .is('network_position_id', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error finding orphaned users:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      count: orphanedUsers?.length || 0,
      users: orphanedUsers || []
    })
  } catch (error) {
    console.error('Error in fix-positions GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, fixAll } = body
    const supabase = await createClient()

    // Fix single user
    if (userId && !fixAll) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, referred_by, network_position_id')
        .eq('id', userId)
        .single()

      if (userError || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (user.network_position_id) {
        return NextResponse.json({
          error: 'User already has position',
          positionId: user.network_position_id
        }, { status: 400 })
      }

      // Assign position
      const { data: positionId, error: assignError } = await supabase.rpc(
        'assign_network_position',
        {
          p_user_id: user.id,
          p_referrer_id: user.referred_by
        }
      )

      if (assignError) {
        console.error('Error assigning position:', assignError)
        return NextResponse.json({
          error: assignError.message,
          details: assignError.details,
          hint: assignError.hint
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        userId: user.id,
        email: user.email,
        positionId,
        message: 'Position assigned successfully'
      })
    }

    // Fix all orphaned users
    if (fixAll) {
      const { data: orphanedUsers } = await supabase
        .from('users')
        .select('id, email, referred_by')
        .is('network_position_id', null)
        .order('created_at', { ascending: true })

      if (!orphanedUsers || orphanedUsers.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No orphaned users found',
          processed: 0,
          successful: 0,
          failed: 0
        })
      }

      const results = []
      let successCount = 0
      let failureCount = 0

      for (const user of orphanedUsers) {
        try {
          const { data: positionId, error: assignError } = await supabase.rpc(
            'assign_network_position',
            {
              p_user_id: user.id,
              p_referrer_id: user.referred_by
            }
          )

          if (assignError) {
            results.push({
              userId: user.id,
              email: user.email,
              status: 'failed',
              error: assignError.message
            })
            failureCount++
          } else {
            results.push({
              userId: user.id,
              email: user.email,
              status: 'success',
              positionId
            })
            successCount++
          }
        } catch (err) {
          results.push({
            userId: user.id,
            email: user.email,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error'
          })
          failureCount++
        }
      }

      return NextResponse.json({
        success: true,
        message: `Processed ${orphanedUsers.length} orphaned users`,
        processed: orphanedUsers.length,
        successful: successCount,
        failed: failureCount,
        results
      })
    }

    return NextResponse.json(
      { error: 'Must provide userId or fixAll=true' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in fix-positions POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
