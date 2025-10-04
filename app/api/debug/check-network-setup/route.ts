import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Diagnostic endpoint to check network position setup
 * This helps troubleshoot issues with position assignment
 *
 * Access: GET /api/debug/check-network-setup
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Check 1: Try to call a simple database query to verify connection
    // We'll check for functions existence later
    let networkFunctionsExist = false
    try {
      // Try calling the function with null parameters to see if it exists
      const { error: testError } = await supabase.rpc('assign_network_position', {
        p_user_id: null,
        p_referrer_id: null
      })
      // If we get a specific error about null user_id, the function exists
      networkFunctionsExist = !!testError && testError.message.includes('user_id')
    } catch {
      networkFunctionsExist = false
    }

    // Check 2: Does the company user exist?
    const { data: companyUser, error: companyError } = await supabase
      .from('users')
      .select('id, name, email, referral_code, network_position_id')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single()

    const companyUserExists = !!companyUser && !companyError

    // Check 3: Count users with and without positions
    const { data: usersData } = await supabase
      .from('users')
      .select('id, network_position_id, created_at')

    const totalUsers = usersData?.length || 0
    const usersWithPosition = usersData?.filter(u => u.network_position_id).length || 0
    const usersWithoutPosition = totalUsers - usersWithPosition

    // Check 4: Get recent users (last 5)
    const { data: recentUsers } = await supabase
      .from('users')
      .select('id, name, email, network_position_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    // Check 5: List of expected functions
    const functionsList: string[] = []
    if (networkFunctionsExist) {
      functionsList.push('assign_network_position')
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        networkFunctionsExist: {
          passed: networkFunctionsExist,
          message: networkFunctionsExist
            ? 'Network position functions are available'
            : 'Network position functions NOT FOUND - run supabase-network-position-schema.sql'
        },
        companyUserExists: {
          passed: companyUserExists,
          message: companyUserExists
            ? 'Snipers Trading Academy company user exists'
            : 'Company user NOT FOUND - run setup-company-user.sql',
          data: companyUser
        },
        userPositionStats: {
          total: totalUsers,
          withPosition: usersWithPosition,
          withoutPosition: usersWithoutPosition,
          percentageAssigned: totalUsers > 0 ? Math.round((usersWithPosition / totalUsers) * 100) : 0
        },
        databaseFunctions: {
          found: functionsList,
          missing: [
            'assign_network_position',
            'find_available_slot',
            'calculate_child_positions',
            'format_network_position_id',
            'parse_network_position_id'
          ].filter(f => !functionsList.includes(f))
        }
      },
      recentUsers: recentUsers?.map(u => ({
        name: u.name,
        email: u.email,
        hasPosition: !!u.network_position_id,
        positionId: u.network_position_id,
        createdAt: u.created_at
      })),
      recommendations: getRecommendations({
        networkFunctionsExist,
        companyUserExists,
        usersWithoutPosition
      })
    })
  } catch (error) {
    console.error('Error in network setup check:', error)
    return NextResponse.json(
      {
        error: 'Failed to check network setup',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function getRecommendations({
  networkFunctionsExist,
  companyUserExists,
  usersWithoutPosition
}: {
  networkFunctionsExist: boolean
  companyUserExists: boolean
  usersWithoutPosition: number
}): string[] {
  const recommendations: string[] = []

  if (!networkFunctionsExist) {
    recommendations.push('❌ Run supabase-network-position-schema.sql in Supabase SQL Editor to create network position functions')
  }

  if (!companyUserExists) {
    recommendations.push('❌ Run setup-company-user.sql in Supabase SQL Editor to create Snipers Trading Academy company user')
  }

  if (usersWithoutPosition > 0) {
    recommendations.push(`⚠️  ${usersWithoutPosition} user(s) do not have network positions assigned. They may have signed up before the system was set up.`)
  }

  if (networkFunctionsExist && companyUserExists && usersWithoutPosition === 0) {
    recommendations.push('✅ All systems operational! Network position setup is complete.')
  }

  return recommendations
}
