"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  AlertCircle
} from "lucide-react"
import { AccountStatusCard } from "@/components/account-status-card"
import PayoutWalletSetup from "@/components/crypto/PayoutWalletSetup"
import { motion } from "framer-motion"
import { staggerContainer, staggerItem } from "@/lib/motion"
import { AnimatedNumber } from "@/components/motion/animated-number"
import { PageHeader } from "@/components/page-header"
import { useTranslation } from "@/components/language-provider"

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
  const { t } = useTranslation()
  const router = useRouter()
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
    bypassSubscription: false,
    payoutWalletAddress: null as string | null
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
          .select('is_active, previous_payment_due_date, next_payment_due_date, initial_payment_date, qualified_at, direct_referrals_count, active_network_count, current_commission_rate, bypass_direct_referrals, bypass_subscription, bypass_initial_payment, payment_schedule, payout_wallet_address')
          .eq('id', userId)
          .single()

        // Get payment schedule and next payment due date directly from database
        const paymentSchedule = userData?.payment_schedule || 'monthly'
        const monthlyPaymentDueDate = userData?.next_payment_due_date
          ? new Date(userData.next_payment_due_date)
          : null

        setAccountStatus({
          accountActive: userData?.is_active || false,
          activatedAt: userData?.initial_payment_date ? new Date(userData.initial_payment_date) : null,
          monthlyPaymentDueDate,
          lastPaymentDate: userData?.previous_payment_due_date ? new Date(userData.previous_payment_due_date) : null,
          qualificationDeadline: null,
          qualifiedAt: userData?.qualified_at ? new Date(userData.qualified_at) : null,
          directReferralsCount: userData?.direct_referrals_count || 0,
          accumulatedResidual: 0,
          paymentSchedule: paymentSchedule as 'weekly' | 'monthly',
          bypassSubscription: userData?.bypass_subscription || false,
          payoutWalletAddress: userData?.payout_wallet_address || null
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

        // Get next payment date directly from userData (already fetched above)
        const nextPayoutDate = userData?.next_payment_due_date
          ? new Date(userData.next_payment_due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : 'Not scheduled'

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
        <div className="text-muted-foreground">{t("finance.loadingFinancialData")}</div>
      </div>
    )
  }

  const handlePayNow = () => {
    router.push('/payments')
  }

  return (
    <div>
      <PageHeader
        title={t("finance.title")}
        description={t("finance.description")}
      />

      {/* Account Status + Payout Wallet side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div>
        <AccountStatusCard
          accountActive={accountStatus.accountActive}
          monthlyPaymentDueDate={accountStatus.monthlyPaymentDueDate}
          lastPaymentDate={accountStatus.lastPaymentDate}
          paymentSchedule={accountStatus.paymentSchedule}
          bypassSubscription={accountStatus.bypassSubscription}
          payoutWalletAddress={accountStatus.payoutWalletAddress}
          onPayNow={handlePayNow}
        />
      </div>

      {/* Payout Wallet Section - side by side with Account Status */}
      <Card>
        <CardContent className="pt-6">
          <PayoutWalletSetup showAsCard isModal={false} />
        </CardContent>
      </Card>
      </div>{/* end Account Status + Payout grid */}

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

      {/* Warning cards side by side */}
      {((!accountStatus.accountActive && !accountStatus.bypassSubscription) || (!accountStatus.payoutWalletAddress && !accountStatus.bypassSubscription)) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Inactive Account Financial Impact Notice */}
      {!accountStatus.accountActive && !accountStatus.bypassSubscription && (
        <Card className="border-red-500/30 bg-red-950/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-500/20 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-400 text-lg">Your Earnings Are On Hold</h3>
                <p className="text-sm text-red-300 mt-1">
                  {!accountStatus.lastPaymentDate ? (
                    "You haven't made any subscription payments yet. Until you activate your account, you cannot earn commissions or receive payouts."
                  ) : (
                    <>
                      Your subscription payment is overdue. Your last payment was on{' '}
                      <strong>{accountStatus.lastPaymentDate.toLocaleDateString()}</strong>
                      {' '}({Math.floor((Date.now() - accountStatus.lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24))} days ago).
                      Subscriptions must be renewed every 30 days to keep earning.
                    </>
                  )}
                </p>
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm font-medium text-red-400">Impact on your finances:</p>
                  <ul className="text-xs text-red-300 mt-1 space-y-1 list-disc list-inside">
                    <li>Your ${financialStats.currentMonthResidual.toLocaleString()} current month residual is <strong>not payable</strong></li>
                    <li>Any pending direct bonuses (${financialStats.pendingBonuses.toLocaleString()}) are <strong>on hold</strong></li>
                    <li>Your team&apos;s activity is not generating commissions for you</li>
                  </ul>
                </div>
                <Button
                  onClick={handlePayNow}
                  className="mt-4 bg-red-600 hover:bg-red-700"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay ${accountStatus.paymentSchedule === 'weekly' ? '49.75' : '199'} to Reactivate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Payout Wallet Warning */}
      {!accountStatus.payoutWalletAddress && !accountStatus.bypassSubscription && (
        <Card className="border-amber-500/30 bg-amber-950/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-500/20 rounded-full">
                <Wallet className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-400 text-lg">Payout Wallet Not Configured</h3>
                <p className="text-sm text-amber-300 mt-1">
                  You need to set up a Polygon wallet address to receive your commission payouts.
                  Without a wallet, we cannot send you any earnings.
                </p>
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm font-medium text-amber-400">Without a payout wallet:</p>
                  <ul className="text-xs text-amber-300 mt-1 space-y-1 list-disc list-inside">
                    <li>Monthly residual commissions cannot be paid out</li>
                    <li>Direct referral bonuses will remain pending</li>
                    <li>All earned commissions are held until wallet is set</li>
                  </ul>
                </div>
                <p className="text-xs text-amber-300 mt-3">
                  Set up your wallet in the Payout Wallet section below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
      )}

      {/* Financial Overview */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={staggerItem}>
          <Card variant="elevated" className="relative overflow-hidden border-l-2 border-l-emerald-500">
            <DollarSign className="absolute top-3 right-3 h-12 w-12 text-emerald-500/5" />
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] uppercase tracking-wide font-semibold text-foreground-tertiary">
                {t("finance.lifetimeEarnings")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <AnimatedNumber value={financialStats.lifetimeEarnings} prefix="$" />
              </div>
              <p className="text-xs text-foreground-tertiary">{t("finance.allTimeTotal")}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card variant="elevated" className="relative overflow-hidden border-l-2 border-l-blue-500">
            <TrendingUp className="absolute top-3 right-3 h-12 w-12 text-blue-500/5" />
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] uppercase tracking-wide font-semibold text-foreground-tertiary">
                {t("finance.currentMonthResidual")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                <AnimatedNumber value={financialStats.currentMonthResidual} prefix="$" />
              </div>
              <p className="text-xs text-foreground-tertiary">{(financialStats.commissionRate * 100).toFixed(0)}% of team volume</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card variant="elevated" className="relative overflow-hidden border-l-2 border-l-purple-500">
            <Users className="absolute top-3 right-3 h-12 w-12 text-purple-500/5" />
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] uppercase tracking-wide font-semibold text-foreground-tertiary">
                {t("finance.directBonuses")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <AnimatedNumber value={financialStats.totalDirectBonuses} prefix="$" />
              </div>
              <p className="text-xs text-foreground-tertiary">
                ${financialStats.pendingBonuses} pending
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card variant="highlighted" className="relative overflow-hidden border-l-2 border-l-gold-400">
            <Wallet className="absolute top-3 right-3 h-12 w-12 text-gold-400/5" />
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] uppercase tracking-wide font-semibold text-gold-400">
                {t("finance.nextPayout")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold-400">
                <AnimatedNumber value={financialStats.nextPayoutAmount} prefix="$" />
              </div>
              <p className="text-xs text-gold-400/80">{financialStats.nextPayoutDate}</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="residual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="residual">{t("finance.residualIncome")}</TabsTrigger>
          <TabsTrigger value="bonuses">{t("finance.directBonuses")}</TabsTrigger>
          <TabsTrigger value="history">{t("finance.earningsHistory")}</TabsTrigger>
          <TabsTrigger value="settings">{t("finance.payoutSettings")}</TabsTrigger>
        </TabsList>

        {/* Residual Income Tab */}
        <TabsContent value="residual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("finance.teamVolumeAndResidual")}</CardTitle>
              <CardDescription>
                Your {(financialStats.commissionRate * 100).toFixed(0)}% commission from total active team monthly subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{t("finance.currentMonthVolume")}</span>
                      <Badge variant="outline">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Badge>
                    </div>
                    <div className="text-3xl font-bold">
                      ${financialStats.currentMonthVolume.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{financialStats.activeMembers} {t("finance.activeMembersLabel")}</span>
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
                  <h4 className="font-medium mb-3">{t("finance.volumeBreakdown")}</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t("finance.activeMembersLabel")}</span>
                      <span className="font-medium">{financialStats.activeMembers} × $19.9 = ${financialStats.currentMonthVolume.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t("finance.yourCommissionRate")}</span>
                      <span className="font-medium">{(financialStats.commissionRate * 100).toFixed(0)}%</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{t("finance.monthlyResidualIncome")}</span>
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
              <CardTitle>{t("finance.directReferralBonuses")}</CardTitle>
              <CardDescription>
                Earn $249.50 (50% of $499) for each person you directly refer. Bonuses are paid monthly around the 15th alongside residual commissions.
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
                    <p>{t("finance.noDirectBonuses")}</p>
                    <p className="text-sm mt-2">{t("finance.shareToEarnBonuses")}</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">{t("finance.totalBonuses")}</div>
                        <div className="text-2xl font-bold">${financialStats.totalDirectBonuses}</div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">{t("finance.paid")}</div>
                        <div className="text-2xl font-bold text-primary">${financialStats.paidBonuses}</div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">{t("payments.pending")}</div>
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
                              </div>
                            </div>

                            <div className="flex items-center mt-3 pt-3 border-t">
                              {bonus.status === "paid" ? (
                                <div>
                                  <Badge className="bg-[#D4A853] text-white">
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
              <CardTitle>{t("finance.monthlyEarningsHistory")}</CardTitle>
              <CardDescription>
                {t("finance.trackIncomeOverTime")}
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
                  {t("finance.downloadHistory")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payout Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("finance.payoutSettings")}</CardTitle>
              <CardDescription>
                {t("finance.configureEarnings")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">{t("finance.paymentMethod")}</h4>
                  <div className="space-y-3">
                    <div className="p-3 border border-border rounded-lg bg-surface-2">
                      <div className="flex items-center gap-3 mb-2">
                        <Wallet className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">Crypto Wallet (Polygon)</div>
                          <div className="text-sm text-muted-foreground">
                            {accountStatus.payoutWalletAddress
                              ? `Wallet: ${accountStatus.payoutWalletAddress.slice(0, 6)}...${accountStatus.payoutWalletAddress.slice(-4)}`
                              : 'Set up your Polygon wallet to receive payouts'}
                          </div>
                        </div>
                        {accountStatus.payoutWalletAddress && (
                          <Badge className="bg-[#D4A853] text-white">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!accountStatus.payoutWalletAddress && (
                      <p className="text-xs text-muted-foreground text-center">
                        Set up your payout wallet in the Payout Wallet section above
                      </p>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">{t("finance.payoutSchedule")}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("finance.frequency")}</span>
                      <span className="font-medium">{t("finance.monthly")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("finance.nextPayoutDate")}</span>
                      <span className="font-medium">{financialStats.nextPayoutDate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("finance.minimumPayout")}</span>
                      <span className="font-medium">$100</span>
                    </div>
                  </div>
                </div>

                <div className="border border-border rounded-lg p-4 bg-surface-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium mb-2">{t("finance.transactionFees")}</h4>
                      <p className="text-sm text-muted-foreground">
                        Payouts are sent via the Polygon network. Network gas fees are minimal
                        (typically under $0.01) and are covered by the platform. You receive the
                        full payout amount in your connected wallet.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">{t("finance.taxInformation")}</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("finance.downloadEarningsStatements")}
                  </p>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    {t("finance.download1099")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  )
}