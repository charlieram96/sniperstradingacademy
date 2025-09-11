import { auth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Users, DollarSign, TrendingUp, UserPlus } from "lucide-react"
import Link from "next/link"
import { isTestUser, mockDashboardData } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"

async function getDashboardData(userId: string) {
  // Return mock data for test user
  if (isTestUser(userId)) {
    return mockDashboardData
  }

  const supabase = await createClient()

  // Get user data
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

  // Get group members count
  const { data: groupMembers } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_owner_id", userId)

  return {
    user,
    subscription,
    totalReferrals: referrals?.length || 0,
    activeReferrals: referrals?.filter(r => r.status === "active").length || 0,
    totalEarnings,
    pendingEarnings,
    groupSize: (groupMembers?.length || 0) + 1, // +1 for the user themselves
  }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const data = await getDashboardData(session.user.id)

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
                You're using a test account with sample data
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

      {/* Subscription Alert */}
      {!data.subscription && !isTestUser(session.user.id) && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-900">Activate Your Subscription</CardTitle>
            <CardDescription className="text-yellow-700">
              Subscribe for $200/month to start earning commissions from your referrals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/payments">
              <Button>Subscribe Now</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalEarnings)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(data.pendingEarnings)} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Direct Referrals</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalReferrals}</div>
            <p className="text-xs text-muted-foreground">
              {data.activeReferrals} active subscribers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Group Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.groupSize}</div>
            <p className="text-xs text-muted-foreground">
              Total network members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.activeReferrals * 2000)}
            </div>
            <p className="text-xs text-muted-foreground">
              From active referrals
            </p>
          </CardContent>
        </Card>
      </div>

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
              View My Group
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

// Add missing import for Share2
import { Share2, CreditCard } from "lucide-react"