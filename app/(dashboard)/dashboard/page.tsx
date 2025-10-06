import { createClient } from "@/lib/supabase/server"
import { isTestUser, mockDashboardData } from "@/lib/mock-data"
import { DashboardClient } from "./dashboard-client"
import { redirect } from "next/navigation"

async function getDashboardData(userId: string) {
  // Return mock data for test user
  if (isTestUser(userId)) {
    return {
      ...mockDashboardData,
      membershipStatus: 'unlocked',
      initialPaymentCompleted: true,
      directReferrals: 2,
      teamPool: 4000,
      monthlyCommission: 400,
      commissionRate: 0.10,
      teamLevels: {
        level1: 2,
        level2: 4,
        level3: 8,
        level4: 0,
        level5: 0,
        level6: 0,
      },
      totalTeamSize: 14,
      completedStructures: 0,
      unlockedStructures: 1,
      maxMembersPerStructure: 1092,
    }
  }

  const supabase = await createClient()

  // Get user data with membership status
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single()

  // Get subscription status
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .single()

  // Get network stats from new API
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const statsResponse = await fetch(`${baseUrl}/api/network/stats?userId=${userId}`, {
    cache: 'no-store'
  })

  let networkStats = null
  let totalTeamSize = 0
  let directReferrals = 0
  let completedStructures = 0
  let unlockedStructures = 1
  let commissionRate = 0.10
  let teamPool = 0
  let monthlyCommission = 0

  if (statsResponse.ok) {
    networkStats = await statsResponse.json()
    totalTeamSize = networkStats.network?.totalMembers || 0
    directReferrals = networkStats.network?.directReferrals || 0
    completedStructures = networkStats.structures?.completed || 0
    unlockedStructures = networkStats.structures?.current || 1
    commissionRate = networkStats.earnings?.commissionRate || 0.10
    teamPool = networkStats.earnings?.monthlyVolume || 0
    monthlyCommission = networkStats.earnings?.actualMonthlyEarnings || 0
  }

  // Get referral stats for backward compatibility
  const { data: referrals } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_id", userId)

  // Create team levels breakdown (estimated distribution)
  // Since new system doesn't track per-level, we approximate based on tree structure
  const teamLevels = {
    level1: Math.min(totalTeamSize, 3),
    level2: Math.min(Math.max(0, totalTeamSize - 3), 9),
    level3: Math.min(Math.max(0, totalTeamSize - 12), 27),
    level4: Math.min(Math.max(0, totalTeamSize - 39), 81),
    level5: Math.min(Math.max(0, totalTeamSize - 120), 243),
    level6: Math.max(0, totalTeamSize - 363),
  }

  // Get commission stats
  const { data: commissions } = await supabase
    .from("commissions")
    .select("*")
    .eq("referrer_id", userId)

  const totalEarnings = commissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0
  const pendingEarnings = commissions?.filter(c => c.status === "pending")
    .reduce((sum, c) => sum + Number(c.amount), 0) || 0

  const maxMembersPerStructure = 1092 // 3 + 9 + 27 + 81 + 243 + 729

  return {
    user,
    subscription,
    membershipStatus: user?.membership_status || 'locked',
    initialPaymentCompleted: user?.initial_payment_completed || false,
    totalReferrals: referrals?.length || 0,
    activeReferrals: referrals?.filter(r => r.status === "active").length || 0,
    directReferrals,
    totalEarnings,
    pendingEarnings,
    teamPool,
    monthlyCommission,
    commissionRate,
    teamLevels,
    totalTeamSize,
    completedStructures,
    unlockedStructures,
    maxMembersPerStructure,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  const data = await getDashboardData(user.id)

  return (
    <DashboardClient
      data={data}
      session={{
        user: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.name || undefined
        }
      }}
    />
  )
}