"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { Lock, Unlock, CreditCard, AlertTriangle, Medal, Trophy, Star, Award, Target, Crown, GraduationCap, BookOpen, PlayCircle, CheckCircle2, Wallet, ExternalLink, Calendar } from "lucide-react"
import { StatTile } from "@/components/patterns/stat-tile"
import { SkeletonClassRow } from "@/components/patterns/skeleton"
import { EmptyState } from "@/components/patterns/empty-state"
import { NavigationLink } from "@/components/navigation-link"
import { isTestUser } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import { BypassAccessBanner } from "@/components/bypass-access-banner"
import { ConfirmReferralModal } from "@/components/referral/confirm-referral-modal"
import { staggerContainer, staggerItem } from "@/lib/motion"
import { AnimatedNumber } from "@/components/motion/animated-number"
import { PageHeader } from "@/components/page-header"
import { useTranslation } from "@/components/language-provider"

const ROOT_USER_ID = 'b10f0367-0471-4eab-9d15-db68b1ac4556'

interface AcademyClass {
  id: string
  title: string
  description: string | null
  meeting_link: string
  scheduled_at: string
  is_live: boolean
}

interface DashboardData {
  user?: {
    id: string
    name: string
    email: string
  }
  subscription?: {
    id: string
    status: string
  }
  membershipStatus: string
  initialPaymentCompleted: boolean
  totalReferrals: number
  activeReferrals: number
  directReferrals: number
  totalEarnings: number
  pendingEarnings: number
  teamPool: number
  monthlyCommission: number
  commissionRate: number
  teamLevels: Record<string, number>
  totalTeamSize: number
  activeTeamSize: number
  completedStructures: number
  unlockedStructures: number
  maxMembersPerStructure: number
  payoutWalletAddress?: string | null
}

// Structure ranks based on COMPLETED structures
const getRankInfo = (completedStructures: number) => {
  // Unranked - 0 completed structures (working on structure 1)
  if (completedStructures === 0) {
    return {
      name: "Unranked",
      icon: Target,
      color: "text-gray-400",
      bgColor: "bg-gradient-to-br from-gray-500 to-gray-600",
      description: "10% Commission Rate"
    }
  }

  const ranks = [
    { name: "Delta Master", icon: Medal, color: "text-gray-500", bgColor: "bg-gradient-to-br from-gray-400 to-gray-600", description: "11% Commission Rate" }, // 1 completed
    { name: "Delta Master Sniper", icon: Star, color: "text-amber-600", bgColor: "bg-gradient-to-br from-amber-400 to-amber-600", description: "12% Commission Rate" }, // 2 completed
    { name: "Trend Master", icon: Award, color: "text-blue-500", bgColor: "bg-gradient-to-br from-blue-400 to-blue-600", description: "13% Commission Rate" }, // 3 completed
    { name: "Trend Master Sniper", icon: Trophy, color: "text-purple-500", bgColor: "bg-gradient-to-br from-purple-400 to-purple-600", description: "14% Commission Rate" }, // 4 completed
    { name: "Lion Master", icon: Crown, color: "text-red-500", bgColor: "bg-gradient-to-br from-red-400 to-red-600", description: "15% Commission Rate" }, // 5 completed
    { name: "Lion Master Sniper", icon: Crown, color: "text-yellow-500", bgColor: "bg-gradient-to-br from-yellow-400 to-yellow-600", description: "16% Commission Rate" } // 6 completed
  ]

  // Return rank based on completedStructures (index = completedStructures - 1)
  return ranks[Math.min(completedStructures - 1, 5)]
}

