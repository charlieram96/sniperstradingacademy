"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TrendingUp, DollarSign, ArrowDownCircle, ArrowUpCircle, Users, Search, Wallet, Settings, CheckCircle2, AlertCircle, Loader2, AlertTriangle, RefreshCw, Calendar, Play, Eye, ArrowRightLeft } from "lucide-react"
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

interface TreasurySettings {
  treasuryWalletAddress: string
  masterWalletXpub: string
  masterWalletXpubFull: string
  currentDerivationIndex: number
  isConfigured: boolean
  // Sweep settings
  hasMasterXprv: boolean
  // Payout wallet settings
  payoutWalletAddress: string
  isPayoutWalletConfigured: boolean
  hasPayoutPrivateKey: boolean
}

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

interface ReviewQueueItem {
  id: string
  depositAddress: string
  userId: string
  userName: string
  userEmail: string
  expectedAmount: number
  receivedAmount: number
  overpaymentAmount: number
  isOverpaid: boolean
  isLate: boolean
  createdAt: string
}

interface MonthlyProcessingPreview {
  monthPeriod: string
  lastProcessedMonth: string
  usersWithVolume: number
  totalVolumeToArchive: number
  commissionsToCreate: {
    count: number
    totalAmount: number
    breakdown: Array<{
      userId: string
      userName: string
      userEmail: string
      volume: number
      commissionRate: number
      commissionAmount: number
      isQualified: boolean
      directReferrals: number
      hasWallet: boolean
    }>
    hasMore: boolean
  }
  ineligibleUsers: {
    count: number
    samples: Array<{
      userId: string
      userName: string
      reason: string
      volume: number
      isQualified: boolean
    }>
  }
  warnings: string[]
}

interface MonthlyProcessingStatus {
  currentPeriodStats: {
    usersWithVolume: number
    activeUsersWithVolume: number
    totalCurrentMonthVolume: string
    pendingResidualCommissions: number
  }
  lastExecution: {
    execution_date: string
    success: boolean
    details?: {
      month_period?: string
    }
  } | null
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

  // Treasury settings state
  const [treasurySettings, setTreasurySettings] = useState<TreasurySettings | null>(null)
  const [treasuryLoading, setTreasuryLoading] = useState(false)
  const [treasurySaving, setTreasurySaving] = useState(false)
  const [treasuryError, setTreasuryError] = useState<string | null>(null)
  const [treasurySuccess, setTreasurySuccess] = useState(false)
  const [editTreasuryAddress, setEditTreasuryAddress] = useState("")
  const [editMasterXpub, setEditMasterXpub] = useState("")
  const [editMasterXprv, setEditMasterXprv] = useState("")
  const [showXpubInput, setShowXpubInput] = useState(false)

  // Treasury wallet balance state
  const [treasuryWalletBalance, setTreasuryWalletBalance] = useState<{ usdc: string; matic: string } | null>(null)
  const [treasuryBalanceLoading, setTreasuryBalanceLoading] = useState(false)

  // Payout wallet state
  const [editPayoutAddress, setEditPayoutAddress] = useState("")
  const [editPayoutPrivateKey, setEditPayoutPrivateKey] = useState("")
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [payoutError, setPayoutError] = useState<string | null>(null)
  const [payoutSuccess, setPayoutSuccess] = useState(false)
  const [payoutWalletBalance, setPayoutWalletBalance] = useState<{ usdc: string; matic: string } | null>(null)
  const [payoutBalanceLoading, setPayoutBalanceLoading] = useState(false)

  // Review queue state
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([])
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // Sweep state
  const [sweepStatus, setSweepStatus] = useState<{
    configured: boolean
    pendingCount: number
    pendingUsdc: number
    lastSweep: { date: string; sweptCount: number; totalUsdc: number } | null
  } | null>(null)
  const [sweepLoading, setSweepLoading] = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [sweepResult, setSweepResult] = useState<{
    success: boolean
    message: string
    details?: { successful: number; failed: number; totalSweptUsdc: number }
  } | null>(null)

