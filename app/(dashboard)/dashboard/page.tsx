import { auth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Users, DollarSign, TrendingUp, UserPlus, Lock, Unlock, CreditCard, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { isTestUser, mockDashboardData } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

async function getDashboardData(userId: string) {
  // Return mock data for test user
  if (isTestUser(userId)) {
    return {
      ...mockDashboardData,
      membershipStatus: 'unlocked',
      initialPaymentCompleted: true,
      directReferralSlots: 3,
      filledSlots: 2,
      teamPool: 4000,
      monthlyCommission: 400,
      teamLevels: {
        level1: 2,
        level2: 4,
        level3: 8,
        level4: 0,
        level5: 0,
        level6: 0,
      }
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

  // Get member slots
  const { data: memberSlots } = await supabase
    .from("member_slots")
    .select("*")
    .eq("user_id", userId)

  const filledSlots = memberSlots?.filter(slot => slot.filled_by_user_id !== null).length || 0

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

  // Calculate team pool (only active subscriptions count)
  const activeMembers = teamMembers?.filter(m => m.subscription_status === 'active').length || 0
  const teamPool = activeMembers * 200
  const monthlyCommission = teamPool * 0.10

  // Get referral stats
  const { data: referrals } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_id", userId)

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
    directReferralSlots: user?.direct_referral_slots || 0,
    filledSlots,
    totalReferrals: referrals?.length || 0,
    activeReferrals: referrals?.filter(r => r.status === "active").length || 0,
    totalEarnings,
    pendingEarnings,
    teamPool,
    monthlyCommission,
    teamLevels,
    totalTeamSize: Object.values(teamLevels).reduce((a, b) => a + b, 0),
  }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const data = await getDashboardData(session.user.id)
  const maxPotentialMembers = 3 + 9 + 27 + 81 + 243 + 729 // 3^1 + 3^2 + ... + 3^6

  return (
    <div>
      {/* Demo Mode Banner */}
      {isTestUser(session.user.id) && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                DEMO MODE
              </Badge>
              <span className="font-medium">
                You&apos;re using a test account with sample data
              </span>
            </div>
            <Link href="/register">
              <Button size="sm" variant="secondary">
                Create Real Account
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back, {data.user?.name || session.user.email}</p>
      </div>

      {/* Membership Status Alert */}
      {!data.initialPaymentCompleted && !isTestUser(session.user.id) && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-900">Unlock Your Membership</CardTitle>
            </div>
            <CardDescription className="text-red-700">
              Pay the one-time $500 membership fee to unlock your 3 referral slots and start building your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/payments">
              <Button className="bg-red-600 hover:bg-red-700">
                <Unlock className="h-4 w-4 mr-2" />
                Unlock Membership ($500)
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Subscription Alert */}
      {data.initialPaymentCompleted && !data.subscription && !isTestUser(session.user.id) && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-900">Activate Monthly Subscription</CardTitle>
            </div>
            <CardDescription className="text-yellow-700">
              Subscribe for $200/month to earn commissions from your team pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/payments">
              <Button className="bg-yellow-600 hover:bg-yellow-700">
                <CreditCard className="h-4 w-4 mr-2" />
                Start Monthly Subscription ($200/mo)
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Referral Slots */}
      {data.membershipStatus === 'unlocked' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Referral Slots</CardTitle>
            <CardDescription>
              You can have up to 3 direct referrals. Each referral unlocks their own 3 slots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((slot) => (
                <div
                  key={slot}
                  className={`p-4 rounded-lg border-2 ${
                    slot <= data.filledSlots
                      ? 'bg-green-50 border-green-300'
                      : 'bg-gray-50 border-gray-200 border-dashed'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1">
                      Slot {slot}
                    </div>
                    {slot <= data.filledSlots ? (
                      <Badge className="bg-green-600">Filled</Badge>
                    ) : (
                      <Badge variant="outline">Available</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Progress value={(data.filledSlots / 3) * 100} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">
                {data.filledSlots} of 3 slots filled
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Pool</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.teamPool)}</div>
            <p className="text-xs text-muted-foreground">
              Monthly team revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data.monthlyCommission)}
            </div>
            <p className="text-xs text-muted-foreground">
              10% of team pool
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Direct Referrals</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.filledSlots}/3</div>
            <p className="text-xs text-muted-foreground">
              Level 1 members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Team</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalTeamSize}</div>
            <p className="text-xs text-muted-foreground">
              Up to 6 levels deep
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Structure Breakdown */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Structure</CardTitle>
          <CardDescription>
            Your network can grow up to 6 levels deep with 3 members per level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.teamLevels).map(([level, count], index) => {
              const maxAtLevel = Math.pow(3, index + 1)
              const percentage = (count / maxAtLevel) * 100
              return (
                <div key={level} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Level {index + 1}</span>
                    <span className="text-muted-foreground">
                      {count} / {maxAtLevel} members
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              )
            })}
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium">Potential Monthly Earnings</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(maxPotentialMembers * 200 * 0.10)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              If all {maxPotentialMembers} slots are filled
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Grow your network and manage your account
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Link href="/referrals">
            <Button>
              <Share2 className="h-4 w-4 mr-2" />
              Get Referral Link
            </Button>
          </Link>
          <Link href="/group">
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              View Team Tree
            </Button>
          </Link>
          <Link href="/payments">
            <Button variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment History
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

// Add missing import
import { Share2 } from "lucide-react"