export function DashboardClient({
  data,
  session,
  bypassInitialPayment = false,
  bypassSubscription = false,
  bypassDirectReferrals = 0,
  bypassBannerDismissed = false,
  referredBy = null
}: {
  data: DashboardData
  session: {
    user: {
      id: string
      email: string
      name?: string
    }
  }
  bypassInitialPayment?: boolean
  bypassSubscription?: boolean
  bypassDirectReferrals?: number // Changed from boolean to number (0-18)
  bypassBannerDismissed?: boolean
  referredBy?: string | null
}) {
  const { t } = useTranslation()
  const [selectedStructure, setSelectedStructure] = useState("1")
  const [academyClasses, setAcademyClasses] = useState<AcademyClass[]>([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [bannerDismissed, setBannerDismissed] = useState(bypassBannerDismissed)
  const [showReferralModal, setShowReferralModal] = useState(false)
  const rankInfo = getRankInfo(data.completedStructures)

  // Check if we should show the referral confirmation modal
  useEffect(() => {
    // Only show modal if:
    // 1. User's referrer is root
    // 2. User hasn't paid yet (no initial payment)
    // 3. User hasn't seen/dismissed the modal before (localStorage check)
    // 4. Not a test user
    const shouldShowModal =
      referredBy === ROOT_USER_ID &&
      !data.initialPaymentCompleted &&
      !bypassInitialPayment &&
      !isTestUser(session.user.id) &&
      typeof window !== 'undefined' &&
      localStorage.getItem('referral_confirmed') !== 'true'

    if (shouldShowModal) {
      setShowReferralModal(true)
    }
  }, [referredBy, data.initialPaymentCompleted, bypassInitialPayment, session.user.id])

  // Fetch academy classes
  useEffect(() => {
    async function fetchClasses() {
      try {
        const supabase = createClient()
        const { data: classes, error } = await supabase
          .from("academy_classes")
          .select("*")
          .order("is_live", { ascending: false })
          .order("scheduled_at", { ascending: true })
          .limit(6)

        if (!error && classes) {
          setAcademyClasses(classes)
        }
      } catch (error) {
        console.error('Error fetching academy classes:', error)
      } finally {
        setClassesLoading(false)
      }
    }

    fetchClasses()
  }, [])

  async function handleDismissBanner() {
    try {
      const response = await fetch('/api/user/dismiss-bypass-banner', {
        method: 'POST',
      })

      if (response.ok) {
        setBannerDismissed(true)
      }
    } catch (error) {
      console.error('Error dismissing bypass banner:', error)
    }
  }
  
  return (
    <div>
      {/* Confirm Referral Modal */}
      <ConfirmReferralModal
        open={showReferralModal}
        onOpenChange={setShowReferralModal}
        onConfirmed={() => setShowReferralModal(false)}
        userId={session.user.id}
      />

      {/* Demo Mode Banner */}
      {isTestUser(session.user.id) && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-lg shadow-lg shadow-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {t("dashboard.demoMode")}
              </Badge>
              <span className="font-medium">
                {t("dashboard.demoMessage")}
              </span>
            </div>
            <NavigationLink href="/register">
              <Button size="sm" variant="secondary">
                {t("dashboard.createRealAccount")}
              </Button>
            </NavigationLink>
          </div>
        </div>
      )}

      {/* Bypass Access Banner */}
      {!isTestUser(session.user.id) && (
        <BypassAccessBanner
          bypassInitialPayment={bypassInitialPayment}
          bypassSubscription={bypassSubscription}
          bypassDirectReferrals={bypassDirectReferrals}
          dismissed={bannerDismissed}
          onDismiss={handleDismissBanner}
        />
      )}

      {/* Activation Required Banner */}
      {!data.initialPaymentCompleted && !bypassInitialPayment && !isTestUser(session.user.id) && (
        <Card className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              <div>
                <CardTitle className="text-amber-900 dark:text-amber-200">{t("dashboard.activationRequired")}</CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-300 mt-1">
                  {t("dashboard.activationDesc")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-amber-200 dark:border-amber-800">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">{t("dashboard.whatYouUnlock")}</h3>
                <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-gold-400" />
                    {t("dashboard.unlockAcademy")}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-gold-400" />
                    {t("dashboard.unlockReferrals")}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-gold-400" />
                    {t("dashboard.unlockTeam")}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-gold-400" />
                    {t("dashboard.unlockFinance")}
                  </li>
                </ul>
              </div>
              <NavigationLink href="/payments">
                <Button size="lg" className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                  <Unlock className="h-5 w-5 mr-2" />
                  {t("dashboard.activateAccount")}
                </Button>
              </NavigationLink>
            </div>
          </CardContent>
        </Card>
      )}

      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.welcome", { name: data.user?.name || session.user.email })}
      />

      {/* Academy + Payout side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

      {/* Academy Section */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                {t("dashboard.academySchedule")}
              </CardTitle>
              <CardDescription className="mt-1">
                {t("dashboard.academyScheduleDesc")}
              </CardDescription>
            </div>
            <NavigationLink href="/academy">
              <Button variant="default">
                <BookOpen className="h-4 w-4 mr-2" />
                {t("dashboard.goToAcademy")}
              </Button>
            </NavigationLink>
          </div>
        </CardHeader>
        <CardContent>
          {classesLoading ? (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonClassRow key={i} />
              ))}
            </div>
          ) : academyClasses.length === 0 ? (
            <EmptyState
              icon={<PlayCircle />}
              title={t("dashboard.noClasses")}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {academyClasses.map((classItem) => {
                const isLive = classItem.is_live
                const scheduledDate = new Date(classItem.scheduled_at)
                const formattedDate = scheduledDate.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/New_York"
                })
                const dayNum = scheduledDate.toLocaleString("en-US", { day: "numeric", timeZone: "America/New_York" })
                const monthAbbr = scheduledDate.toLocaleString("en-US", { month: "short", timeZone: "America/New_York" })

                return (
                  <div
                    key={classItem.id}
                    className={`flex items-center gap-4 rounded-[10px] border p-4 transition-colors ${
                      isLive
                        ? "border-red/30 bg-gradient-to-r from-red-dim to-transparent"
                        : "border-border bg-surface-1 hover:border-border-strong"
                    }`}
                  >
                    {/* Date column */}
                    <div className="flex shrink-0 flex-col items-center border-r border-border pr-4 text-center">
                      <span className="font-mono text-xl font-semibold leading-none tabular-nums text-foreground">{dayNum}</span>
                      <span className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground-tertiary">{monthAbbr}</span>
                    </div>

                    {/* Body */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-foreground">{classItem.title}</h3>
                      <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-foreground-tertiary">
                        <Calendar className="h-3 w-3" />
                        <span className="truncate">{formattedDate} EST</span>
                      </div>
                      <div className="mt-2">
                        {isLive ? (
                          <Badge variant="live">Live</Badge>
                        ) : (
                          <Badge variant="secondary">{t("dashboard.upcoming")}</Badge>
                        )}
                      </div>
                    </div>

                    {/* CTA */}
                    <a href={classItem.meeting_link} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <Button
                        size="sm"
                        variant={isLive ? "default" : "outline"}
                      >
                        <ExternalLink className="h-4 w-4" />
                        {isLive ? t("dashboard.joinClass") : t("dashboard.viewDetails")}
                      </Button>
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout Wallet Section - side by side with Academy */}
      {data.initialPaymentCompleted && (
        <Card className={data.payoutWalletAddress ? 'border-gold-400/20 bg-gradient-to-r from-gold-400/5 to-gold-500/10' : 'border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-amber-600/10'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className={`h-5 w-5 ${data.payoutWalletAddress ? 'text-gold-400' : 'text-amber-600'}`} />
                  {t("dashboard.payoutWallet")}
                </CardTitle>
                <CardDescription className="mt-1">
                  {data.payoutWalletAddress
                    ? t("dashboard.walletConfigured")
                    : t("dashboard.walletNotConfigured")}
                </CardDescription>
              </div>
              {data.payoutWalletAddress ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("dashboard.configured")}
                </Badge>
              ) : (
                <Badge variant="warning">
                  <AlertTriangle className="h-3 w-3" />
                  {t("dashboard.notSet")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {data.payoutWalletAddress ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-surface-1">
                    <p className="text-sm text-muted-foreground">{t("dashboard.walletAddress")}</p>
                    <p className="text-sm font-medium font-mono mt-1">
                      {data.payoutWalletAddress.slice(0, 6)}...{data.payoutWalletAddress.slice(-4)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-1">
                    <p className="text-sm text-muted-foreground">{t("dashboard.network")}</p>
                    <p className="text-sm font-medium mt-1">Polygon (MATIC)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-1">
                    <p className="text-sm text-muted-foreground">{t("dashboard.estimatedCommission")}</p>
                    <p className="text-sm font-medium mt-1 text-primary">{formatCurrency(data.monthlyCommission)} USDC</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-emerald-dim rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-emerald" />
                  <p className="text-sm">
                    {t("dashboard.walletReady")}
                  </p>
                </div>
                <NavigationLink href="/finance">
                  <Button variant="outline">
                    <Wallet className="h-4 w-4 mr-2" />
                    {t("dashboard.updateWallet")}
                  </Button>
                </NavigationLink>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("dashboard.walletNotConfiguredTitle")}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("dashboard.walletNotConfiguredDesc")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("dashboard.howItWorks")}</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                      {t("dashboard.howStep1")}
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                      {t("dashboard.howStep2")}
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                      {t("dashboard.howStep3")}
                    </li>
                  </ul>
                </div>
                <NavigationLink href="/finance">
                  <Button className="w-full md:w-auto bg-amber-600 hover:bg-amber-700">
                    <Wallet className="h-4 w-4 mr-2" />
                    {t("dashboard.setupPayoutWallet")}
                  </Button>
                </NavigationLink>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      </div>{/* end Academy + Payout grid */}

      {/* Membership Status Alert */}
      {!data.initialPaymentCompleted && !isTestUser(session.user.id) && !bypassInitialPayment && (
        <Card className="mb-6 border-destructive/20 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              <CardTitle className="text-foreground">{t("dashboard.unlockMembership")}</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              {t("dashboard.unlockMembershipDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NavigationLink href="/payments">
              <Button variant="destructive">
                <Unlock className="h-4 w-4 mr-2" />
                {t("dashboard.unlockMembershipButton")}
              </Button>
            </NavigationLink>
          </CardContent>
        </Card>
      )}

      {/* Subscription Alert */}
      {data.initialPaymentCompleted && !data.subscription && !isTestUser(session.user.id) && !bypassSubscription && (
        <Card className="mb-6 border-yellow-500/20 bg-yellow-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-foreground">{t("dashboard.activateSubscription")}</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              {t("dashboard.activateSubscriptionDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NavigationLink href="/payments">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                <CreditCard className="h-4 w-4 mr-2" />
                {t("dashboard.startSubscription")}
              </Button>
            </NavigationLink>
          </CardContent>
        </Card>
      )}

      {/* Structure & Commission Overview */}
      {data.membershipStatus === 'unlocked' && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t("dashboard.structureOverview")}</CardTitle>
              <CardDescription>
                {t("dashboard.structureOverviewDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-3 rounded-lg bg-surface-2">
                    <p className="text-sm text-muted-foreground">{t("dashboard.currentRank")}</p>
                    <div className="flex items-center gap-2">
                      <rankInfo.icon className={`h-5 w-5 ${rankInfo.color}`} />
                      <p className="text-lg font-bold">{rankInfo.name}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-2">
                    <p className="text-sm text-muted-foreground">{t("dashboard.activeStructures")}</p>
                    <p className="text-2xl font-bold">{data.unlockedStructures}/6</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-2">
                    <p className="text-sm text-muted-foreground">{t("dashboard.commissionRate")}</p>
                    <p className="text-2xl font-bold">
                      {10 + data.completedStructures}%
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${data.directReferrals >= 3 ? 'bg-gold-400/20 border-2 border-gold-400' : 'bg-red-500/20 border-2 border-red-500'}`}>
                    <p className="text-sm text-muted-foreground">{t("dashboard.activeDirectReferrals")}</p>
                    <p className={`text-2xl font-bold ${data.directReferrals >= 3 ? 'text-gold-400' : 'text-red-600'}`}>{data.directReferrals}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-2">
                    <p className="text-sm text-muted-foreground">{t("dashboard.totalTeam")}</p>
                    <p className="text-2xl font-bold">{data.activeTeamSize}/{data.unlockedStructures * 1092}</p>
                  </div>
                </div>
                
                {/* Structure Selector */}
                <div className="p-4 bg-surface-2 rounded-lg">
                  <p className="text-sm font-medium mb-3">{t("dashboard.selectStructure")}</p>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                    <RadioGroup 
                      value={selectedStructure} 
                      onValueChange={setSelectedStructure}
                      className="contents"
                    >
                      {Array.from({ length: 6 }, (_, i) => i + 1).map((structureNum) => {
                      const isUnlocked = structureNum <= data.unlockedStructures
                      const structureStart = (structureNum - 1) * 1092
                      const membersInStructure = Math.max(0, Math.min(data.activeTeamSize - structureStart, 1092))
                      const isComplete = structureNum <= data.completedStructures

                      // Get rank info for this specific structure based on completion
                      const structureRank = getRankInfo(isComplete ? structureNum : Math.max(0, structureNum - 1))
                      
                      return (
                        <div key={structureNum} className="relative">
                          <RadioGroupItem 
                            value={structureNum.toString()} 
                            id={`structure-${structureNum}`}
                            disabled={!isUnlocked}
                            className="peer sr-only"
                          />
                          <Label 
                            htmlFor={`structure-${structureNum}`}
                            className={`block cursor-pointer p-4 rounded-lg border-2 transition-all ${
                              selectedStructure === structureNum.toString()
                                ? 'border-primary bg-primary/10 shadow-lg'
                                : 'border-border'
                            } ${
                              isUnlocked
                                ? 'hover:border-primary/50 hover:shadow-md'
                                : 'opacity-40 cursor-not-allowed bg-surface-1'
                            }`}
                          >
                            <div className="flex flex-col items-center space-y-2">
                              <div className={`w-12 h-12 rounded-full ${isUnlocked ? structureRank.bgColor : 'bg-gray-400'} flex items-center justify-center shadow-md ${!isUnlocked ? 'opacity-50' : ''}`}>
                                <structureRank.icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="text-center">
                                <div className="font-bold text-sm">{t("dashboard.structure", { num: structureNum })}</div>
                                <div className="text-xs text-muted-foreground">
                                  {isComplete ? 10 + structureNum : 10 + Math.max(0, structureNum - 1)}% {t("dashboard.commission")}
                                </div>
                                <div className="text-xs font-medium mt-1">
                                  {structureRank.name}
                                </div>
                                {isComplete && (
                                  <Badge variant="gold" className="mt-1">{t("dashboard.complete")}</Badge>
                                )}
                                {isUnlocked && !isComplete && (
                                  <div className="text-xs mt-1 text-muted-foreground">
                                    {membersInStructure}/1092
                                  </div>
                                )}
                                {!isUnlocked && (
                                  <Badge variant="outline" className="mt-1 text-xs">{t("dashboard.locked")}</Badge>
                                )}
                              </div>
                            </div>
                          </Label>
                        </div>
                      )
                    })}
                    </RadioGroup>

                    {/* Lion Master Sniper - Final Rank Box */}
                    <div className="relative">
                      <div className={`block p-4 rounded-lg border-2 transition-all ${
                        data.completedStructures >= 6
                          ? 'border-yellow-500 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 shadow-lg shadow-yellow-500/20'
                          : 'border-border opacity-40 bg-surface-1'
                      }`}>
                        <div className="flex flex-col items-center space-y-2">
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-md ${data.completedStructures < 6 ? 'opacity-50' : ''}`}>
                            <Crown className="h-6 w-6 text-white" />
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-sm">{t("dashboard.ultimate")}</div>
                            <div className="text-xs text-muted-foreground">
                              16% {t("dashboard.commission")}
                            </div>
                            <div className="text-xs font-medium mt-1 text-yellow-500">
                              Lion Master Sniper
                            </div>
                            {data.completedStructures >= 6 ? (
                              <Badge className="mt-1 text-xs bg-yellow-500 text-white">{t("dashboard.achieved")}</Badge>
                            ) : (
                              <Badge variant="outline" className="mt-1 text-xs">{t("dashboard.completeStructures")}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected Structure Details */}
                <div className="p-4 bg-surface-1 rounded-lg border border-border">
                  {(() => {
                    const structureNum = parseInt(selectedStructure)
                    const isUnlocked = structureNum <= data.unlockedStructures
                    const requiredDirectReferrals = structureNum === 1 ? 3 : structureNum * 3
                    const structureStart = (structureNum - 1) * 1092
                    const membersInStructure = Math.max(0, Math.min(data.activeTeamSize - structureStart, 1092))
                    const progress = isUnlocked ? (membersInStructure / 1092) * 100 : 0
                    
                    return (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{t("dashboard.structure", { num: structureNum })}</h3>
                            <p className="text-sm text-muted-foreground">
                              {t("dashboard.commissionRateDesc", { rate: structureNum <= data.completedStructures ? 10 + structureNum : 10 + Math.max(0, structureNum - 1) })} • {t("dashboard.requires", { count: requiredDirectReferrals })}
                            </p>
                          </div>
                          {isUnlocked ? (
                            <Badge variant="success">{t("dashboard.active")}</Badge>
                          ) : data.directReferrals >= requiredDirectReferrals && structureNum === data.unlockedStructures + 1 ? (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-500">{t("dashboard.readyToUnlock")}</Badge>
                          ) : (
                            <Badge variant="outline">{t("dashboard.locked")}</Badge>
                          )}
                        </div>
                        {isUnlocked && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">{t("dashboard.members")}</span>
                              <span>{membersInStructure}/1092</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Stats Grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <motion.div variants={staggerItem}>
          <StatTile
            label={t("dashboard.teamPool")}
            value={<AnimatedNumber value={data.teamPool} prefix="$" decimals={2} />}
            footnote={t("dashboard.monthlyTeamRevenue")}
          />
        </motion.div>

        <motion.div variants={staggerItem}>
          <StatTile
            label={t("dashboard.yourCommission")}
            value={<AnimatedNumber value={data.monthlyCommission} prefix="$" decimals={2} />}
            footnote={t("dashboard.ofTeamPool", { rate: 10 + data.completedStructures })}
            tone="gold"
          />
        </motion.div>

        <motion.div variants={staggerItem}>
          <StatTile
            label={t("dashboard.activeDirectReferrals")}
            value={
              <span className={data.directReferrals >= 3 ? undefined : "text-red-400"}>
                {data.directReferrals}/{data.unlockedStructures * 3}
              </span>
            }
            footnote={t("dashboard.acrossStructures", { count: data.unlockedStructures })}
          />
        </motion.div>

        <motion.div variants={staggerItem}>
          <StatTile
            label={t("dashboard.totalTeam")}
            value={<AnimatedNumber value={data.totalTeamSize} />}
            footnote={t("dashboard.yourEntireNetwork")}
          />
        </motion.div>
      </motion.div>

    </div>
  )
}