  // Monthly processing state
  const [monthlyStatus, setMonthlyStatus] = useState<MonthlyProcessingStatus | null>(null)
  const [monthlyPreview, setMonthlyPreview] = useState<MonthlyProcessingPreview | null>(null)
  const [monthlyStatusLoading, setMonthlyStatusLoading] = useState(false)
  const [monthlyPreviewLoading, setMonthlyPreviewLoading] = useState(false)
  const [monthlyProcessing, setMonthlyProcessing] = useState(false)
  const [monthlyProcessResult, setMonthlyProcessResult] = useState<{
    success: boolean
    message: string
    details?: Record<string, unknown>
  } | null>(null)

  // Users without wallets state
  const [usersWithoutWallets, setUsersWithoutWallets] = useState<Array<{
    id: string
    name: string | null
    email: string
    created_at: string
    is_active: boolean
    direct_referrals_count: number
    sniper_volume_current_month: string | null
  }>>([])

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

  // Fetch treasury settings
  const fetchTreasurySettings = useCallback(async () => {
    setTreasuryLoading(true)
    try {
      const response = await fetch("/api/crypto/treasury/settings")
      const data = await response.json()

      if (data.success && data.data) {
        setTreasurySettings(data.data)
        setEditTreasuryAddress(data.data.treasuryWalletAddress || "")
        setEditMasterXpub(data.data.masterWalletXpubFull || "")
        setEditPayoutAddress(data.data.payoutWalletAddress || "")
        // Don't set private key - it's never returned from API
      }
    } catch (error) {
      console.error("Failed to fetch treasury settings:", error)
    } finally {
      setTreasuryLoading(false)
    }
  }, [])

  // Fetch treasury wallet balance
  const fetchTreasuryWalletBalance = useCallback(async (showLoading = true) => {
    if (!treasurySettings?.treasuryWalletAddress) return

    // Only show loading spinner on initial load, not during polling
    if (showLoading && !treasuryWalletBalance) {
      setTreasuryBalanceLoading(true)
    }
    try {
      const response = await fetch("/api/crypto/admin/treasury-wallet")
      const data = await response.json()

      if (data.success && data.treasuryWallet) {
        setTreasuryWalletBalance({
          usdc: data.treasuryWallet.usdcBalance,
          matic: data.treasuryWallet.maticBalance,
        })
      }
    } catch (error) {
      console.error("Failed to fetch treasury wallet balance:", error)
    } finally {
      setTreasuryBalanceLoading(false)
    }
  }, [treasurySettings?.treasuryWalletAddress, treasuryWalletBalance])

  // Fetch payout wallet balance
  const fetchPayoutWalletBalance = useCallback(async (showLoading = true) => {
    if (!treasurySettings?.payoutWalletAddress) return

    // Only show loading spinner on initial load, not during polling
    if (showLoading && !payoutWalletBalance) {
      setPayoutBalanceLoading(true)
    }
    try {
      const response = await fetch("/api/crypto/admin/payout-wallet")
      const data = await response.json()

      if (data.success && data.payoutWallet) {
        setPayoutWalletBalance({
          usdc: data.payoutWallet.usdcBalance,
          matic: data.payoutWallet.maticBalance,
        })
      }
    } catch (error) {
      console.error("Failed to fetch payout wallet balance:", error)
    } finally {
      setPayoutBalanceLoading(false)
    }
  }, [treasurySettings?.payoutWalletAddress, payoutWalletBalance])

  // Save treasury settings
  const saveTreasurySettings = async () => {
    setTreasurySaving(true)
    setTreasuryError(null)
    setTreasurySuccess(false)

    try {
      const response = await fetch("/api/crypto/treasury/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treasuryWalletAddress: editTreasuryAddress,
          masterWalletXpub: editMasterXpub,
          masterWalletXprv: editMasterXprv || undefined, // Only send if provided
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setTreasuryError(data.error || "Failed to save settings")
      } else {
        setTreasurySuccess(true)
        setEditMasterXprv("") // Clear xprv after save
        await fetchTreasurySettings()
        setShowXpubInput(false)
        setTimeout(() => setTreasurySuccess(false), 3000)
      }
    } catch (error) {
      setTreasuryError("Failed to save treasury settings")
    } finally {
      setTreasurySaving(false)
    }
  }

