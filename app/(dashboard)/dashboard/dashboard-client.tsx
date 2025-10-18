"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { Users, DollarSign, TrendingUp, UserPlus, Lock, Unlock, CreditCard, AlertTriangle, Medal, Trophy, Star, Award, Target, Crown, GraduationCap, BookOpen, PlayCircle, CheckCircle2, Wallet, ExternalLink, XCircle, Clock } from "lucide-react"
import { NavigationLink } from "@/components/navigation-link"
import { isTestUser } from "@/lib/mock-data"

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
  completedStructures: number
  unlockedStructures: number
  maxMembersPerStructure: number
}

// Structure ranks
const getRankInfo = (unlockedStructures: number, completedStructures: number) => {
  if (completedStructures >= 6) {
    return {
      name: "Lion Master Sniper",
      icon: Crown,
      color: "text-yellow-500",
      bgColor: "bg-gradient-to-br from-yellow-400 to-yellow-600",
      description: "Elite 16% Commission Rate"
    }
  }

  const ranks = [
    { name: "Delta Master", icon: Target, color: "text-gray-500", bgColor: "bg-gradient-to-br from-gray-400 to-gray-600", description: "10% Commission Rate" },
    { name: "Delta Master Sniper", icon: Medal, color: "text-amber-600", bgColor: "bg-gradient-to-br from-amber-400 to-amber-600", description: "11% Commission Rate" },
    { name: "Trend Master", icon: Star, color: "text-blue-500", bgColor: "bg-gradient-to-br from-blue-400 to-blue-600", description: "12% Commission Rate" },
    { name: "Trend Master Sniper", icon: Award, color: "text-purple-500", bgColor: "bg-gradient-to-br from-purple-400 to-purple-600", description: "13% Commission Rate" },
    { name: "Lion Master", icon: Trophy, color: "text-red-500", bgColor: "bg-gradient-to-br from-red-400 to-red-600", description: "14% Commission Rate" },
    { name: "Lion Master Sniper", icon: Crown, color: "text-yellow-500", bgColor: "bg-gradient-to-br from-yellow-400 to-yellow-600", description: "15% Commission Rate" }
  ]

  return ranks[Math.min(unlockedStructures - 1, 5)]
}

