import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  calculateStructureStats,
  getCommissionRate,
  getRequiredDirectReferrals,
  canWithdrawEarnings,
  NETWORK_CONSTANTS
} from '@/lib/network-positions'

/**
 * GET /api/network/stats?userId=xxx
 * Get network statistics for a user
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
      .select('network_position_id, is_active')
      .eq('id', userId)
      .single()

    if (userError || !user || !user.network_position_id) {
      return NextResponse.json({ error: 'User not found or has no network position' }, { status: 404 })
    }

    // Get network size using database function
    const { data: networkSize, error: sizeError } = await supabase
      .rpc('count_network_size', {
        p_network_position_id: user.network_position_id
      })

    if (sizeError) {
      console.error('Error counting network size:', sizeError)
      return NextResponse.json({ error: 'Failed to calculate network size' }, { status: 500 })
    }

    const totalCount = networkSize?.[0]?.total_count || 0
    const activeCount = networkSize?.[0]?.active_count || 0

    // Count direct referrals
    const { data: directReferrals, error: referralsError } = await supabase
      .rpc('count_direct_referrals', {
        p_user_id: userId
      })

    if (referralsError) {
      console.error('Error counting direct referrals:', referralsError)
    }

    const directReferralCount = directReferrals || 0

    // Calculate structure stats
    const structureStats = calculateStructureStats(totalCount)
    const commissionRate = getCommissionRate(structureStats.structureNumber)
    const requiredReferrals = getRequiredDirectReferrals(structureStats.completedStructures + 1)
    const withdrawalEligibility = canWithdrawEarnings(directReferralCount, structureStats.completedStructures)

    // Calculate earnings
    const monthlyVolume = activeCount * NETWORK_CONSTANTS.MONTHLY_CONTRIBUTION
    const potentialMonthlyEarnings = monthlyVolume * commissionRate
    const actualMonthlyEarnings = withdrawalEligibility.canWithdraw ? potentialMonthlyEarnings : 0

    return NextResponse.json({
      network: {
        totalMembers: totalCount,
        activeMembers: activeCount,
        inactiveMembers: totalCount - activeCount,
        directReferrals: directReferralCount
      },
      structures: {
        completed: structureStats.completedStructures,
        current: structureStats.structureNumber,
        progress: structureStats.currentStructureProgress,
        progressPercentage: structureStats.currentStructurePercentage,
        maxStructures: NETWORK_CONSTANTS.MAX_STRUCTURES
      },
      earnings: {
        monthlyVolume,
        commissionRate,
        potentialMonthlyEarnings,
        actualMonthlyEarnings,
        canWithdraw: withdrawalEligibility.canWithdraw,
        withdrawalRequirement: {
          currentReferrals: directReferralCount,
          requiredReferrals,
          deficit: withdrawalEligibility.deficit,
          message: withdrawalEligibility.message
        }
      },
      status: {
        isActive: user.is_active,
        hasNetworkPosition: true
      }
    })
  } catch (error) {
    console.error('Error fetching network stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