  // Save payout wallet settings
  const savePayoutWalletSettings = async () => {
    setPayoutSaving(true)
    setPayoutError(null)
    setPayoutSuccess(false)

    try {
      const response = await fetch("/api/crypto/treasury/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutWalletAddress: editPayoutAddress,
          payoutWalletPrivateKey: editPayoutPrivateKey || undefined, // Only send if provided
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setPayoutError(data.error || "Failed to save payout wallet settings")
      } else {
        setPayoutSuccess(true)
        setEditPayoutPrivateKey("") // Clear private key after save
        await fetchTreasurySettings()
        await fetchPayoutWalletBalance()
        setTimeout(() => setPayoutSuccess(false), 3000)
      }
    } catch (error) {
      setPayoutError("Failed to save payout wallet settings")
    } finally {
      setPayoutSaving(false)
    }
  }

  // Fetch review queue
  const fetchReviewQueue = useCallback(async () => {
    setReviewQueueLoading(true)
    try {
      const response = await fetch("/api/crypto/admin/review-queue")
      const data = await response.json()

      if (data.success && data.data) {
        setReviewQueue(data.data)
      }
    } catch (error) {
      console.error("Failed to fetch review queue:", error)
    } finally {
      setReviewQueueLoading(false)
    }
  }, [])

  // Resolve a review queue item
  const resolveReviewItem = async (depositAddressId: string, resolution: "refunded" | "credited" | "ignored") => {
    setResolvingId(depositAddressId)
    try {
      const response = await fetch("/api/crypto/admin/review-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositAddressId,
          resolution,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Remove from local state
        setReviewQueue((prev) => prev.filter((item) => item.id !== depositAddressId))
      }
    } catch (error) {
      console.error("Failed to resolve review item:", error)
    } finally {
      setResolvingId(null)
    }
  }

  // Fetch monthly processing status
  const fetchMonthlyStatus = useCallback(async () => {
    setMonthlyStatusLoading(true)
    try {
      const response = await fetch("/api/admin/process-monthly-volumes")
      const data = await response.json()

      if (data.success) {
        setMonthlyStatus({
          currentPeriodStats: data.currentPeriodStats,
          lastExecution: data.lastExecution,
        })
      }
    } catch (error) {
      console.error("Failed to fetch monthly status:", error)
    } finally {
      setMonthlyStatusLoading(false)
    }
  }, [])

