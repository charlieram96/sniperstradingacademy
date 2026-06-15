"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { roleRank } from "@/lib/admin/permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TrendingUp, DollarSign, ArrowDownCircle, ArrowUpCircle, Users, Search, Wallet, Settings, CheckCircle2, AlertCircle, Loader2, AlertTriangle, RefreshCw, Calendar, Play, Eye, ArrowRightLeft } from "lucide-react"
import { formatDollars } from "@/lib/utils"
import { useTranslation } from "@/components/language-provider"
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
  const { t } = useTranslation()
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
  const [sweepPipelineStats, setSweepPipelineStats] = useState<{
    idle: number
    needs_funding: number
    funding_sent: number
    ready: number
    sweeping: number
    failed: number
  } | null>(null)

  // Stuck funding transactions (gas-tank mempool queue)
  type StuckTx = {
    nonce: number
    hash: string
    to: string | null
    valuePol: string
    ageSeconds: number | null
    originalMaxFeeGwei: number
    currentGasPriceGwei: number
    needsBump: boolean
    linkedUserId: string | null
    linkedUserEmail: string | null
    linkedUsdcBalance: string | null
  }
  const [stuckTxs, setStuckTxs] = useState<{
    gasTankAddress: string
    gasTankPolBalance: string
    confirmedNonce: number
    pendingNonce: number
    stuckCount: number
    currentGasPriceGwei: number
    stuckTxs: StuckTx[]
  } | null>(null)
  const [stuckTxsLoading, setStuckTxsLoading] = useState(false)
  const [stuckTxAction, setStuckTxAction] = useState<{ nonce: number; status: string } | null>(null)

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

    // Fetch active users count
    const { count: activeUsersCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)

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
      activeSubscriptions: activeUsersCount || 0
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
  const fetchTreasuryWalletBalance = useCallback(async () => {
    if (!treasurySettings?.treasuryWalletAddress) return

    setTreasuryBalanceLoading(true)
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
  }, [treasurySettings?.treasuryWalletAddress])

  // Fetch payout wallet balance
  const fetchPayoutWalletBalance = useCallback(async () => {
    if (!treasurySettings?.payoutWalletAddress) return

    setPayoutBalanceLoading(true)
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
  }, [treasurySettings?.payoutWalletAddress])

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
          message: t("admin.financials.monthlyProcessingSuccess"),
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
          message: data.error || t("admin.financials.processingFailed"),
          details: data.details,
        })
      }
    } catch (error) {
      console.error("Failed to execute monthly processing:", error)
      setMonthlyProcessResult({
        success: false,
        message: t("admin.financials.monthlyProcessingFailed"),
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

      // Fetch pipeline stats from database
      const supabase = createClient()
      const { data: pipelineData } = await supabase
        .from('users')
        .select('sweep_status')
        .not('crypto_deposit_address', 'is', null)

      if (pipelineData) {
        const stats = {
          idle: 0,
          needs_funding: 0,
          funding_sent: 0,
          ready: 0,
          sweeping: 0,
          failed: 0,
        }
        pipelineData.forEach((user) => {
          const status = user.sweep_status || 'idle'
          if (status in stats) {
            stats[status as keyof typeof stats]++
          }
        })
        setSweepPipelineStats(stats)

        // If any user is stuck in funding_sent, the gas-tank wallet probably has
        // pending nonces queued in mempool — pull that diagnostic into view.
        if (stats.funding_sent > 0) {
          fetchStuckTxs()
        } else {
          setStuckTxs(null)
        }
      }
    } catch (error) {
      console.error("Failed to fetch sweep status:", error)
    } finally {
      setSweepLoading(false)
    }
  // fetchStuckTxs is a stable useCallback below; intentionally not in deps to avoid forward-reference loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch stuck funding transactions (gas-tank wallet's pending mempool queue).
  // Returns the fresh data so callers like bumpAllStuckTxs can iterate it directly
  // without waiting for a React state-update tick.
  type StuckTxsResponse = {
    gasTankAddress: string
    gasTankPolBalance: string
    confirmedNonce: number
    pendingNonce: number
    stuckCount: number
    currentGasPriceGwei: number
    stuckTxs: StuckTx[]
  }
  const fetchStuckTxs = useCallback(async (): Promise<StuckTxsResponse | null> => {
    setStuckTxsLoading(true)
    try {
      const response = await fetch("/api/admin/treasury/stuck-txs")
      const data = await response.json()
      if (data.success) {
        setStuckTxs(data)
        return data as StuckTxsResponse
      }
      setStuckTxs(null)
      return null
    } catch (error) {
      console.error("Failed to fetch stuck txs:", error)
      setStuckTxs(null)
      return null
    } finally {
      setStuckTxsLoading(false)
    }
  }, [])

  // Replace or cancel a single stuck nonce
  const replaceStuckTx = async (nonce: number, action: "replace" | "cancel", gasMultiplier = 1.5) => {
    setStuckTxAction({ nonce, status: action === "cancel" ? "Cancelling" : "Replacing" })
    try {
      const response = await fetch("/api/admin/treasury/replace-stuck-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce, action, gasMultiplier }),
      })
      const data = await response.json()
      if (data.success && data.skipped) {
        // Nonce already mined since snapshot was taken — informational, not an error.
        console.info(`replace-stuck-tx skipped nonce ${nonce}: ${data.reason}`)
      } else if (!data.success) {
        console.error("replace-stuck-tx failed:", data.error || data)
      }
      await fetchStuckTxs()
      await fetchSweepStatus()
    } catch (error) {
      console.error("Failed to replace stuck tx:", error)
    } finally {
      setStuckTxAction(null)
    }
  }

  // Bump every stuck nonce at once. Refetches first so we work against the current
  // chain state (the mempool can drain between render and click), and re-checks each
  // nonce against confirmedNonce before sending.
  const bumpAllStuckTxs = async (gasMultiplier = 1.5) => {
    const fresh = await fetchStuckTxs()
    if (!fresh || fresh.stuckTxs.length === 0) return
    for (const tx of fresh.stuckTxs) {
      if (tx.nonce < fresh.confirmedNonce) continue
      const action = tx.linkedUserId ? "replace" : "cancel"
      await replaceStuckTx(tx.nonce, action, gasMultiplier)
    }
  }

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
        message: t("admin.financials.sweepFailed"),
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
        .select("role, permissions")
        .eq("id", user.id)
        .single()

      if (roleRank(userData?.role) >= roleRank('superadmin') || (userData?.permissions ?? []).includes('view_financials')) {
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

  // Fetch treasury wallet balance when address is available (once)
  const treasuryAddress = treasurySettings?.treasuryWalletAddress
  useEffect(() => {
    if (treasuryAddress) {
      fetchTreasuryWalletBalance()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treasuryAddress])

  // Fetch payout wallet balance when address is available (once)
  const payoutAddress = treasurySettings?.payoutWalletAddress
  useEffect(() => {
    if (payoutAddress) {
      fetchPayoutWalletBalance()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payoutAddress])

  useEffect(() => {
    checkSuperAdminStatus()
  }, [checkSuperAdminStatus])

  // Manual refresh function for wallet balances
  const refreshWalletBalances = useCallback(async () => {
    if (treasurySettings?.treasuryWalletAddress) {
      fetchTreasuryWalletBalance();
    }
    if (treasurySettings?.payoutWalletAddress) {
      fetchPayoutWalletBalance();
    }
  }, [treasurySettings?.treasuryWalletAddress, treasurySettings?.payoutWalletAddress, fetchTreasuryWalletBalance, fetchPayoutWalletBalance])

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
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t("admin.accessDenied")}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">{t("admin.financials.title")}</h1>
        </div>
        <p className="text-muted-foreground">{t("admin.financials.description")}</p>
      </div>

      {/* Treasury Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {t("admin.financials.treasuryWalletConfig")}
          </CardTitle>
          <CardDescription>
            {t("admin.financials.treasuryWalletConfigDesc")}
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
                    <CheckCircle2 className="h-5 w-5 text-[#D4A853]" />
                    <span className="text-sm text-[#D4A853] font-medium">{t("admin.financials.treasuryConfiguredReady")}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-amber-600 font-medium">{t("admin.financials.treasuryNotConfigured")}</span>
                  </>
                )}
              </div>

              {/* Wallet balance display */}
              {treasurySettings?.treasuryWalletAddress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{t("admin.financials.walletBalances")}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refreshWalletBalances}
                      disabled={treasuryBalanceLoading || payoutBalanceLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${(treasuryBalanceLoading || payoutBalanceLoading) ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-surface-2 rounded-lg">
                      <p className="text-xs text-muted-foreground">{t("admin.financials.usdcBalance")}</p>
                      {treasuryBalanceLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mt-1" />
                      ) : (
                        <p className="text-lg font-semibold text-[#D4A853]">
                          {treasuryWalletBalance ? `$${parseFloat(treasuryWalletBalance.usdc).toFixed(2)}` : '-'}
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-surface-2 rounded-lg">
                      <p className="text-xs text-muted-foreground">{t("admin.financials.maticGas")}</p>
                      {treasuryBalanceLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mt-1" />
                      ) : (
                        <p className="text-lg font-semibold">
                          {treasuryWalletBalance ? `${parseFloat(treasuryWalletBalance.matic).toFixed(4)} MATIC` : '-'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Treasury wallet address */}
              <div className="space-y-2">
                <Label htmlFor="treasuryAddress">{t("admin.financials.treasuryWalletAddress")}</Label>
                <Input
                  id="treasuryAddress"
                  placeholder="0x..."
                  value={editTreasuryAddress}
                  onChange={(e) => setEditTreasuryAddress(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.financials.treasuryWalletAddressDesc")}
                </p>
              </div>

              {/* Master wallet xpub */}
              <div className="space-y-2">
                <Label htmlFor="masterXpub">{t("admin.financials.masterXpub")}</Label>
                {treasurySettings?.masterWalletXpub && !showXpubInput ? (
                  <div className="flex items-center gap-2">
                    <code className="bg-surface-2 px-3 py-2 rounded text-sm flex-1 font-mono">
                      {treasurySettings.masterWalletXpub}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowXpubInput(true)}
                    >
                      {t("admin.financials.change")}
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
                  {t("admin.financials.masterXpubDesc")}
                </p>
              </div>

              {/* Master wallet xprv (for sweeping) */}
              <div className="space-y-2">
                <Label htmlFor="masterXprv">{t("admin.financials.masterXprv")}</Label>
                <div className="flex items-center gap-2">
                  {treasurySettings?.hasMasterXprv && (
                    <Badge variant="outline" className="text-[#D4A853] border-[#D4A853]/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {t("admin.financials.configured")}
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
                    ? t("admin.financials.xprvSetUpdate")
                    : t("admin.financials.xprvRequired")}
                </p>
                {!treasurySettings?.hasMasterXprv && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-700">
                      <p className="font-medium">{t("admin.financials.sweepDisabled")}</p>
                      <p>{t("admin.financials.sweepDisabledDesc")}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Current derivation index */}
              {treasurySettings && (
                <div className="flex items-center gap-4 p-3 bg-surface-2 rounded-lg">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t("admin.financials.currentDerivationIndex")}</p>
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
                <div className="flex items-center gap-2 p-3 bg-[#D4A853]/10 border border-[#D4A853]/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-[#D4A853]" />
                  <span className="text-sm text-[#D4A853]">{t("admin.financials.treasurySavedSuccess")}</span>
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
                    {t("admin.financials.saving")}
                  </>
                ) : (
                  t("admin.financials.saveTreasurySettings")
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
            {t("admin.financials.payoutWalletConfig")}
          </CardTitle>
          <CardDescription>
            {t("admin.financials.payoutWalletConfigDesc")}
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
                    <CheckCircle2 className="h-5 w-5 text-[#D4A853]" />
                    <span className="text-sm text-[#D4A853] font-medium">{t("admin.financials.payoutWalletConfiguredReady")}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-amber-600 font-medium">{t("admin.financials.payoutWalletNotConfigured")}</span>
                  </>
                )}
              </div>

              {/* Wallet balance display */}
              {treasurySettings?.payoutWalletAddress && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-surface-2 rounded-lg">
                    <p className="text-xs text-muted-foreground">USDC Balance</p>
                    {payoutBalanceLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mt-1" />
                    ) : (
                      <p className="text-lg font-semibold text-[#D4A853]">
                        {payoutWalletBalance ? `$${parseFloat(payoutWalletBalance.usdc).toFixed(2)}` : '-'}
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-surface-2 rounded-lg">
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
                <Label htmlFor="payoutAddress">{t("admin.financials.payoutWalletAddress")}</Label>
                <Input
                  id="payoutAddress"
                  placeholder="0x..."
                  value={editPayoutAddress}
                  onChange={(e) => setEditPayoutAddress(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.financials.payoutWalletAddressDesc")}
                </p>
              </div>

              {/* Private key input */}
              <div className="space-y-2">
                <Label htmlFor="payoutPrivateKey">{t("admin.financials.privateKey")}</Label>
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
                    ? t("admin.financials.privateKeySetUpdate")
                    : t("admin.financials.privateKeyRequired")}
                </p>
              </div>

              {/* Security warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">{t("admin.financials.securityNotice")}</p>
                  <p>{t("admin.financials.securityNoticeDesc")}</p>
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
                <div className="flex items-center gap-2 p-3 bg-[#D4A853]/10 border border-[#D4A853]/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-[#D4A853]" />
                  <span className="text-sm text-[#D4A853]">{t("admin.financials.payoutSavedSuccess")}</span>
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
                    {t("admin.financials.saving")}
                  </>
                ) : (
                  t("admin.financials.savePayoutWalletSettings")
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
              <span>{t("admin.financials.treasurySweep")}</span>
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
            {t("admin.financials.treasurySweepDesc")}
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
                    <CheckCircle2 className="h-5 w-5 text-[#D4A853]" />
                    <span className="text-sm text-[#D4A853] font-medium">{t("admin.financials.sweepConfiguredReady")}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-amber-600 font-medium">{t("admin.financials.sweepNotConfigured")}</span>
                  </>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-surface-2 rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("admin.financials.pendingDeposits")}</p>
                  <p className="text-2xl font-semibold">{sweepStatus?.pendingCount || 0}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.financials.addressesToSweep")}</p>
                </div>
                <div className="p-4 bg-surface-2 rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("admin.financials.pendingUsdc")}</p>
                  <p className="text-2xl font-semibold text-[#D4A853]">
                    ${(sweepStatus?.pendingUsdc || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("admin.financials.waitingToSweep")}</p>
                </div>
                <div className="p-4 bg-surface-2 rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("admin.financials.lastSweep")}</p>
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
                    <p className="text-lg font-semibold">{t("admin.financials.never")}</p>
                  )}
                </div>
              </div>

              {/* Sweep Result */}
              {sweepResult && (
                <div className={`p-4 rounded-lg border ${
                  sweepResult.success
                    ? "bg-[#D4A853]/10 border-[#D4A853]/20"
                    : "bg-red-50 border-red-200"
                }`}>
                  <div className="flex items-start gap-3">
                    {sweepResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-[#D4A853] mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        sweepResult.success ? "text-[#C49B3E]" : "text-red-700"
                      }`}>
                        {sweepResult.message}
                      </p>
                      {sweepResult.details && sweepResult.success && (
                        <div className="mt-2 text-sm text-[#D4A853] space-y-1">
                          <p>{t("admin.financials.successful")}: {sweepResult.details.successful} {t("admin.financials.deposits")}</p>
                          <p>{t("admin.payouts.failed")}: {sweepResult.details.failed} {t("admin.financials.deposits")}</p>
                          <p>{t("admin.financials.totalSwept")}: ${sweepResult.details.totalSweptUsdc.toFixed(2)} USDC</p>
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
                    {t("common.close")}
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
                      {t("admin.financials.sweeping")}
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      {t("admin.financials.sweepDeposits").replace("{count}", String(sweepStatus?.pendingCount || 0))}
                    </>
                  )}
                </Button>
              )}

              {/* Pipeline Status */}
              {sweepPipelineStats && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    {t("admin.financials.pipelineStatus")}
                  </h4>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <p className="text-lg font-semibold">{sweepPipelineStats.idle}</p>
                      <p className="text-xs text-muted-foreground">{t("admin.financials.idle")}</p>
                    </div>
                    <div className="p-2 bg-amber-50 rounded text-center">
                      <p className="text-lg font-semibold text-amber-600">{sweepPipelineStats.needs_funding}</p>
                      <p className="text-xs text-amber-600">{t("admin.financials.needsFunding")}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded text-center">
                      <p className="text-lg font-semibold text-blue-600">{sweepPipelineStats.funding_sent}</p>
                      <p className="text-xs text-blue-600">{t("admin.financials.fundingSent")}</p>
                    </div>
                    <div className="p-2 bg-[#D4A853]/10 rounded text-center">
                      <p className="text-lg font-semibold text-[#D4A853]">{sweepPipelineStats.ready}</p>
                      <p className="text-xs text-[#D4A853]">{t("admin.financials.ready")}</p>
                    </div>
                    <div className="p-2 bg-purple-50 rounded text-center">
                      <p className="text-lg font-semibold text-purple-600">{sweepPipelineStats.sweeping}</p>
                      <p className="text-xs text-purple-600">{t("admin.financials.sweepingStatus")}</p>
                    </div>
                    <div className="p-2 bg-red-50 rounded text-center">
                      <p className="text-lg font-semibold text-red-600">{sweepPipelineStats.failed}</p>
                      <p className="text-xs text-red-600">{t("admin.transactionLogs.failed")}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total addresses with deposits: {Object.values(sweepPipelineStats).reduce((a, b) => a + b, 0)}
                  </p>
                </div>
              )}

              {/* Stuck Funding Transactions - only shown when funding_sent users exist */}
              {sweepPipelineStats && sweepPipelineStats.funding_sent > 0 && (
                <div className="border rounded-lg p-4 space-y-3 border-amber-300 bg-amber-50/40">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      Stuck Funding Transactions
                    </h4>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={fetchStuckTxs} disabled={stuckTxsLoading}>
                        <RefreshCw className={`h-4 w-4 ${stuckTxsLoading ? "animate-spin" : ""}`} />
                      </Button>
                      {stuckTxs && stuckTxs.stuckCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => bumpAllStuckTxs(1.5)}
                          disabled={stuckTxAction !== null}
                        >
                          Bump all (1.5×)
                        </Button>
                      )}
                    </div>
                  </div>

                  {stuckTxsLoading && !stuckTxs && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading gas-tank state…
                    </div>
                  )}

                  {stuckTxs && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 bg-white rounded">
                          <p className="text-muted-foreground">Gas tank</p>
                          <p className="font-mono text-[10px] break-all">{stuckTxs.gasTankAddress}</p>
                        </div>
                        <div className="p-2 bg-white rounded">
                          <p className="text-muted-foreground">POL balance</p>
                          <p className="font-semibold">{parseFloat(stuckTxs.gasTankPolBalance).toFixed(4)} POL</p>
                        </div>
                        <div className="p-2 bg-white rounded">
                          <p className="text-muted-foreground">Nonce (confirmed → pending)</p>
                          <p className="font-semibold">{stuckTxs.confirmedNonce} → {stuckTxs.pendingNonce}</p>
                        </div>
                        <div className="p-2 bg-white rounded">
                          <p className="text-muted-foreground">Current gas price</p>
                          <p className="font-semibold">{stuckTxs.currentGasPriceGwei.toFixed(1)} gwei</p>
                        </div>
                      </div>

                      {stuckTxs.stuckCount === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No pending nonces. Funding transactions are clearing the mempool normally.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Nonce</TableHead>
                                <TableHead className="text-xs">User</TableHead>
                                <TableHead className="text-xs">USDC waiting</TableHead>
                                <TableHead className="text-xs">Age</TableHead>
                                <TableHead className="text-xs">Original gas</TableHead>
                                <TableHead className="text-xs">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {stuckTxs.stuckTxs.map((tx) => {
                                const isActing = stuckTxAction?.nonce === tx.nonce
                                const ageLabel = tx.ageSeconds == null
                                  ? "—"
                                  : tx.ageSeconds < 3600
                                    ? `${Math.round(tx.ageSeconds / 60)}m`
                                    : `${Math.floor(tx.ageSeconds / 3600)}h ${Math.round((tx.ageSeconds % 3600) / 60)}m`
                                return (
                                  <TableRow key={tx.nonce}>
                                    <TableCell className="text-xs font-mono">{tx.nonce}</TableCell>
                                    <TableCell className="text-xs">
                                      {tx.linkedUserEmail || <span className="italic text-muted-foreground">unlinked</span>}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {tx.linkedUsdcBalance ? `$${parseFloat(tx.linkedUsdcBalance).toFixed(2)}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs">{ageLabel}</TableCell>
                                    <TableCell className="text-xs">
                                      {tx.originalMaxFeeGwei > 0 ? (
                                        <span className={tx.needsBump ? "text-amber-700 font-semibold" : ""}>
                                          {tx.originalMaxFeeGwei.toFixed(1)} gwei
                                        </span>
                                      ) : (
                                        "—"
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={isActing || !tx.linkedUserId}
                                          onClick={() => replaceStuckTx(tx.nonce, "replace", 1.5)}
                                        >
                                          {isActing && stuckTxAction?.status === "Replacing" ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            "Replace 1.5×"
                                          )}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          disabled={isActing}
                                          onClick={() => replaceStuckTx(tx.nonce, "cancel", 1.5)}
                                        >
                                          {isActing && stuckTxAction?.status === "Cancelling" ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            "Cancel"
                                          )}
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        <strong>Replace</strong> re-broadcasts the original POL funding at higher gas (recovers the user). <strong>Cancel</strong> sends a 0-value self-transfer to free a nonce without re-funding (use for non-funding txs in the queue).
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Info Note */}
              <div className="text-xs text-muted-foreground">
                <p><strong>Automated Pipeline:</strong> Sweeps run automatically every 5 minutes in 4 stages:</p>
                <p className="mt-1">1. Identify (find addresses with USDC) → 2. Fund (send POL for gas) → 3. Execute (sweep USDC) → 4. Verify (confirm transactions)</p>
                <p className="mt-1">Deposits with less than $1 USDC are skipped. Each stage processes up to 20-50 addresses per run for scalability.</p>
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
              <span>{t("admin.financials.monthlyVolumeProcessing")}</span>
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
            {t("admin.financials.monthlyVolumeProcessingDesc")}
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
                <div className="p-4 bg-surface-2 rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("admin.financials.lastProcessed")}</p>
                  <p className="text-lg font-semibold">
                    {monthlyStatus?.lastExecution?.details?.month_period || t("admin.financials.never")}
                  </p>
                  {monthlyStatus?.lastExecution && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(monthlyStatus.lastExecution.execution_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-surface-2 rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("admin.financials.usersWithVolume")}</p>
                  <p className="text-lg font-semibold">
                    {monthlyStatus?.currentPeriodStats?.usersWithVolume || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {monthlyStatus?.currentPeriodStats?.activeUsersWithVolume || 0} active
                  </p>
                </div>
                <div className="p-4 bg-surface-2 rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("admin.financials.currentMonthVolume")}</p>
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
                      {t("admin.financials.generatingPreview")}
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      {t("admin.financials.previewMonthlyReset")}
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
                      {t("admin.financials.previewFor").replace("{period}", monthlyPreview.monthPeriod)}
                    </h4>
                    <Badge variant="outline">{t("admin.financials.dryRun")}</Badge>
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
                      <p className="text-xs text-blue-600">{t("admin.financials.volumeToArchive")}</p>
                      <p className="text-lg font-semibold text-blue-700">
                        {formatDollars(monthlyPreview.totalVolumeToArchive)}
                      </p>
                    </div>
                    <div className="p-3 bg-[#D4A853]/10 rounded-lg">
                      <p className="text-xs text-[#D4A853]">{t("admin.financials.commissions")}</p>
                      <p className="text-lg font-semibold text-[#C49B3E]">
                        {monthlyPreview.commissionsToCreate.count}
                      </p>
                    </div>
                    <div className="p-3 bg-[#D4A853]/10 rounded-lg">
                      <p className="text-xs text-[#D4A853]">{t("admin.financials.totalPayout")}</p>
                      <p className="text-lg font-semibold text-[#C49B3E]">
                        {formatDollars(monthlyPreview.commissionsToCreate.totalAmount)}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">{t("admin.financials.ineligible")}</p>
                      <p className="text-lg font-semibold text-gray-700">
                        {monthlyPreview.ineligibleUsers.count}
                      </p>
                    </div>
                  </div>

                  {/* Commission Breakdown Table */}
                  {monthlyPreview.commissionsToCreate.breakdown.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-surface-2 px-4 py-2">
                        <h5 className="text-sm font-medium">Commission Breakdown (Top {Math.min(50, monthlyPreview.commissionsToCreate.count)})</h5>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("common.user")}</TableHead>
                              <TableHead className="text-center">{t("admin.financials.qualified")}</TableHead>
                              <TableHead className="text-right">{t("admin.financials.volume")}</TableHead>
                              <TableHead className="text-right">{t("admin.financials.rate")}</TableHead>
                              <TableHead className="text-right">{t("admin.financials.commission")}</TableHead>
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
                                    <Badge variant="default" className="bg-[#D4A853] hover:bg-[#C49B3E]">
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
                                <TableCell className="text-right font-mono font-semibold text-[#D4A853]">
                                  {formatDollars(user.commissionAmount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {monthlyPreview.commissionsToCreate.hasMore && (
                        <div className="px-4 py-2 bg-surface-2 text-center text-sm text-muted-foreground">
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
                      {t("common.cancel")}
                    </Button>
                    <Button
                      onClick={executeMonthlyProcessing}
                      disabled={monthlyProcessing}
                      className="flex-1"
                    >
                      {monthlyProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("admin.financials.processing")}
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          {t("admin.financials.confirmAndProcess")}
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
                    ? "bg-[#D4A853]/10 border-[#D4A853]/20"
                    : "bg-red-50 border-red-200"
                }`}>
                  <div className="flex items-start gap-3">
                    {monthlyProcessResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-[#D4A853] mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        monthlyProcessResult.success ? "text-[#C49B3E]" : "text-red-700"
                      }`}>
                        {monthlyProcessResult.message}
                      </p>
                      {monthlyProcessResult.details && monthlyProcessResult.success && (
                        <div className="mt-2 text-sm text-[#D4A853] space-y-1">
                          <p>{t("admin.financials.archived")}: {(monthlyProcessResult.details.archiveStep as { usersProcessed?: number })?.usersProcessed || 0}</p>
                          <p>{t("admin.financials.commissionsCreated")}: {(monthlyProcessResult.details.commissionStep as { commissionsCreated?: number })?.commissionsCreated || 0}</p>
                          <p>{t("admin.financials.totalPayout")}: {formatDollars((monthlyProcessResult.details.commissionStep as { totalPayoutAmount?: number })?.totalPayoutAmount || 0)}</p>
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
                    {t("common.close")}
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
                <span>{t("admin.financials.overpaymentsRequiringReview").replace("{count}", String(reviewQueue.length))}</span>
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
              {t("admin.financials.overpaymentsDesc")}
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
                      <TableHead>{t("common.user")}</TableHead>
                      <TableHead>{t("admin.financials.expected")}</TableHead>
                      <TableHead>{t("admin.financials.received")}</TableHead>
                      <TableHead>{t("admin.financials.overpayment")}</TableHead>
                      <TableHead>{t("admin.financials.flags")}</TableHead>
                      <TableHead>{t("admin.transactionLogs.date")}</TableHead>
                      <TableHead>{t("admin.directBonuses.actions")}</TableHead>
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
                        <TableCell className="font-mono text-[#D4A853] font-semibold">
                          {formatDollars(item.receivedAmount)}
                        </TableCell>
                        <TableCell className="font-mono text-amber-600 font-semibold">
                          +{formatDollars(item.overpaymentAmount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {item.isOverpaid && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 w-fit">
                                {t("admin.financials.overpaid")}
                              </Badge>
                            )}
                            {item.isLate && (
                              <Badge variant="outline" className="text-blue-600 border-blue-300 w-fit">
                                {t("admin.financials.late")}
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
                                t("admin.financials.refund")
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
                                t("admin.financials.creditUser")
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
                                t("admin.financials.ignore")
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
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.financials.totalRevenue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-[#D4A853]" />
              <p className="text-2xl font-bold text-[#D4A853]">{formatDollars(stats.totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.financials.totalPayouts")}</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.financials.netProfit")}</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.financials.activeSubscriptions")}</CardTitle>
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
                  {t("admin.financials.usersWithoutPayoutWallets")}
                </CardTitle>
                <CardDescription>
                  {t("admin.financials.usersWithoutPayoutWalletsDesc")}
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
                    <TableHead>{t("common.user")}</TableHead>
                    <TableHead>{t("admin.financials.joined")}</TableHead>
                    <TableHead>{t("admin.transactionLogs.status")}</TableHead>
                    <TableHead className="text-center">{t("admin.financials.referrals")}</TableHead>
                    <TableHead className="text-right">{t("admin.financials.volume")}</TableHead>
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
                          <Badge variant="success">Active</Badge>
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
            <ArrowUpCircle className="h-5 w-5 text-[#D4A853]" />
            {t("admin.financials.incomingPayments").replace("{count}", String(filteredPayments.length))}
          </CardTitle>
          <CardDescription>{t("admin.financials.incomingPaymentsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.financials.searchByUser")}
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
                <SelectItem value="all">{t("admin.financials.allTypes")}</SelectItem>
                <SelectItem value="initial">{t("admin.financials.initialPayment")}</SelectItem>
                <SelectItem value="weekly">{t("admin.financials.weeklyPayment")}</SelectItem>
                <SelectItem value="monthly">{t("admin.financials.monthlyPayment")}</SelectItem>
                <SelectItem value="commission">{t("admin.financials.commission")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentStatusFilter} onValueChange={(value: "all" | "succeeded" | "bypassed" | "pending" | "failed") => setPaymentStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.financials.allStatus")}</SelectItem>
                <SelectItem value="succeeded">{t("admin.financials.succeeded")}</SelectItem>
                <SelectItem value="bypassed">{t("admin.financials.bypassed")}</SelectItem>
                <SelectItem value="pending">{t("admin.payouts.pending")}</SelectItem>
                <SelectItem value="failed">{t("admin.payouts.failed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.user")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.amount")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.type")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.status")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t("admin.financials.noPaymentsMatch")}
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
                      <TableCell className="font-mono font-semibold text-[#D4A853]">
                        {formatDollars(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {payment.payment_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.status === "succeeded" ? (
                          <Badge className="bg-[#D4A853] text-white">Succeeded</Badge>
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
            {t("admin.financials.outgoingPayouts").replace("{count}", String(filteredCommissions.length))}
          </CardTitle>
          <CardDescription>{t("admin.financials.outgoingPayoutsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.financials.searchByReferrer")}
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
                <SelectItem value="all">{t("admin.financials.allStatus")}</SelectItem>
                <SelectItem value="pending">{t("admin.payouts.pending")}</SelectItem>
                <SelectItem value="paid">{t("admin.financials.paid")}</SelectItem>
                <SelectItem value="cancelled">{t("admin.financials.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.directBonuses.referrer")}</TableHead>
                  <TableHead>{t("admin.directBonuses.referrer")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.amount")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.status")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t("admin.financials.noCommissionsMatch")}
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
                          <Badge className="bg-[#D4A853] text-white">Paid</Badge>
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
