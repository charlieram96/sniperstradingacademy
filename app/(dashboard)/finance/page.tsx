"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
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
  ArrowDownRight,
  Wallet
} from "lucide-react"

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
  const { data: session } = useSession()
  const [directBonuses, setDirectBonuses] = useState<DirectBonus[]>([])
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarning[]>([])
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
    async function fetchFinancialData() {
      if (!session?.user?.id) return

      const supabase = createClient()

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
  }, [session])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading financial data...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Track your earnings, bonuses, and team volume
        </p>
      </div>

      {/* Qualification Status */}
      {!financialStats.isQualified && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-900">Earnings Not Yet Unlocked</CardTitle>
            </div>
            <CardDescription className="text-yellow-700">
              Refer 3 people to unlock residual income from your team volume
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              <DollarSign className="h-4 w-4 inline mr-2" />
              Lifetime Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${financialStats.lifetimeEarnings.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">All time total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              <TrendingUp className="h-4 w-4 inline mr-2" />
              Current Month Residual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${financialStats.currentMonthResidual.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">10% of team volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              <Users className="h-4 w-4 inline mr-2" />
              Direct Bonuses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${financialStats.totalDirectBonuses.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">
              ${financialStats.pendingBonuses} pending
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-800">
              <Wallet className="h-4 w-4 inline mr-2" />
              Next Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">
              ${financialStats.nextPayoutAmount.toLocaleString()}
            </div>
            <p className="text-xs text-green-600">{financialStats.nextPayoutDate}</p>
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
                      <span className="text-sm text-gray-600">Current Month Volume</span>
                      <Badge variant="outline">January 2024</Badge>
                    </div>
                    <div className="text-3xl font-bold">
                      ${financialStats.currentMonthVolume.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <ArrowUpRight className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">+25% from last month</span>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Your Residual (10%)</span>
                      {financialStats.isQualified ? (
                        <Badge className="bg-green-100 text-green-700">Qualified</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700">Not Qualified</Badge>
                      )}
                    </div>
                    <div className="text-3xl font-bold text-green-700">
                      ${financialStats.isQualified ? financialStats.currentMonthResidual.toLocaleString() : "0"}
                    </div>
                    <div className="text-sm text-green-600 mt-2">
                      {financialStats.isQualified ? "Earning 10% commission" : "Refer 3 to unlock"}
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Volume Breakdown</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Members</span>
                      <span className="font-medium">75 × $200 = $15,000</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Your Commission Rate</span>
                      <span className="font-medium">10%</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Monthly Residual Income</span>
                        <span className="font-bold text-green-600">
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
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No direct referrals yet</p>
                    <p className="text-sm mt-2">Share your referral link to earn $250 per person</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">Total Bonuses</div>
                        <div className="text-2xl font-bold">${financialStats.totalDirectBonuses}</div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">Paid</div>
                        <div className="text-2xl font-bold text-green-600">${financialStats.paidBonuses}</div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">Pending</div>
                        <div className="text-2xl font-bold text-yellow-600">${financialStats.pendingBonuses}</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {directBonuses.map(bonus => (
                        <div key={bonus.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{bonus.referredUser.name}</div>
                              <div className="text-sm text-gray-500">{bonus.referredUser.email}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                Joined {new Date(bonus.referredUser.joinedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold">${bonus.bonusAmount}</div>
                              {bonus.status === "paid" ? (
                                <>
                                  <Badge className="bg-green-100 text-green-700">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Paid
                                  </Badge>
                                  {bonus.paidAt && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {new Date(bonus.paidAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-700">
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
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <span className="font-medium">{earning.month}</span>
                        {index === 0 && (
                          <Badge className="bg-blue-100 text-blue-700">Current</Badge>
                        )}
                      </div>
                      <div className="text-xl font-bold">
                        ${earning.totalEarning.toLocaleString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Sniper Volume</span>
                        <div className="font-medium">${earning.sniperVolume.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Residual (10%)</span>
                        <div className="font-medium">${earning.residualIncome.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Direct Bonuses</span>
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
                        <CreditCard className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="font-medium">Bank Account</div>
                          <div className="text-sm text-gray-500">****1234</div>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
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
                      <span className="text-gray-600">Frequency</span>
                      <span className="font-medium">Monthly</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Next Payout Date</span>
                      <span className="font-medium">{financialStats.nextPayoutDate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Minimum Payout</span>
                      <span className="font-medium">$100</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Tax Information</h4>
                  <p className="text-sm text-gray-600 mb-3">
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