  // Fetch monthly processing preview (dry run)
  const fetchMonthlyPreview = async () => {
    setMonthlyPreviewLoading(true)
    setMonthlyPreview(null)
    setMonthlyProcessResult(null)
    try {
      const requestBody = { dryRun: true }
      console.log('[MonthlyProcessing] PREVIEW - Sending request with body:', JSON.stringify(requestBody))
      const response = await fetch("/api/admin/process-monthly-volumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
      const data = await response.json()

      if (data.success && data.preview) {
        setMonthlyPreview(data.preview)
      }
    } catch (error) {
      console.error("Failed to fetch monthly preview:", error)
    } finally {
      setMonthlyPreviewLoading(false)
    }
  }

  // Execute monthly processing
  const executeMonthlyProcessing = async () => {
    setMonthlyProcessing(true)
    setMonthlyProcessResult(null)
    try {
      const requestBody = { dryRun: false }
      console.log('[MonthlyProcessing] Sending request with body:', JSON.stringify(requestBody))
      const response = await fetch("/api/admin/process-monthly-volumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
      console.log('[MonthlyProcessing] Response status:', response.status)
      const data = await response.json()

      if (data.success) {
        setMonthlyProcessResult({
          success: true,
          message: "Monthly processing completed successfully!",
          details: {
            archiveStep: data.archiveStep,
            commissionStep: data.commissionStep,
            resetStep: data.resetStep,
          },
        })
        setMonthlyPreview(null) // Clear preview after successful processing
        await fetchMonthlyStatus() // Refresh status
      } else {
        setMonthlyProcessResult({
          success: false,
          message: data.error || "Processing failed",
          details: data.details,
        })
      }
    } catch (error) {
      console.error("Failed to execute monthly processing:", error)
      setMonthlyProcessResult({
        success: false,
        message: "Failed to execute monthly processing",
      })
    } finally {
      setMonthlyProcessing(false)
    }
  }

  // Cancel preview
  const cancelPreview = () => {
    setMonthlyPreview(null)
    setMonthlyProcessResult(null)
  }

  // Fetch sweep status
  const fetchSweepStatus = useCallback(async () => {
    setSweepLoading(true)
    try {
      const response = await fetch("/api/cron/sweep-deposits?status=true")
      const data = await response.json()

      if (data.success) {
        setSweepStatus({
          configured: data.configured,
          pendingCount: data.pendingDeposits?.length || 0,
          pendingUsdc: data.pendingDeposits?.reduce((sum: number, d: { usdcBalance: number }) => sum + d.usdcBalance, 0) || 0,
          lastSweep: data.lastSweep,
        })
      }
    } catch (error) {
      console.error("Failed to fetch sweep status:", error)
    } finally {
      setSweepLoading(false)
    }
  }, [])

  // Execute manual sweep
  const executeSweep = async () => {
    setSweeping(true)
    setSweepResult(null)
    try {
      const response = await fetch("/api/cron/sweep-deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoFund: true }),
      })
      const data = await response.json()

      if (data.success) {
        setSweepResult({
          success: true,
          message: `Sweep completed successfully`,
          details: {
            successful: data.results?.successful || 0,
            failed: data.results?.failed || 0,
            totalSweptUsdc: data.results?.totalSweptUsdc || 0,
          },
        })
        await fetchSweepStatus() // Refresh status
      } else {
        setSweepResult({
          success: false,
          message: data.error || "Sweep failed",
        })
      }
    } catch (error) {
      console.error("Failed to execute sweep:", error)
      setSweepResult({
        success: false,
        message: "Failed to execute sweep",
      })
    } finally {
      setSweeping(false)
    }
  }

  // Fetch users without payout wallets
  const fetchUsersWithoutWallets = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('users')
      .select('id, name, email, created_at, is_active, direct_referrals_count, sniper_volume_current_month')
      .is('payout_wallet_address', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (data) {
      setUsersWithoutWallets(data)
    }
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
        await fetchTreasurySettings()
        await fetchReviewQueue()
        await fetchMonthlyStatus()
        await fetchSweepStatus()
        await fetchUsersWithoutWallets()
      }
    }
    setLoading(false)
  }, [fetchFinancialData, fetchTreasurySettings, fetchReviewQueue, fetchMonthlyStatus, fetchSweepStatus, fetchUsersWithoutWallets])

  // Fetch treasury wallet balance when address is available
  useEffect(() => {
    if (treasurySettings?.treasuryWalletAddress) {
      fetchTreasuryWalletBalance()
    }
  }, [treasurySettings?.treasuryWalletAddress, fetchTreasuryWalletBalance])

  // Fetch payout wallet balance when address is available
  useEffect(() => {
    if (treasurySettings?.payoutWalletAddress) {
      fetchPayoutWalletBalance()
    }
  }, [treasurySettings?.payoutWalletAddress, fetchPayoutWalletBalance])

  useEffect(() => {
    checkSuperAdminStatus()
  }, [checkSuperAdminStatus])

  // Poll wallet balances every 3 seconds
  useEffect(() => {
    if (!isSuperAdmin) return;

    const interval = setInterval(() => {
      if (treasurySettings?.treasuryWalletAddress) {
        fetchTreasuryWalletBalance();
      }
      if (treasurySettings?.payoutWalletAddress) {
        fetchPayoutWalletBalance();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isSuperAdmin, treasurySettings?.treasuryWalletAddress, treasurySettings?.payoutWalletAddress, fetchTreasuryWalletBalance, fetchPayoutWalletBalance])

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

      {/* Treasury Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Treasury Wallet Configuration
          </CardTitle>
          <CardDescription>
            Configure the treasury wallet for receiving payments. Users will send USDC to unique deposit addresses derived from this wallet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {treasuryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status indicator */}
              <div className="flex items-center gap-2">
                {treasurySettings?.isConfigured ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-green-600 font-medium">Treasury configured and ready</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-amber-600 font-medium">Treasury not configured - payments disabled</span>
                  </>
                )}
              </div>

              {/* Wallet balance display */}
              {treasurySettings?.treasuryWalletAddress && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">USDC Balance</p>
                    {treasuryBalanceLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mt-1" />
                    ) : (
                      <p className="text-lg font-semibold text-green-600">
                        {treasuryWalletBalance ? `$${parseFloat(treasuryWalletBalance.usdc).toFixed(2)}` : '-'}
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">MATIC (Gas)</p>
                    {treasuryBalanceLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mt-1" />
                    ) : (
                      <p className="text-lg font-semibold">
                        {treasuryWalletBalance ? `${parseFloat(treasuryWalletBalance.matic).toFixed(4)} MATIC` : '-'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Treasury wallet address */}
              <div className="space-y-2">
                <Label htmlFor="treasuryAddress">Treasury Wallet Address</Label>
                <Input
                  id="treasuryAddress"
                  placeholder="0x..."
                  value={editTreasuryAddress}
                  onChange={(e) => setEditTreasuryAddress(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  This is the main wallet address where funds will be collected. All derived deposit addresses funnel here.
                </p>
              </div>

              {/* Master wallet xpub */}
              <div className="space-y-2">
                <Label htmlFor="masterXpub">Master Wallet Extended Public Key (xpub)</Label>
                {treasurySettings?.masterWalletXpub && !showXpubInput ? (
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-3 py-2 rounded text-sm flex-1 font-mono">
                      {treasurySettings.masterWalletXpub}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowXpubInput(true)}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <Input
                    id="masterXpub"
                    placeholder="xpub..."
                    value={editMasterXpub}
                    onChange={(e) => setEditMasterXpub(e.target.value)}
                    className="font-mono text-sm"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Used to derive unique deposit addresses for each payment. Get this from your HD wallet.
                </p>
              </div>

              {/* Master wallet xprv (for sweeping) */}
              <div className="space-y-2">
                <Label htmlFor="masterXprv">Master Wallet Extended Private Key (xprv)</Label>
                <div className="flex items-center gap-2">
                  {treasurySettings?.hasMasterXprv && (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                  )}
                </div>
                <Input
                  id="masterXprv"
                  type="password"
                  placeholder={treasurySettings?.hasMasterXprv ? "••••••••••••••••••••••••••••" : "xprv..."}
                  value={editMasterXprv}
                  onChange={(e) => setEditMasterXprv(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {treasurySettings?.hasMasterXprv
                    ? "Private key is set. Enter a new value to update it."
                    : "Required for sweeping funds from deposit addresses to treasury. This is the private version of your xpub."}
                </p>
                {!treasurySettings?.hasMasterXprv && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-700">
                      <p className="font-medium">Sweep Disabled</p>
                      <p>Without the xprv, funds cannot be swept from deposit addresses to treasury.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Current derivation index */}
              {treasurySettings && (
                <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Current Derivation Index</p>
                    <p className="text-xs text-muted-foreground">
                      {treasurySettings.currentDerivationIndex} addresses generated
                    </p>
                  </div>
                </div>
              )}

              {/* Error/Success messages */}
              {treasuryError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600">{treasuryError}</span>
                </div>
              )}

              {treasurySuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Treasury settings saved successfully</span>
                </div>
              )}

              {/* Save button */}
              <Button
                onClick={saveTreasurySettings}
                disabled={treasurySaving}
              >
                {treasurySaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Treasury Settings"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout Wallet Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-red-600" />
            Payout Wallet Configuration
          </CardTitle>
          <CardDescription>
            Configure the hot wallet used to send commission payouts to users. This wallet should hold USDC and MATIC for gas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {treasuryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status indicator */}
              <div className="flex items-center gap-2">
                {treasurySettings?.isPayoutWalletConfigured ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-green-600 font-medium">Payout wallet configured and ready</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-amber-600 font-medium">Payout wallet not configured - payouts disabled</span>
                  </>
                )}
              </div>

              {/* Wallet balance display */}
              {treasurySettings?.payoutWalletAddress && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">USDC Balance</p>
                    {payoutBalanceLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mt-1" />
                    ) : (
                      <p className="text-lg font-semibold text-green-600">
                        {payoutWalletBalance ? `$${parseFloat(payoutWalletBalance.usdc).toFixed(2)}` : '-'}
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">MATIC (Gas)</p>
                    {payoutBalanceLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mt-1" />
                    ) : (
                      <p className="text-lg font-semibold">
                        {payoutWalletBalance ? `${parseFloat(payoutWalletBalance.matic).toFixed(4)} MATIC` : '-'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Payout wallet address */}
              <div className="space-y-2">
                <Label htmlFor="payoutAddress">Payout Wallet Address</Label>
                <Input
                  id="payoutAddress"
                  placeholder="0x..."
                  value={editPayoutAddress}
                  onChange={(e) => setEditPayoutAddress(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  The wallet address that will send USDC payouts to users.
                </p>
              </div>

              {/* Private key input */}
              <div className="space-y-2">
                <Label htmlFor="payoutPrivateKey">Private Key</Label>
                <Input
                  id="payoutPrivateKey"
                  type="password"
                  placeholder={treasurySettings?.hasPayoutPrivateKey ? "••••••••••••••••••••••••••••" : "Enter private key (0x...)"}
                  value={editPayoutPrivateKey}
                  onChange={(e) => setEditPayoutPrivateKey(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {treasurySettings?.hasPayoutPrivateKey
                    ? "Private key is set. Enter a new value to update it."
                    : "Required for signing payout transactions. Get this from MetaMask."}
                </p>
              </div>

              {/* Security warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">Security Notice</p>
                  <p>The private key is stored encrypted in the database. Only keep sufficient funds for payouts in this hot wallet.</p>
                </div>
              </div>

              {/* Error/Success messages */}
              {payoutError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600">{payoutError}</span>
                </div>
              )}

              {payoutSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Payout wallet settings saved successfully</span>
                </div>
              )}

              {/* Save button */}
              <Button
                onClick={savePayoutWalletSettings}
                disabled={payoutSaving}
              >
                {payoutSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Payout Wallet Settings"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Treasury Sweep */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              <span>Treasury Sweep</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSweepStatus}
              disabled={sweepLoading}
            >
              <RefreshCw className={`h-4 w-4 ${sweepLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
          <CardDescription>
            Consolidate USDC from user deposit addresses to the treasury wallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sweepLoading && !sweepStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Configuration Status */}
              <div className="flex items-center gap-2">
                {sweepStatus?.configured ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-green-600 font-medium">Sweep configured and ready</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-amber-600 font-medium">Sweep not configured - set master_wallet_xprv in treasury settings</span>
                  </>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Pending Deposits</p>
                  <p className="text-2xl font-semibold">{sweepStatus?.pendingCount || 0}</p>
                  <p className="text-xs text-muted-foreground">addresses to sweep</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Pending USDC</p>
                  <p className="text-2xl font-semibold text-green-600">
                    ${(sweepStatus?.pendingUsdc || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">waiting to sweep</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Last Sweep</p>
                  {sweepStatus?.lastSweep ? (
                    <>
                      <p className="text-lg font-semibold">
                        {new Date(sweepStatus.lastSweep.date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sweepStatus.lastSweep.sweptCount} deposits, ${sweepStatus.lastSweep.totalUsdc.toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg font-semibold">Never</p>
                  )}
                </div>
              </div>

              {/* Sweep Result */}
              {sweepResult && (
                <div className={`p-4 rounded-lg border ${
                  sweepResult.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  <div className="flex items-start gap-3">
                    {sweepResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        sweepResult.success ? "text-green-700" : "text-red-700"
                      }`}>
                        {sweepResult.message}
                      </p>
                      {sweepResult.details && sweepResult.success && (
                        <div className="mt-2 text-sm text-green-600 space-y-1">
                          <p>Successful: {sweepResult.details.successful} deposits</p>
                          <p>Failed: {sweepResult.details.failed} deposits</p>
                          <p>Total swept: ${sweepResult.details.totalSweptUsdc.toFixed(2)} USDC</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSweepResult(null)}
                    className="mt-3"
                  >
                    Close
                  </Button>
                </div>
              )}

              {/* Sweep Button */}
              {!sweepResult && (
                <Button
                  onClick={executeSweep}
                  disabled={sweeping || !sweepStatus?.configured || sweepStatus?.pendingCount === 0}
                  className="w-full"
                >
                  {sweeping ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sweeping...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Sweep {sweepStatus?.pendingCount || 0} Deposits to Treasury
                    </>
                  )}
                </Button>
              )}

              {/* Info Note */}
              <div className="text-xs text-muted-foreground">
                <p>Sweep runs automatically daily at 3 AM UTC. Use this for manual sweeps.</p>
                <p className="mt-1">Deposits with less than $1 USDC are skipped. POL gas is auto-funded from the gas tank.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Volume Processing */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Monthly Volume Processing</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchMonthlyStatus}
              disabled={monthlyStatusLoading}
            >
              <RefreshCw className={`h-4 w-4 ${monthlyStatusLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
          <CardDescription>
            Archive sniper volumes, create commissions, and reset counters for the new month
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyStatusLoading && !monthlyStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Last Processed</p>
                  <p className="text-lg font-semibold">
                    {monthlyStatus?.lastExecution?.details?.month_period || "Never"}
                  </p>
                  {monthlyStatus?.lastExecution && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(monthlyStatus.lastExecution.execution_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Users with Volume</p>
                  <p className="text-lg font-semibold">
                    {monthlyStatus?.currentPeriodStats?.usersWithVolume || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {monthlyStatus?.currentPeriodStats?.activeUsersWithVolume || 0} active
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Current Month Volume</p>
                  <p className="text-lg font-semibold">
                    {formatDollars(parseFloat(monthlyStatus?.currentPeriodStats?.totalCurrentMonthVolume || "0"))}
                  </p>
                </div>
              </div>

              {/* Preview Button */}
              {!monthlyPreview && !monthlyProcessResult && (
                <Button
                  onClick={fetchMonthlyPreview}
                  disabled={monthlyPreviewLoading}
                  className="w-full"
                >
                  {monthlyPreviewLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Preview...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview Monthly Reset
                    </>
                  )}
                </Button>
              )}

              {/* Preview Results */}
              {monthlyPreview && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview for {monthlyPreview.monthPeriod}
                    </h4>
                    <Badge variant="outline">Dry Run</Badge>
                  </div>

                  {/* Warnings */}
                  {monthlyPreview.warnings.length > 0 && (
                    <div className="space-y-2">
                      {monthlyPreview.warnings.map((warning, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                          <span className="text-sm text-amber-700">{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600">Volume to Archive</p>
                      <p className="text-lg font-semibold text-blue-700">
                        {formatDollars(monthlyPreview.totalVolumeToArchive)}
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600">Commissions</p>
                      <p className="text-lg font-semibold text-green-700">
                        {monthlyPreview.commissionsToCreate.count}
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600">Total Payout</p>
                      <p className="text-lg font-semibold text-green-700">
                        {formatDollars(monthlyPreview.commissionsToCreate.totalAmount)}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">Ineligible</p>
                      <p className="text-lg font-semibold text-gray-700">
                        {monthlyPreview.ineligibleUsers.count}
                      </p>
                    </div>
                  </div>

                  {/* Commission Breakdown Table */}
                  {monthlyPreview.commissionsToCreate.breakdown.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted px-4 py-2">
                        <h5 className="text-sm font-medium">Commission Breakdown (Top {Math.min(50, monthlyPreview.commissionsToCreate.count)})</h5>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead className="text-center">Qualified</TableHead>
                              <TableHead className="text-right">Volume</TableHead>
                              <TableHead className="text-right">Rate</TableHead>
                              <TableHead className="text-right">Commission</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthlyPreview.commissionsToCreate.breakdown.map((user) => (
                              <TableRow key={user.userId}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-sm">{user.userName}</p>
                                    <p className="text-xs text-muted-foreground">{user.userEmail}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {user.isQualified ? (
                                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Yes
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="cursor-help" title={`Missing: ${!user.hasWallet ? 'wallet' : ''}${!user.hasWallet && user.directReferrals < 3 ? ', ' : ''}${user.directReferrals < 3 ? `${user.directReferrals}/3 referrals` : ''}`}>
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      No
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatDollars(user.volume)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {user.commissionRate.toFixed(0)}%
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold text-green-600">
                                  {formatDollars(user.commissionAmount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {monthlyPreview.commissionsToCreate.hasMore && (
                        <div className="px-4 py-2 bg-muted text-center text-sm text-muted-foreground">
                          + {monthlyPreview.commissionsToCreate.count - 50} more users
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ineligible Users */}
                  {monthlyPreview.ineligibleUsers.count > 0 && (
                    <div className="text-sm">
                      <p className="text-muted-foreground mb-2">
                        {monthlyPreview.ineligibleUsers.count} users have volume but are ineligible (inactive):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {monthlyPreview.ineligibleUsers.samples.map((user) => (
                          <Badge key={user.userId} variant="secondary" className="text-xs">
                            {user.userName} ({formatDollars(user.volume)})
                          </Badge>
                        ))}
                        {monthlyPreview.ineligibleUsers.count > 10 && (
                          <Badge variant="outline" className="text-xs">
                            +{monthlyPreview.ineligibleUsers.count - 10} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={cancelPreview}
                      className="flex-1"
                      disabled={monthlyProcessing}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={executeMonthlyProcessing}
                      disabled={monthlyProcessing}
                      className="flex-1"
                    >
                      {monthlyProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Confirm & Process
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Process Result */}
              {monthlyProcessResult && (
                <div className={`p-4 rounded-lg border ${
                  monthlyProcessResult.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  <div className="flex items-start gap-3">
                    {monthlyProcessResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        monthlyProcessResult.success ? "text-green-700" : "text-red-700"
                      }`}>
                        {monthlyProcessResult.message}
                      </p>
                      {monthlyProcessResult.details && monthlyProcessResult.success && (
                        <div className="mt-2 text-sm text-green-600 space-y-1">
                          <p>Archived: {(monthlyProcessResult.details.archiveStep as { usersProcessed?: number })?.usersProcessed || 0} users</p>
                          <p>Commissions created: {(monthlyProcessResult.details.commissionStep as { commissionsCreated?: number })?.commissionsCreated || 0}</p>
                          <p>Total payout: {formatDollars((monthlyProcessResult.details.commissionStep as { totalPayoutAmount?: number })?.totalPayoutAmount || 0)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelPreview}
                    className="mt-3"
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overpayments Requiring Review */}
      {reviewQueue.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Overpayments Requiring Review ({reviewQueue.length})</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchReviewQueue}
                disabled={reviewQueueLoading}
              >
                <RefreshCw className={`h-4 w-4 ${reviewQueueLoading ? "animate-spin" : ""}`} />
              </Button>
            </CardTitle>
            <CardDescription>
              These payments received more than expected and need admin decision
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reviewQueueLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Overpayment</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewQueue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.userName}</p>
                            <p className="text-sm text-muted-foreground">{item.userEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatDollars(item.expectedAmount)}
                        </TableCell>
                        <TableCell className="font-mono text-green-600 font-semibold">
                          {formatDollars(item.receivedAmount)}
                        </TableCell>
                        <TableCell className="font-mono text-amber-600 font-semibold">
                          +{formatDollars(item.overpaymentAmount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {item.isOverpaid && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 w-fit">
                                Overpaid
                              </Badge>
                            )}
                            {item.isLate && (
                              <Badge variant="outline" className="text-blue-600 border-blue-300 w-fit">
                                Late
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={resolvingId === item.id}
                              onClick={() => resolveReviewItem(item.id, "refunded")}
                            >
                              {resolvingId === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Refund"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={resolvingId === item.id}
                              onClick={() => resolveReviewItem(item.id, "credited")}
                            >
                              {resolvingId === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Credit User"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-muted-foreground"
                              disabled={resolvingId === item.id}
                              onClick={() => resolveReviewItem(item.id, "ignored")}
                            >
                              {resolvingId === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Ignore"
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Users Without Payout Wallets */}
      {usersWithoutWallets.length > 0 && (
        <Card className="mb-6 border-amber-500/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Users Without Payout Wallets
                </CardTitle>
                <CardDescription>
                  These users cannot receive commission payouts until they configure a wallet address
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                {usersWithoutWallets.length} users
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Referrals</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithoutWallets.slice(0, 50).map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.direct_referrals_count || 0}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatDollars(parseFloat(user.sniper_volume_current_month || "0"))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {usersWithoutWallets.length > 50 && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Showing 50 of {usersWithoutWallets.length} users
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
