"use client"

import { useState, useEffect } from "react"
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
  ArrowUpRight,
  Wallet
} from "lucide-react"
import { AccountStatusCard } from "@/components/account-status-card"
import { QualificationCountdown } from "@/components/qualification-countdown"

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
  const [accountStatus] = useState({
    accountActive: true,
    activatedAt: new Date("2024-01-01"),
    monthlyPaymentDueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
    lastPaymentDate: new Date("2024-01-01"),
    qualificationDeadline: new Date("2024-12-31"),
    qualifiedAt: null as Date | null,
    directReferralsCount: 2,
    accumulatedResidual: 3500
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
    isQualified: false
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

      // const supabase = createClient()

      // Mock data for demonstration - replace with actual API calls
      const mockDirectBonuses: DirectBonus[] = [
        {
          id: "1",
          referredUser: {
            name: "John Smith",
            email: "john@example.com",
            joinedAt: "2024-01-15"
          },
          bonusAmount: 250,
          status: "paid",
          paidAt: "2024-01-20"
        },
        {
          id: "2",
          referredUser: {
            name: "Sarah Johnson",
            email: "sarah@example.com",
            joinedAt: "2024-01-20"
          },
          bonusAmount: 250,
          status: "paid",
          paidAt: "2024-01-25"
        },
        {
          id: "3",
          referredUser: {
            name: "Mike Davis",
            email: "mike@example.com",
            joinedAt: "2024-01-28"
          },
          bonusAmount: 250,
          status: "pending"
        }
      ]

      const mockMonthlyEarnings: MonthlyEarning[] = [
        {
          month: "January 2024",
          sniperVolume: 15000,
          residualIncome: 1500,
          directBonuses: 750,
          totalEarning: 2250
        },
        {
          month: "December 2023",
          sniperVolume: 12000,
          residualIncome: 1200,
          directBonuses: 500,
          totalEarning: 1700
        },
        {
          month: "November 2023",
          sniperVolume: 10000,
          residualIncome: 1000,
          directBonuses: 250,
          totalEarning: 1250
        }
      ]

      setDirectBonuses(mockDirectBonuses)
      setMonthlyEarnings(mockMonthlyEarnings)

      // Calculate stats
      const totalDirectBonuses = mockDirectBonuses.reduce((sum, b) => sum + b.bonusAmount, 0)
      const pendingBonuses = mockDirectBonuses
        .filter(b => b.status === "pending")
        .reduce((sum, b) => sum + b.bonusAmount, 0)
      const paidBonuses = mockDirectBonuses
        .filter(b => b.status === "paid")
        .reduce((sum, b) => sum + b.bonusAmount, 0)

      const totalSniperVolume = mockMonthlyEarnings.reduce((sum, m) => sum + m.sniperVolume, 0)
      const totalResidual = mockMonthlyEarnings.reduce((sum, m) => sum + m.residualIncome, 0)
      const lifetimeEarnings = mockMonthlyEarnings.reduce((sum, m) => sum + m.totalEarning, 0)

      setFinancialStats({
        totalSniperVolume,
        currentMonthVolume: mockMonthlyEarnings[0]?.sniperVolume || 0,
        totalResidualEarned: totalResidual,
        currentMonthResidual: mockMonthlyEarnings[0]?.residualIncome || 0,
        totalDirectBonuses,
        pendingBonuses,
        paidBonuses,
        lifetimeEarnings,
        nextPayoutDate: "February 1, 2024",
        nextPayoutAmount: pendingBonuses + (mockMonthlyEarnings[0]?.residualIncome || 0),
        isQualified: mockDirectBonuses.length >= 3
      })

      setLoading(false)
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

  const handleShareReferralLink = () => {
    // Handle sharing referral link
    console.log("Sharing referral link...")
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
          onPayNow={handlePayNow}
        />
      </div>

      {/* Qualification Countdown */}
      <div className="mb-6">
        <QualificationCountdown
          activatedAt={accountStatus.activatedAt}
          qualificationDeadline={accountStatus.qualificationDeadline}
          qualifiedAt={accountStatus.qualifiedAt}
          directReferralsCount={accountStatus.directReferralsCount}
          accumulatedResidual={accountStatus.accumulatedResidual}
          onShareReferralLink={handleShareReferralLink}
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
            <p className="text-xs text-muted-foreground">10% of team volume</p>
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
              <CardTitle>Sniper Volume & Residual Income</CardTitle>
              <CardDescription>
                Your 10% commission from total team monthly subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Current Month Volume</span>
                      <Badge variant="outline">January 2024</Badge>
                    </div>
                    <div className="text-3xl font-bold">
                      ${financialStats.currentMonthVolume.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                      <span className="text-sm text-primary">+25% from last month</span>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Your Residual (10%)</span>
                      {financialStats.isQualified ? (
                        <Badge className="bg-primary/10 text-primary">Qualified</Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-400">Not Qualified</Badge>
                      )}
                    </div>
                    <div className="text-3xl font-bold text-primary">
                      ${financialStats.isQualified ? financialStats.currentMonthResidual.toLocaleString() : "0"}
                    </div>
                    <div className="text-sm text-primary/80 mt-2">
                      {financialStats.isQualified ? "Earning 10% commission" : "Refer 3 to unlock"}
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Volume Breakdown</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Members</span>
                      <span className="font-medium">75 × $200 = $15,000</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Your Commission Rate</span>
                      <span className="font-medium">10%</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Monthly Residual Income</span>
                        <span className="font-bold text-primary">
                          ${financialStats.currentMonthResidual.toLocaleString()}
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
                Earn $250 for each person you directly refer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {directBonuses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p>No direct referrals yet</p>
                    <p className="text-sm mt-2">Share your referral link to earn $250 per person</p>
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
                      {directBonuses.map(bonus => (
                        <div key={bonus.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{bonus.referredUser.name}</div>
                              <div className="text-sm text-muted-foreground">{bonus.referredUser.email}</div>
                              <div className="text-xs text-muted-foreground/70 mt-1">
                                Joined {new Date(bonus.referredUser.joinedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold">${bonus.bonusAmount}</div>
                              {bonus.status === "paid" ? (
                                <>
                                  <Badge className="bg-primary/10 text-primary">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Paid
                                  </Badge>
                                  {bonus.paidAt && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {new Date(bonus.paidAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <Badge className="bg-amber-500/10 text-amber-400">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
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
                        <span className="text-muted-foreground">Residual (10%)</span>
                        <div className="font-medium">${earning.residualIncome.toLocaleString()}</div>
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
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">Bank Account</div>
                          <div className="text-sm text-muted-foreground">****1234</div>
                        </div>
                      </div>
                      <Badge className="bg-primary/10 text-primary">Active</Badge>
                    </div>
                    <Button variant="outline" className="w-full">
                      Update Payment Method
                    </Button>
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
    </div>
  )
}