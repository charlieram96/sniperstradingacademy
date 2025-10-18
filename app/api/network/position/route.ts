import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseNetworkPositionId, formatPositionForDisplay } from '@/lib/network-positions'

/**
 * GET /api/network/position?userId=xxx
 * Get network position information for a user
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get user's network position data
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        network_position_id,
        network_level,
        network_position,
        tree_parent_network_position_id,
        referred_by,
        is_active,
        created_at
      `)
      .eq('id', userId)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse position details if available
    let positionDetails = null
    if (user.network_position_id) {
      const parsed = parseNetworkPositionId(user.network_position_id)
      positionDetails = {
        ...parsed,
        formatted: {
          full: formatPositionForDisplay(user.network_position_id, 'full'),
          short: formatPositionForDisplay(user.network_position_id, 'short'),
          levelOnly: formatPositionForDisplay(user.network_position_id, 'level-only'),
          positionOnly: formatPositionForDisplay(user.network_position_id, 'position-only')
        }
      }
    }

    // Get referrer info if available
    let referrer = null
    if (user.referred_by) {
      const { data: referrerData } = await supabase
        .from('users')
        .select('id, name, email, network_position_id')
        .eq('id', user.referred_by)
        .single()

      if (referrerData) {
        referrer = referrerData
      }
    }

    // Get tree parent info if available
    let treeParent = null
    if (user.tree_parent_network_position_id) {
      const { data: parentData } = await supabase
        .from('users')
        .select('id, name, email, network_position_id')
        .eq('network_position_id', user.tree_parent_network_position_id)
        .single()

      if (parentData) {
        treeParent = parentData
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.is_active,
        createdAt: user.created_at,
        hasPosition: !!user.network_position_id
      },
      position: positionDetails,
      referrer,
      treeParent,
      message: !user.network_position_id ? 'Network position will be assigned after $499 initial payment' : null
    })
  } catch (error) {
    console.error('Error fetching network position:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
