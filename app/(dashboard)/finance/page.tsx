"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  Wallet,
  ExternalLink,
  AlertCircle
} from "lucide-react"
import { AccountStatusCard } from "@/components/account-status-card"

interface DirectBonus {
  id: string
  referredUser: {
    name: string
    email: string
    joinedAt: string
  }
  bonusAmount: number
  status: "pending" | "paid"
  paidAt?: string
  createdAt: string
}

interface MonthlyEarning {
  month: string
  sniperVolume: number
  residualIncome: number
  directBonuses: number
  totalEarning: number
}

export default function FinancePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [directBonuses, setDirectBonuses] = useState<DirectBonus[]>([])
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarning[]>([])
  const [accountStatus, setAccountStatus] = useState({
    accountActive: false,
    activatedAt: null as Date | null,
    monthlyPaymentDueDate: null as Date | null,
    lastPaymentDate: null as Date | null,
    qualificationDeadline: null as Date | null,
    qualifiedAt: null as Date | null,
    directReferralsCount: 0,
    accumulatedResidual: 0,
    paymentSchedule: 'monthly' as 'weekly' | 'monthly',
    bypassSubscription: false
  })
  const [financialStats, setFinancialStats] = useState({
    totalSniperVolume: 0,
    currentMonthVolume: 0,
    totalResidualEarned: 0,
    currentMonthResidual: 0,
    totalDirectBonuses: 0,
    pendingBonuses: 0,
    paidBonuses: 0,
    lifetimeEarnings: 0,
    nextPayoutDate: "",
    nextPayoutAmount: 0,
    isQualified: false,
    activeMembers: 0,
    commissionRate: 0.10
  })
  const [loading, setLoading] = useState(true)
  const [stripeConnected, setStripeConnected] = useState(false)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [showDashboardError, setShowDashboardError] = useState(false)

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUser()
  }, [])

  useEffect(() => {
    async function fetchFinancialData() {
      if (!userId) return

      try {
        const supabase = createClient()

        // Fetch user account data
        const { data: userData } = await supabase
          .from('users')
          .select('is_active, last_payment_date, initial_payment_date, qualified_at, direct_referrals_count, active_network_count, current_commission_rate, bypass_direct_referrals, bypass_subscription, bypass_initial_payment, stripe_connect_account_id, payment_schedule')
          .eq('id', userId)
          .single()

        // Check if user has completed Stripe Connect onboarding
        setStripeConnected(!!userData?.stripe_connect_account_id)

        // Calculate next payment due date based on payment schedule
        let monthlyPaymentDueDate = null
        const paymentSchedule = userData?.payment_schedule || 'monthly'
        const daysToAdd = paymentSchedule === 'weekly' ? 7 : 30

        // Use last_payment_date if available, otherwise fall back to initial_payment_date
        const referenceDate = userData?.last_payment_date || userData?.initial_payment_date
        if (referenceDate) {
          const dateObj = new Date(referenceDate)
          monthlyPaymentDueDate = new Date(dateObj.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
        }

        setAccountStatus({
          accountActive: userData?.is_active || false,
          activatedAt: userData?.initial_payment_date ? new Date(userData.initial_payment_date) : null,
          monthlyPaymentDueDate,
          lastPaymentDate: userData?.last_payment_date ? new Date(userData.last_payment_date) : null,
          qualificationDeadline: null,
          qualifiedAt: userData?.qualified_at ? new Date(userData.qualified_at) : null,
          directReferralsCount: userData?.direct_referrals_count || 0,
          accumulatedResidual: 0,
          paymentSchedule: paymentSchedule as 'weekly' | 'monthly',
          bypassSubscription: userData?.bypass_subscription || false
        })

        // Fetch real network stats
        const statsResponse = await fetch(`/api/network/stats?userId=${userId}`)
        const stats = await statsResponse.json()

        // Fetch real payment history
        const { data: payments } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(12)

        // Use REAL sniper volume from API (stored in database)
        const sniperVolume = stats.sniperVolume?.currentMonth || 0
        const commissionRate = stats.earnings?.commissionRate || 0.10
        const monthlyResidual = sniperVolume * commissionRate
        const activeCount = stats.network?.activeMembers || 0

        // Format real payment data as monthly earnings
        // Group payments by month
        const paymentsByMonth = new Map<string, { total: number, count: number }>()
        payments?.forEach(p => {
          if (p.status === 'succeeded') {
            const month = new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            const existing = paymentsByMonth.get(month) || { total: 0, count: 0 }
            paymentsByMonth.set(month, {
              total: existing.total + parseFloat(p.amount),
              count: existing.count + 1
            })
          }
        })

        const monthlyEarnings: MonthlyEarning[] = Array.from(paymentsByMonth.entries()).map(([month, data]) => ({
          month,
          sniperVolume: sniperVolume,
          residualIncome: monthlyResidual,
          directBonuses: 0,
          totalEarning: data.total
        }))

        setMonthlyEarnings(monthlyEarnings)

        // Fetch direct bonuses from commissions table
        const { data: bonusData } = await supabase
          .from('commissions')
          .select(`
            id,
            amount,
            status,
            paid_at,
            created_at,
            referred_id,
            users!commissions_referred_id_fkey (
              name,
              email,
              created_at
            )
          `)
          .eq('referrer_id', userId)
          .eq('commission_type', 'direct_bonus')
          .order('created_at', { ascending: false })

        const formattedBonuses: DirectBonus[] = bonusData?.map(bonus => {
          const referredUser = Array.isArray(bonus.users) ? bonus.users[0] : bonus.users

          return {
            id: bonus.id,
            referredUser: {
              name: referredUser?.name || 'Unknown',
              email: referredUser?.email || 'unknown@email.com',
              joinedAt: referredUser?.created_at || bonus.created_at
            },
            bonusAmount: parseFloat(bonus.amount),
            status: bonus.status as "pending" | "paid",
            paidAt: bonus.paid_at || undefined,
            createdAt: bonus.created_at
          }
        }) || []

        setDirectBonuses(formattedBonuses)

        // Get real next payment date from subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('current_period_end')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single()

        let nextPayoutDate = ''
        if (subscription?.current_period_end) {
          nextPayoutDate = new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        } else if (monthlyPaymentDueDate) {
          nextPayoutDate = monthlyPaymentDueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        } else {
          // Fallback to 1st of next month
          const now = new Date()
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          nextPayoutDate = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        }

        const totalResidual = monthlyEarnings.reduce((sum, m) => sum + m.residualIncome, 0)
        const totalPayments = payments?.reduce((sum, p) => sum + (p.status === 'succeeded' ? parseFloat(p.amount) : 0), 0) || 0

        // Calculate bonus statistics
        const totalDirectBonuses = formattedBonuses.reduce((sum, b) => sum + b.bonusAmount, 0)
        const paidBonuses = formattedBonuses
          .filter(b => b.status === 'paid')
          .reduce((sum, b) => sum + b.bonusAmount, 0)
        const pendingBonuses = formattedBonuses
          .filter(b => b.status === 'pending')
          .reduce((sum, b) => sum + b.bonusAmount, 0)

        const lifetimeEarnings = totalPayments

        setFinancialStats({
          totalSniperVolume: sniperVolume,
          currentMonthVolume: sniperVolume,
          totalResidualEarned: totalResidual,
          currentMonthResidual: monthlyResidual,
          totalDirectBonuses,
          pendingBonuses,
          paidBonuses,
          lifetimeEarnings,
          nextPayoutDate,
          nextPayoutAmount: (stats.earnings?.canWithdraw) ? monthlyResidual : 0,
          isQualified: stats.earnings?.canWithdraw,
          activeMembers: activeCount,
          commissionRate: commissionRate
        })

        setLoading(false)
      } catch (error) {
        console.error('Error fetching financial data:', error)
        setLoading(false)
      }
    }

    fetchFinancialData()
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading financial data...</div>
      </div>
    )
  }

  const handlePayNow = () => {
    // Handle payment logic
    console.log("Processing payment...")
  }

  const handleOpenStripeDashboard = async () => {
    setLoadingDashboard(true)
    setDashboardError(null)
    try {
      const response = await fetch('/api/stripe/connect/dashboard', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setDashboardError(data.error || 'Failed to access dashboard')
        setShowDashboardError(true)
        return
      }

      // Open Stripe dashboard in new tab
      window.open(data.url, '_blank')
    } catch (error) {
      console.error('Error opening Stripe dashboard:', error)
      setDashboardError('Failed to open dashboard. Please try again.')
      setShowDashboardError(true)
    } finally {
      setLoadingDashboard(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Finance Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Track your earnings, bonuses, and team volume
        </p>
      </div>

      {/* Account Status Card */}
      <div className="mb-6">
        <AccountStatusCard
          accountActive={accountStatus.accountActive}
          monthlyPaymentDueDate={accountStatus.monthlyPaymentDueDate}
          lastPaymentDate={accountStatus.lastPaymentDate}
          paymentSchedule={accountStatus.paymentSchedule}
          bypassSubscription={accountStatus.bypassSubscription}
          onPayNow={handlePayNow}
        />
      </div>

      {/* Legacy Qualification Status - Hidden when using new countdown */}
      {false && !financialStats.isQualified && (
        <Card className="mb-6 border-yellow-500/20 bg-yellow-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-foreground">Earnings Not Yet Unlocked</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Refer 3 people to unlock residual income from your team volume
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4 inline mr-2" />
              Lifetime Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${financialStats.lifetimeEarnings.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All time total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4 inline mr-2" />
              Current Month Residual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${financialStats.currentMonthResidual.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{(financialStats.commissionRate * 100).toFixed(0)}% of team volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4 inline mr-2" />
              Direct Bonuses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${financialStats.totalDirectBonuses.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              ${financialStats.pendingBonuses} pending
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-primary">
              <Wallet className="h-4 w-4 inline mr-2" />
              Next Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${financialStats.nextPayoutAmount.toLocaleString()}
            </div>
            <p className="text-xs text-primary/80">{financialStats.nextPayoutDate}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="residual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="residual">Residual Income</TabsTrigger>
          <TabsTrigger value="bonuses">Direct Bonuses</TabsTrigger>
          <TabsTrigger value="history">Earnings History</TabsTrigger>
          <TabsTrigger value="settings">Payout Settings</TabsTrigger>
        </TabsList>

        {/* Residual Income Tab */}
        <TabsContent value="residual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Volume & Residual Income</CardTitle>
              <CardDescription>
                Your {(financialStats.commissionRate * 100).toFixed(0)}% commission from total active team monthly subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Current Month Volume</span>
                      <Badge variant="outline">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Badge>
                    </div>
                    <div className="text-3xl font-bold">
                      ${financialStats.currentMonthVolume.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{financialStats.activeMembers} active members</span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Your Residual ({(financialStats.commissionRate * 100).toFixed(0)}%)</span>
                      {financialStats.isQualified ? (
                        <Badge className="bg-primary/10 text-primary">Qualified</Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-400">Not Qualified</Badge>
                      )}
                    </div>
                    <div className="text-3xl font-bold text-primary">
                      ${financialStats.isQualified ? financialStats.currentMonthResidual.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "0"}
                    </div>
                    <div className="text-sm text-primary/80 mt-2">
                      {financialStats.isQualified ? `Earning ${(financialStats.commissionRate * 100).toFixed(0)}% commission` : "Get 3 active referrals to unlock"}
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Volume Breakdown</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Members</span>
                      <span className="font-medium">{financialStats.activeMembers} × $19.9 = ${financialStats.currentMonthVolume.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Your Commission Rate</span>
                      <span className="font-medium">{(financialStats.commissionRate * 100).toFixed(0)}%</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Monthly Residual Income</span>
                        <span className="font-bold text-primary">
                          ${financialStats.currentMonthResidual.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Direct Bonuses Tab */}
        <TabsContent value="bonuses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Direct Referral Bonuses</CardTitle>
              <CardDescription>
                Earn $249.50 (50% of $499) for each person you directly refer. Bonuses are paid monthly around the 15th alongside residual commissions. A 3.5% Stripe transaction fee applies to all payouts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Next Payout Notice */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Next Payout: ~15th of Each Month</h4>
                      <p className="text-sm text-muted-foreground">
                        Bonuses are paid monthly alongside residual commissions. Previous month&apos;s bonuses are processed together around the 15th to ensure a minimum 15-day holding period.
                      </p>
                    </div>
                  </div>
                </div>

                {directBonuses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p>No direct referral bonuses yet</p>
                    <p className="text-sm mt-2">Share your referral link to earn $249.50 per person who pays $499</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Total Bonuses</div>
                        <div className="text-2xl font-bold">${financialStats.totalDirectBonuses}</div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Paid</div>
                        <div className="text-2xl font-bold text-primary">${financialStats.paidBonuses}</div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Pending</div>
                        <div className="text-2xl font-bold text-amber-400">${financialStats.pendingBonuses}</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {directBonuses.map(bonus => {
                        return (
                          <div key={bonus.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex-1">
                                <div className="font-medium">{bonus.referredUser.name}</div>
                                <div className="text-sm text-muted-foreground">{bonus.referredUser.email}</div>
                                <div className="text-xs text-muted-foreground/70 mt-1">
                                  Joined {new Date(bonus.referredUser.joinedAt).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold">${bonus.bonusAmount.toFixed(2)}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  After 3.5% fee: ${(bonus.bonusAmount * 0.965).toFixed(2)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center mt-3 pt-3 border-t">
                              {bonus.status === "paid" ? (
                                <div>
                                  <Badge className="bg-green-500 text-white">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Paid
                                  </Badge>
                                  {bonus.paidAt && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {new Date(bonus.paidAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Pending Monthly Payout
                                  </Badge>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Will be paid ~15th of next month
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Earnings History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Earnings History</CardTitle>
              <CardDescription>
                Track your income over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {monthlyEarnings.map((earning, index) => (
                  <div key={earning.month} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{earning.month}</span>
                        {index === 0 && (
                          <Badge className="bg-primary/10 text-primary">Current</Badge>
                        )}
                      </div>
                      <div className="text-xl font-bold">
                        ${earning.totalEarning.toLocaleString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Sniper Volume</span>
                        <div className="font-medium">${earning.sniperVolume.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Residual ({(financialStats.commissionRate * 100).toFixed(0)}%)</span>
                        <div className="font-medium">${earning.residualIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Direct Bonuses</span>
                        <div className="font-medium">${earning.directBonuses.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Full History (CSV)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payout Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payout Settings</CardTitle>
              <CardDescription>
                Configure how you receive your earnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Payment Method</h4>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3 mb-2">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">Stripe Connect</div>
                          <div className="text-sm text-muted-foreground">
                            {stripeConnected
                              ? 'Your bank account is connected'
                              : 'Connect your bank account to receive payouts'}
                          </div>
                        </div>
                        {stripeConnected && (
                          <Badge className="bg-green-500 text-white">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                      </div>
                    </div>
                    {stripeConnected ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleOpenStripeDashboard}
                        disabled={loadingDashboard}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {loadingDashboard ? 'Opening...' : 'View Stripe Dashboard'}
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" className="w-full" disabled>
                          Configure Payout Method
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          Complete initial payment and onboarding to connect your bank account
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Payout Schedule</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Frequency</span>
                      <span className="font-medium">Monthly</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Next Payout Date</span>
                      <span className="font-medium">{financialStats.nextPayoutDate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Minimum Payout</span>
                      <span className="font-medium">$100</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium mb-2">Transaction Fees</h4>
                      <p className="text-sm text-muted-foreground">
                        All payouts include a <strong>3.5% transaction fee</strong> charged by Stripe for processing
                        bank transfers. This fee covers Stripe&apos;s costs for securely transferring funds
                        to your bank account. We pass this fee through at cost and do not add any
                        additional markup.
                      </p>
                      <div className="mt-3 p-3 bg-background rounded border">
                        <div className="text-xs font-medium mb-1">Example:</div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Gross Earnings:</span>
                            <span>$100.00</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Stripe Fee (3.5%):</span>
                            <span className="text-red-500">-$3.50</span>
                          </div>
                          <div className="flex justify-between font-semibold pt-1 border-t">
                            <span>Net Transfer:</span>
                            <span className="text-primary">$96.50</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Tax Information</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Download your earnings statements for tax purposes
                  </p>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download 1099 Form
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Dialog for Stripe Dashboard */}
      <Dialog open={showDashboardError} onOpenChange={setShowDashboardError}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Dashboard Access Error
            </DialogTitle>
            <DialogDescription>
              {dashboardError}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowDashboardError(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}