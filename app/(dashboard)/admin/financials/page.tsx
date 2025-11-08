"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, DollarSign, ArrowDownCircle, ArrowUpCircle, Users, Search } from "lucide-react"
import { formatDollars } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Payment {
  id: string
  user_id: string
  amount: number
  status: string
  payment_type: string
  created_at: string
  user_name: string | null
  user_email: string
}

interface Commission {
  id: string
  referrer_id: string
  referred_id: string
  amount: number
  status: string
  paid_at: string | null
  created_at: string
  referrer_name: string | null
  referrer_email: string
  referred_name: string | null
  referred_email: string
}

interface FinancialStats {
  totalRevenue: number
  totalPayouts: number
  netProfit: number
  activeSubscriptions: number
}

interface PaymentData {
  id: string
  user_id: string
  amount: number
  status: string
  payment_type: string
  created_at: string
  users: {
    name: string | null
    email: string
  } | null
}

interface CommissionData {
  id: string
  referrer_id: string
  referred_id: string
  amount: number
  status: string
  paid_at: string | null
  created_at: string
  referrer: {
    name: string | null
    email: string
  } | null
  referred: {
    name: string | null
    email: string
  } | null
}

export default function AdminFinancialsPage() {
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [stats, setStats] = useState<FinancialStats>({
    totalRevenue: 0,
    totalPayouts: 0,
    netProfit: 0,
    activeSubscriptions: 0
  })
  const [payments, setPayments] = useState<Payment[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [paymentSearch, setPaymentSearch] = useState("")
  const [commissionSearch, setCommissionSearch] = useState("")
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"all" | "initial" | "weekly" | "monthly" | "commission">("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | "succeeded" | "bypassed" | "pending" | "failed">("all")
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<"all" | "pending" | "paid" | "cancelled">("all")

  const fetchFinancialData = useCallback(async () => {
    const supabase = createClient()

    // Fetch payments with user data
    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select(`
        id,
        user_id,
        amount,
        status,
        payment_type,
        created_at,
        users (
          name,
          email
        )
      `)
      .order("created_at", { ascending: false })

    if (!paymentsError && paymentsData) {
      const formattedPayments = paymentsData.map((p) => {
        const user = Array.isArray(p.users) ? p.users[0] : p.users
        return {
          id: p.id,
          user_id: p.user_id,
          amount: p.amount,
          status: p.status,
          payment_type: p.payment_type,
          created_at: p.created_at,
          user_name: user?.name || null,
          user_email: user?.email || ""
        }
      })
      setPayments(formattedPayments)
    }

    // Fetch commissions with user data
    const { data: commissionsData, error: commissionsError } = await supabase
      .from("commissions")
      .select(`
        id,
        referrer_id,
        referred_id,
        amount,
        status,
        paid_at,
        created_at,
        referrer:users!commissions_referrer_id_fkey (
          name,
          email
        ),
        referred:users!commissions_referred_id_fkey (
          name,
          email
        )
      `)
      .order("created_at", { ascending: false })

    if (!commissionsError && commissionsData) {
      const formattedCommissions = commissionsData.map((c) => {
        const referrer = Array.isArray(c.referrer) ? c.referrer[0] : c.referrer
        const referred = Array.isArray(c.referred) ? c.referred[0] : c.referred
        return {
          id: c.id,
          referrer_id: c.referrer_id,
          referred_id: c.referred_id,
          amount: c.amount,
          status: c.status,
          paid_at: c.paid_at,
          created_at: c.created_at,
          referrer_name: referrer?.name || null,
          referrer_email: referrer?.email || "",
          referred_name: referred?.name || null,
          referred_email: referred?.email || ""
        }
      })
      setCommissions(formattedCommissions)
    }

    // Fetch active subscriptions count
    const { data: subscriptionsData } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact" })
      .eq("status", "active")

    // Calculate stats
    const totalRevenue = paymentsData
      ?.filter((p) => p.status === "succeeded")
      .reduce((sum: number, p) => sum + parseFloat(String(p.amount)), 0) || 0

    const totalPayouts = commissionsData
      ?.filter((c) => c.status === "paid")
      .reduce((sum: number, c) => sum + parseFloat(String(c.amount)), 0) || 0

    setStats({
      totalRevenue,
      totalPayouts,
      netProfit: totalRevenue - totalPayouts,
      activeSubscriptions: subscriptionsData?.length || 0
    })
  }, [])

  const checkSuperAdminStatus = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      if (userData?.role === "superadmin") {
        setIsSuperAdmin(true)
        await fetchFinancialData()
      }
    }
    setLoading(false)
  }, [fetchFinancialData])

  useEffect(() => {
    checkSuperAdminStatus()
  }, [checkSuperAdminStatus])

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      paymentSearch === "" ||
      payment.user_name?.toLowerCase().includes(paymentSearch.toLowerCase()) ||
      payment.user_email.toLowerCase().includes(paymentSearch.toLowerCase())

    const matchesType = paymentTypeFilter === "all" || payment.payment_type === paymentTypeFilter
    const matchesStatus = paymentStatusFilter === "all" || payment.status === paymentStatusFilter

    return matchesSearch && matchesType && matchesStatus
  })

  const filteredCommissions = commissions.filter((commission) => {
    const matchesSearch =
      commissionSearch === "" ||
      commission.referrer_name?.toLowerCase().includes(commissionSearch.toLowerCase()) ||
      commission.referrer_email.toLowerCase().includes(commissionSearch.toLowerCase()) ||
      commission.referred_name?.toLowerCase().includes(commissionSearch.toLowerCase()) ||
      commission.referred_email.toLowerCase().includes(commissionSearch.toLowerCase())

    const matchesStatus = commissionStatusFilter === "all" || commission.status === commissionStatusFilter

    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Access Denied</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Financial Overview</h1>
        </div>
        <p className="text-muted-foreground">Complete financial view of Trading Hub network revenue and payouts</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-green-600" />
              <p className="text-2xl font-bold text-green-600">{formatDollars(stats.totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-red-600" />
              <p className="text-2xl font-bold text-red-600">{formatDollars(stats.totalPayouts)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <p className="text-2xl font-bold text-primary">{formatDollars(stats.netProfit)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.activeSubscriptions}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incoming Payments */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
            Incoming Payments ({filteredPayments.length})
          </CardTitle>
          <CardDescription>All payments received from users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={paymentTypeFilter} onValueChange={(value: "all" | "initial" | "weekly" | "monthly" | "commission") => setPaymentTypeFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="initial">Initial Payment</SelectItem>
                <SelectItem value="weekly">Weekly Payment</SelectItem>
                <SelectItem value="monthly">Monthly Payment</SelectItem>
                <SelectItem value="commission">Commission</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentStatusFilter} onValueChange={(value: "all" | "succeeded" | "bypassed" | "pending" | "failed") => setPaymentStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="succeeded">Succeeded</SelectItem>
                <SelectItem value="bypassed">Bypassed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No payments match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.slice(0, 50).map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payment.user_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{payment.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-green-600">
                        {formatDollars(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {payment.payment_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.status === "succeeded" ? (
                          <Badge className="bg-green-500 text-white">Succeeded</Badge>
                        ) : payment.status === "bypassed" ? (
                          <Badge className="bg-amber-500 text-white">Bypassed</Badge>
                        ) : payment.status === "pending" ? (
                          <Badge className="bg-yellow-500 text-white">Pending</Badge>
                        ) : (
                          <Badge className="bg-red-500 text-white">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(payment.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Outgoing Payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-red-600" />
            Outgoing Payouts ({filteredCommissions.length})
          </CardTitle>
          <CardDescription>All commission payouts to users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by referrer or referred..."
                value={commissionSearch}
                onChange={(e) => setCommissionSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={commissionStatusFilter} onValueChange={(value: "all" | "pending" | "paid" | "cancelled") => setCommissionStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Referred</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No commissions match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCommissions.slice(0, 50).map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{commission.referrer_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{commission.referrer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{commission.referred_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{commission.referred_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-red-600">
                        {formatDollars(commission.amount)}
                      </TableCell>
                      <TableCell>
                        {commission.status === "paid" ? (
                          <Badge className="bg-green-500 text-white">Paid</Badge>
                        ) : commission.status === "pending" ? (
                          <Badge className="bg-yellow-500 text-white">Pending</Badge>
                        ) : (
                          <Badge className="bg-gray-500 text-white">Cancelled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {commission.paid_at
                          ? new Date(commission.paid_at).toLocaleString()
                          : new Date(commission.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
