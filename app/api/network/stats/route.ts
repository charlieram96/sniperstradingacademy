import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  NETWORK_CONSTANTS
} from '@/lib/network-positions'

/**
 * GET /api/network/stats?userId=xxx
 * Get network statistics for a user
 *
 * UPDATED: Now uses denormalized data from users table for better performance
 * - sniper_volume_current_month (real-time incremented on payments)
 * - active_network_count (updated after each payment in network)
 * - current_commission_rate (auto-calculated based on structure)
 * - current_structure_number (auto-updated)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get user's denormalized network data (fast single query)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        network_position_id,
        sniper_volume_current_month,
        sniper_volume_previous_month,
        active_network_count,
        total_network_count,
        current_commission_rate,
        current_structure_number,
        last_payment_date,
        is_active,
        premium_bypass,
        bypass_direct_referrals,
        bypass_subscription,
        bypass_initial_payment
      `)
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Handle users without network positions (haven't paid $499 yet)
    if (!user.network_position_id) {
      // Count direct referrals (works without position)
      const { count: directReferralCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', userId)

      return NextResponse.json({
        network: {
          totalMembers: 0,
          activeMembers: 0,
          inactiveMembers: 0,
          directReferrals: directReferralCount || 0
        },
        structures: {
          completed: 0,
          current: 0,
          progress: 0,
          progressPercentage: 0,
          maxStructures: NETWORK_CONSTANTS.MAX_STRUCTURES
        },
        sniperVolume: {
          currentMonth: 0,
          previousMonth: 0,
          capped: 0,
          maxPossible: 0
        },
        earnings: {
          commissionRate: 0,
          monthlyVolume: 0,
          potentialMonthlyEarnings: 0,
          actualMonthlyEarnings: 0,
          canWithdraw: false,
          withdrawalRequirement: {
            currentReferrals: directReferralCount || 0,
            requiredReferrals: 0,
            deficit: 0,
            message: 'Complete $499 initial payment to unlock network position and start earning'
          }
        },
        status: {
          isActive: false,
          hasNetworkPosition: false,
          lastPaymentDate: user.last_payment_date
        }
      })
    }

    // Count direct referrals
    const { count: directReferralCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', userId)

    // Calculate structure stats
    const completedStructures = Math.floor(user.active_network_count / 1092)
    const currentStructureProgress = user.active_network_count % 1092
    const currentStructurePercentage = (currentStructureProgress / 1092) * 100

    // Calculate required referrals for withdrawal
    const requiredReferrals = user.current_structure_number * 3
    const referralCount = directReferralCount || 0

    // Check granular bypass settings
    let withdrawalMessage: string

    // Check if user is active (paid within 33 days OR has subscription bypass)
    const isActive = user.bypass_subscription
      ? true
      : !!(user.last_payment_date &&
        new Date(user.last_payment_date) >= new Date(Date.now() - 33 * 24 * 60 * 60 * 1000))

    // Check referral requirement (can be bypassed with count)
    // User is treated as having whichever is greater: actual count or bypass count
    const effectiveReferralCount = Math.max(referralCount, user.bypass_direct_referrals || 0)
    const hasEnoughReferrals = effectiveReferralCount >= requiredReferrals
    const referralDeficit = Math.max(0, requiredReferrals - effectiveReferralCount)

    // Determine withdrawal eligibility
    const canWithdraw = isActive && hasEnoughReferrals

    // Calculate earnings (capped at 6,552 × $199)
    const maxVolume = 6552 * 199
    const cappedVolume = Math.min(user.sniper_volume_current_month, maxVolume)
    const potentialMonthlyEarnings = cappedVolume * user.current_commission_rate
    const actualMonthlyEarnings = canWithdraw ? potentialMonthlyEarnings : 0

    // Withdrawal eligibility message
    const hasReferralBypass = user.bypass_direct_referrals > 0
    const hasSubscriptionBypass = user.bypass_subscription

    if (hasReferralBypass && hasSubscriptionBypass) {
      withdrawalMessage = `Qualified via Bypass Access (${user.bypass_direct_referrals} referrals & subscription)`
    } else if (hasReferralBypass) {
      if (!isActive) {
        withdrawalMessage = 'Account not active (must pay within 33 days)'
      } else {
        withdrawalMessage = `Qualified with ${user.bypass_direct_referrals} bypassed referral${user.bypass_direct_referrals !== 1 ? 's' : ''}`
      }
    } else if (hasSubscriptionBypass) {
      if (referralDeficit > 0) {
        withdrawalMessage = `Need ${referralDeficit} more direct referral${referralDeficit !== 1 ? 's' : ''} to withdraw`
      } else {
        withdrawalMessage = 'Qualified via Bypass Access (Subscription)'
      }
    } else {
      // No bypasses - regular user
      if (!isActive) {
        withdrawalMessage = 'Account not active (must pay within 33 days)'
      } else if (referralDeficit > 0) {
        withdrawalMessage = `Need ${referralDeficit} more direct referral${referralDeficit !== 1 ? 's' : ''} to withdraw`
      } else {
        withdrawalMessage = `Eligible to withdraw from structure ${user.current_structure_number}`
      }
    }

    return NextResponse.json({
      network: {
        totalMembers: user.total_network_count,
        activeMembers: user.active_network_count,
        inactiveMembers: user.total_network_count - user.active_network_count,
        directReferrals: referralCount
      },
      structures: {
        completed: completedStructures,
        current: user.current_structure_number,
        progress: currentStructureProgress,
        progressPercentage: currentStructurePercentage,
        maxStructures: NETWORK_CONSTANTS.MAX_STRUCTURES
      },
      sniperVolume: {
        currentMonth: user.sniper_volume_current_month,
        previousMonth: user.sniper_volume_previous_month,
        capped: cappedVolume,
        maxPossible: maxVolume
      },
      earnings: {
        commissionRate: user.current_commission_rate,
        monthlyVolume: user.sniper_volume_current_month,
        potentialMonthlyEarnings,
        actualMonthlyEarnings,
        canWithdraw,
        withdrawalRequirement: {
          currentReferrals: referralCount,
          requiredReferrals,
          deficit: referralDeficit,
          message: withdrawalMessage
        }
      },
      status: {
        isActive,
        hasNetworkPosition: true,
        lastPaymentDate: user.last_payment_date
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