export function DashboardClient({ data, session }: {
  data: DashboardData
  session: {
    user: {
      id: string
      email: string
      name?: string
    }
  }
}) {
  const [selectedStructure, setSelectedStructure] = useState("1")
  const [connectStatus, setConnectStatus] = useState<{
    connected: boolean
    onboarded: boolean
    payouts_enabled?: boolean
    charges_enabled?: boolean
    account?: {
      id: string
      email?: string | null
      created: number
    }
  }>({ connected: false, onboarded: false })
  const [connectLoading, setConnectLoading] = useState(true)
  const rankInfo = getRankInfo(data.unlockedStructures, data.completedStructures)
  
  // Check Stripe Connect status
  useEffect(() => {
    async function checkConnectStatus() {
      if (isTestUser(session.user.id)) {
        setConnectStatus({
          connected: true,
          onboarded: true,
          payouts_enabled: true,
          charges_enabled: true
        })
        setConnectLoading(false)
        return
      }
      
      try {
        const response = await fetch('/api/stripe/connect/onboarding')
        if (response.ok) {
          const status = await response.json()
          setConnectStatus(status)
        }
      } catch (error) {
        console.error('Error checking Connect status:', error)
      } finally {
        setConnectLoading(false)
      }
    }
    
    checkConnectStatus()
  }, [session.user.id])
  
  async function handleConnectOnboarding() {
    try {
      const response = await fetch('/api/stripe/connect/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const { url } = await response.json()
        if (url) {
          window.location.href = url
        }
      }
    } catch (error) {
      console.error('Error starting Connect onboarding:', error)
    }
  }
  
  return (
    <div>
      {/* Demo Mode Banner */}
      {isTestUser(session.user.id) && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-lg shadow-lg shadow-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                DEMO MODE
              </Badge>
              <span className="font-medium">
                You&apos;re using a test account with sample data
              </span>
            </div>
            <NavigationLink href="/register">
              <Button size="sm" variant="secondary">
                Create Real Account
              </Button>
            </NavigationLink>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome back, {data.user?.name || session.user.email}</p>
      </div>

      {/* Academy Section - Will be populated with upcoming classes */}
      <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Trading Academy Schedule
              </CardTitle>
              <CardDescription className="mt-1">
                Upcoming live trading sessions and classes
              </CardDescription>
            </div>
            <NavigationLink href="/academy">
              <Button variant="default">
                <BookOpen className="h-4 w-4 mr-2" />
                Go to Academy
              </Button>
            </NavigationLink>
          </div>
        </CardHeader>
        <CardContent>
          {/* TODO: Fetch from academy_classes table - showing placeholder for now */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Next Class - Green highlight */}
            <div className="p-4 rounded-lg bg-green-50 border-2 border-green-500">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-green-500 text-white">Next Class</Badge>
                <PlayCircle className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Options Fundamentals</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Learn the basics of options trading and strategies
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Today at 2:00 PM EST
              </p>
              <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
                <ExternalLink className="h-4 w-4 mr-2" />
                Join Class
              </Button>
            </div>

            {/* Upcoming Class 2 */}
            <div className="p-4 rounded-lg border-2">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline">Upcoming</Badge>
                <PlayCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Technical Analysis</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Master chart patterns and indicators
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Tomorrow at 10:00 AM EST
              </p>
              <Button size="sm" variant="outline" className="w-full" disabled>
                Not Yet Available
              </Button>
            </div>

            {/* Upcoming Class 3 */}
            <div className="p-4 rounded-lg border-2">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline">Upcoming</Badge>
                <PlayCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Advanced Strategies</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Iron condors, butterflies, and spreads
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Dec 25 at 3:00 PM EST
              </p>
              <Button size="sm" variant="outline" className="w-full" disabled>
                Not Yet Available
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connect Bank Account Section */}
      {data.initialPaymentCompleted && (
        <Card className="mb-6 border-green-500/20 bg-gradient-to-r from-green-500/5 to-green-600/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-green-600" />
                  Bank Account for Payouts
                </CardTitle>
                <CardDescription className="mt-1">
                  Connect your bank account to receive monthly commission payouts automatically
                </CardDescription>
              </div>
              {!connectLoading && connectStatus.onboarded && (
                <Badge className="bg-green-500 text-white">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {connectLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 animate-pulse" />
                Checking connection status...
              </div>
            ) : connectStatus.onboarded ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-card">
                    <p className="text-sm text-muted-foreground">Payouts Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {connectStatus.payouts_enabled ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Enabled</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium">Pending Verification</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-card">
                    <p className="text-sm text-muted-foreground">Next Payout</p>
                    <p className="text-sm font-medium mt-1">1st of next month</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card">
                    <p className="text-sm text-muted-foreground">Estimated Commission</p>
                    <p className="text-sm font-medium mt-1 text-primary">{formatCurrency(data.monthlyCommission)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm">
                    Your bank account is connected. Commissions will be paid out automatically on the 1st of each month.
                  </p>
                </div>
                <Button variant="outline" onClick={handleConnectOnboarding}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Update Bank Details
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Bank account not connected</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Connect your bank account to receive automatic monthly commission payouts. This only takes 2 minutes.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">What happens next:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                      Quick setup with Stripe (2 minutes)
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                      Automatic monthly payouts on the 1st
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                      Direct deposit to your bank account
                    </li>
                  </ul>
                </div>
                <Button onClick={handleConnectOnboarding} className="w-full md:w-auto">
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect Bank Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Membership Status Alert */}
      {!data.initialPaymentCompleted && !isTestUser(session.user.id) && (
        <Card className="mb-6 border-destructive/20 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              <CardTitle className="text-foreground">Unlock Your Membership</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Pay the one-time $500 membership fee to unlock your 3 referral slots and start building your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NavigationLink href="/payments">
              <Button variant="destructive">
                <Unlock className="h-4 w-4 mr-2" />
                Unlock Membership ($500)
              </Button>
            </NavigationLink>
          </CardContent>
        </Card>
      )}

      {/* Subscription Alert */}
      {data.initialPaymentCompleted && !data.subscription && !isTestUser(session.user.id) && (
        <Card className="mb-6 border-yellow-500/20 bg-yellow-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-foreground">Activate Monthly Subscription</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Subscribe for $200/month to earn commissions from your team pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NavigationLink href="/payments">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                <CreditCard className="h-4 w-4 mr-2" />
                Start Monthly Subscription ($200/mo)
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
              <CardTitle>Structure Overview</CardTitle>
              <CardDescription>
                Complete structures and add direct referrals to unlock higher commission rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Current Rank</p>
                    <div className="flex items-center gap-2">
                      <rankInfo.icon className={`h-5 w-5 ${rankInfo.color}`} />
                      <p className="text-lg font-bold">{rankInfo.name}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Active Structures</p>
                    <p className="text-2xl font-bold">{data.unlockedStructures}/6</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Commission Rate</p>
                    <p className="text-2xl font-bold">
                      {data.completedStructures >= 6 ? '16' : (data.commissionRate * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${data.directReferrals >= 3 ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'}`}>
                    <p className="text-sm text-muted-foreground">Active Direct Referrals</p>
                    <p className={`text-2xl font-bold ${data.directReferrals >= 3 ? 'text-green-600' : 'text-red-600'}`}>{data.directReferrals}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Total Team</p>
                    <p className="text-2xl font-bold">{data.totalTeamSize}/{data.unlockedStructures * 1092}</p>
                  </div>
                </div>
                
                {/* Structure Selector */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium mb-3">Select Structure to View</p>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                    <RadioGroup 
                      value={selectedStructure} 
                      onValueChange={setSelectedStructure}
                      className="contents"
                    >
                      {Array.from({ length: 6 }, (_, i) => i + 1).map((structureNum) => {
                      const isUnlocked = structureNum <= data.unlockedStructures
                      const structureStart = (structureNum - 1) * 1092
                      const membersInStructure = Math.max(0, Math.min(data.totalTeamSize - structureStart, 1092))
                      const isComplete = structureNum <= data.completedStructures
                      
                      // Get rank info for this specific structure
                      const structureRank = getRankInfo(structureNum, isComplete ? structureNum : 0)
                      
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
                                : 'opacity-40 cursor-not-allowed bg-muted/20'
                            }`}
                          >
                            <div className="flex flex-col items-center space-y-2">
                              <div className={`w-12 h-12 rounded-full ${isUnlocked ? structureRank.bgColor : 'bg-gray-400'} flex items-center justify-center shadow-md ${!isUnlocked ? 'opacity-50' : ''}`}>
                                <structureRank.icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="text-center">
                                <div className="font-bold text-sm">Structure {structureNum}</div>
                                <div className="text-xs text-muted-foreground">
                                  {10 + (structureNum - 1)}% Commission
                                </div>
                                <div className="text-xs font-medium mt-1">
                                  {structureRank.name}
                                </div>
                                {isComplete && (
                                  <Badge className="mt-1 text-xs bg-green-500 text-white">Complete</Badge>
                                )}
                                {isUnlocked && !isComplete && (
                                  <div className="text-xs mt-1 text-muted-foreground">
                                    {membersInStructure}/1092
                                  </div>
                                )}
                                {!isUnlocked && (
                                  <Badge variant="outline" className="mt-1 text-xs">Locked</Badge>
                                )}
                              </div>
                            </div>
                          </Label>
                        </div>
                      )
                    })}
                    </RadioGroup>
                    
                    {/* Ultimate Sniper Rank Box */}
                    <div className="relative">
                      <div className={`block p-4 rounded-lg border-2 transition-all ${
                        data.completedStructures >= 6 
                          ? 'border-yellow-500 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 shadow-lg shadow-yellow-500/20' 
                          : 'border-border opacity-40 bg-muted/20'
                      }`}>
                        <div className="flex flex-col items-center space-y-2">
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-md ${data.completedStructures < 6 ? 'opacity-50' : ''}`}>
                            <Image 
                              src="/gold-logo.svg" 
                              alt="Sniper" 
                              width={32}
                              height={32}
                              className="brightness-0 invert"
                            />
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-sm">Ultimate</div>
                            <div className="text-xs text-muted-foreground">
                              16% Commission
                            </div>
                            <div className="text-xs font-medium mt-1 text-yellow-500">
                              Sniper Elite
                            </div>
                            {data.completedStructures >= 6 ? (
                              <Badge className="mt-1 text-xs bg-yellow-500 text-white">ACHIEVED</Badge>
                            ) : (
                              <Badge variant="outline" className="mt-1 text-xs">Complete All</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected Structure Details */}
                <div className="p-4 bg-card rounded-lg border">
                  {(() => {
                    const structureNum = parseInt(selectedStructure)
                    const isUnlocked = structureNum <= data.unlockedStructures
                    const requiredDirectReferrals = structureNum === 1 ? 3 : structureNum * 3
                    const structureStart = (structureNum - 1) * 1092
                    const membersInStructure = Math.max(0, Math.min(data.totalTeamSize - structureStart, 1092))
                    const progress = isUnlocked ? (membersInStructure / 1092) * 100 : 0
                    
                    return (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">Structure {structureNum}</h3>
                            <p className="text-sm text-muted-foreground">
                              Commission Rate: {10 + (structureNum - 1)}% • Requires {requiredDirectReferrals} direct referrals
                            </p>
                          </div>
                          {isUnlocked ? (
                            <Badge className="bg-green-500 text-white">Active</Badge>
                          ) : data.directReferrals >= requiredDirectReferrals && structureNum === data.unlockedStructures + 1 ? (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-500">Ready to Unlock</Badge>
                          ) : (
                            <Badge variant="outline">Locked</Badge>
                          )}
                        </div>
                        {isUnlocked && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Members</span>
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
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(data.monthlyCommission)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.completedStructures >= 6 ? '16' : (data.commissionRate * 100).toFixed(0)}% of team pool
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Direct Referrals</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.directReferrals >= 3 ? 'text-green-600' : 'text-red-600'}`}>
              {data.directReferrals}/{data.unlockedStructures * 3}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {data.unlockedStructures} structures
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

    </div>
  )
}