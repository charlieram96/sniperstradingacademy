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

  // Get team hierarchy
  const { data: teamMembers } = await supabase
    .from("team_hierarchy")
    .select("*")
    .eq("team_owner_id", userId)

  // Calculate team levels
  const teamLevels = {
    level1: teamMembers?.filter(m => m.level === 1).length || 0,
    level2: teamMembers?.filter(m => m.level === 2).length || 0,
    level3: teamMembers?.filter(m => m.level === 3).length || 0,
    level4: teamMembers?.filter(m => m.level === 4).length || 0,
    level5: teamMembers?.filter(m => m.level === 5).length || 0,
    level6: teamMembers?.filter(m => m.level === 6).length || 0,
  } 

  // Get referral stats
  const { data: referrals } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_id", userId)

  // Calculate structures and commission rate
  const totalTeamSize = Object.values(teamLevels).reduce((a, b) => a + b, 0)
  const maxMembersPerStructure = 1092 // 3 + 9 + 27 + 81 + 243 + 729
  const completedStructures = Math.floor(totalTeamSize / maxMembersPerStructure)
  const directReferrals = referrals?.filter(r => r.status === "active").length || 0
  
  // Calculate unlocked structures (max 6)
  // First structure is always available
  // Each additional structure requires 3 more direct referrals
  let unlockedStructures = 1
  if (completedStructures >= 1 && directReferrals >= 6) unlockedStructures = 2
  if (completedStructures >= 2 && directReferrals >= 9) unlockedStructures = 3
  if (completedStructures >= 3 && directReferrals >= 12) unlockedStructures = 4
  if (completedStructures >= 4 && directReferrals >= 15) unlockedStructures = 5
  if (completedStructures >= 5 && directReferrals >= 18) unlockedStructures = 6
  
  // Commission rate: 10% + 1% per additional structure, 16% for Master Sniper (6 completed)
  const commissionRate = completedStructures >= 6 ? 0.16 : 0.10 + (Math.min(unlockedStructures - 1, 5) * 0.01)
  
  // Calculate team pool (only active subscriptions count)
  const activeMembers = teamMembers?.filter(m => m.subscription_status === 'active').length || 0
  const teamPool = activeMembers * 200
  const monthlyCommission = teamPool * commissionRate

  // Get commission stats
  const { data: commissions } = await supabase
    .from("commissions")
    .select("*")
    .eq("referrer_id", userId)

  const totalEarnings = commissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0
  const pendingEarnings = commissions?.filter(c => c.status === "pending")
    .reduce((sum, c) => sum + Number(c.amount), 0) || 0

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