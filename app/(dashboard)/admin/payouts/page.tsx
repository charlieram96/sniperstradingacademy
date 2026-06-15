"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { roleRank } from "@/lib/admin/permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DollarSign, AlertCircle, CheckCircle, XCircle, Loader2, RefreshCw, Wallet, Plus, ExternalLink } from "lucide-react"
import { ManualPayoutDialog } from "@/components/admin/manual-payout-dialog"
import { useTranslation } from "@/components/language-provider"
import { PayoutUser } from "@/components/admin/user-search-combobox"

interface Commission {
  id: string
  referrerId: string
  amount: number
  netAmountUsdc: number | null
  status: string
  commissionType: string
  userName: string
  userEmail: string
  payoutWalletAddress: string | null
  qualified: boolean
  usdcTransactionId: string | null
  payoutBatchId: string | null
  errorMessage: string | null
  processedAt: string | null
  retryCount: number
  createdAt: string
  description?: string | null
  createdByAdminId?: string | null
}

interface Summary {
  total: number
  pending: number
  failed: number
  totalAmount: number
}

interface ProcessResult {
  commissionId: string
  userName: string
  amount: number
  success: boolean
  error?: string
  skipped?: boolean
  txHash?: string
}

export default function AdminPayoutsPage() {
  const { t } = useTranslation()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, pending: 0, failed: 0, totalAmount: 0 })
  const [payoutWalletBalance, setPayoutWalletBalance] = useState<number | null>(null)
  const [filter, setFilter] = useState<string>("all")
  const [processing, setProcessing] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [processResults, setProcessResults] = useState<ProcessResult[]>([])
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [showManualPayoutDialog, setShowManualPayoutDialog] = useState(false)
  const [users, setUsers] = useState<PayoutUser[]>([])

  const fetchCommissions = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/payouts/pending")
      const data = await response.json()

      if (response.ok) {
        setCommissions(data.commissions)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error("Error fetching commissions:", error)
    }
  }, [])

  const fetchPayoutWalletBalance = useCallback(async () => {
    try {
      const response = await fetch("/api/crypto/admin/payout-wallet")
      const data = await response.json()

      if (response.ok && data.success && data.payoutWallet) {
        setPayoutWalletBalance(parseFloat(data.payoutWallet.usdcBalance || "0"))
      }
    } catch (error) {
      console.error("Error fetching payout wallet balance:", error)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, payout_wallet_address")
        .order("name", { ascending: true })

      if (!error && data) {
        setUsers(data as PayoutUser[])
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }, [])

  const fetchData = useCallback(async () => {
    await Promise.all([fetchCommissions(), fetchPayoutWalletBalance(), fetchUsers()])
  }, [fetchCommissions, fetchPayoutWalletBalance, fetchUsers])

  const checkSuperAdminStatus = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("role, permissions")
        .eq("id", user.id)
        .single()

      if (roleRank(userData?.role) >= roleRank('superadmin') || (userData?.permissions ?? []).includes('manage_payouts')) {
        setIsSuperAdmin(true)
        await fetchData()
      }
    }
    setLoading(false)
  }, [fetchData])

  useEffect(() => {
    checkSuperAdminStatus()
  }, [checkSuperAdminStatus])

  const handleProcessSingle = async (commissionId: string) => {
    setProcessingId(commissionId)
    try {
      const response = await fetch("/api/admin/payouts/process-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionId }),
      })

      const data = await response.json()

      if (data.success) {
        alert(t("admin.payouts.successTransfer").replace("{amount}", data.amount).replace("{name}", data.userName))
      } else {
        alert(`Failed: ${data.error || t("common.unknown")}`)
      }

      await fetchData()
    } catch (error) {
      alert(t("admin.payouts.errorProcessingPayout"))
      console.error(error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleMarkCompleted = async (commissionId: string) => {
    if (!confirm(t("admin.payouts.markCompletedConfirm"))) {
      return
    }

    setProcessingId(commissionId)
    try {
      const response = await fetch("/api/admin/payouts/mark-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionId }),
      })

      const data = await response.json()

      if (data.success) {
        alert(t("admin.payouts.successMarkCompleted"))
      } else {
        alert(`Failed: ${data.error || t("common.unknown")}`)
      }

      await fetchData()
    } catch (error) {
      alert(t("admin.payouts.errorMarkingCompleted"))
      console.error(error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleProcessBulk = async () => {
    setShowConfirmModal(false)
    setProcessing(true)

    try {
      const response = await fetch("/api/admin/payouts/process-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      const data = await response.json()

      if (response.ok) {
        setProcessResults(data.results)
        setShowResultsModal(true)
        await fetchData()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert(t("admin.payouts.errorBulkPayouts"))
      console.error(error)
    } finally {
      setProcessing(false)
    }
  }

  const filteredCommissions = commissions.filter(c => {
    if (filter === "all") return true
    if (filter === "pending") return c.status === "pending"
    if (filter === "failed") return c.status === "failed"
    return true
  })

  const balanceWarning = payoutWalletBalance !== null && payoutWalletBalance < summary.totalAmount

  // Truncate wallet address for display
  const truncateAddress = (address: string | null) => {
    if (!address) return t("admin.payouts.notSet")
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">{t("admin.accessDenied")}</h2>
          <p className="text-muted-foreground">{t("admin.superadminOnly")}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">{t("admin.payouts.title")}</h1>
        </div>
        <p className="text-muted-foreground">{t("admin.payouts.description")}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.payouts.totalAmount")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.totalAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{t("admin.payouts.usdcToPayOut")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.payouts.pending")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{summary.pending}</div>
            <p className="text-xs text-muted-foreground">{t("admin.payouts.notProcessed")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.payouts.failed")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{summary.failed}</div>
            <p className="text-xs text-muted-foreground">{t("admin.payouts.needsRetry")}</p>
          </CardContent>
        </Card>

        <Card className={balanceWarning ? "border-red-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {t("admin.payouts.payoutWalletBalance")}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balanceWarning ? 'text-red-500' : 'text-primary'}`}>
              ${payoutWalletBalance?.toFixed(2) || "0.00"}
            </div>
            {balanceWarning && (
              <p className="text-xs text-red-500 mt-1">{t("admin.payouts.insufficientBalance")}</p>
            )}
            <p className="text-xs text-muted-foreground">{t("admin.payouts.usdcOnPolygon")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("admin.payouts.filter")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.payouts.allCount").replace("{count}", String(commissions.length))}</SelectItem>
                  <SelectItem value="pending">{t("admin.payouts.pendingCount").replace("{count}", String(summary.pending))}</SelectItem>
                  <SelectItem value="failed">{t("admin.payouts.failedCount").replace("{count}", String(summary.failed))}</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={processing}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("admin.payouts.refresh")}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowManualPayoutDialog(true)}
                disabled={processing}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("admin.payouts.createManualPayout")}
              </Button>

              <Button
                onClick={() => setShowConfirmModal(true)}
                disabled={processing || summary.pending === 0 || balanceWarning}
                className="bg-primary hover:bg-primary/90"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("admin.payouts.processing")}
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    {t("admin.payouts.processAllPending").replace("{count}", String(summary.pending))}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.payouts.commissionDetails")}</CardTitle>
          <CardDescription>{t("admin.payouts.commissionDetailsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.payouts.user")}</TableHead>
                  <TableHead>{t("admin.payouts.type")}</TableHead>
                  <TableHead>{t("admin.payouts.amount")}</TableHead>
                  <TableHead>{t("admin.payouts.wallet")}</TableHead>
                  <TableHead>{t("admin.payouts.status")}</TableHead>
                  <TableHead>{t("admin.payouts.txHash")}</TableHead>
                  <TableHead>{t("admin.payouts.error")}</TableHead>
                  <TableHead className="text-right">{t("admin.payouts.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {t("admin.payouts.noCommissions")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCommissions.map(commission => (
                    <TableRow key={commission.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{commission.userName}</p>
                          <p className="text-sm text-muted-foreground">{commission.userEmail}</p>
                          {!commission.qualified && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-600 mt-1">
                              {t("admin.payouts.notQualified")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {commission.commissionType === "direct_bonus" ? (
                          <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                            {t("admin.payouts.directBonus")}
                          </Badge>
                        ) : commission.commissionType === "manual_payout" ? (
                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                            {t("admin.payouts.manualPayout")}
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                            {t("admin.payouts.residual")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        ${commission.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {commission.payoutWalletAddress ? (
                          <code className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">
                            {truncateAddress(commission.payoutWalletAddress)}
                          </code>
                        ) : (
                          <span className="text-xs text-amber-600">{t("admin.payouts.notSet")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {commission.status === "pending" ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            {t("admin.payouts.pendingStatus")}
                          </Badge>
                        ) : commission.status === "failed" ? (
                          <Badge variant="destructive">
                            {t("admin.payouts.failedStatus")}
                          </Badge>
                        ) : commission.status === "paid" ? (
                          <Badge className="bg-[#D4A853]">
                            {t("admin.payouts.paidStatus")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {commission.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {commission.usdcTransactionId ? (
                          <a
                            href={`https://polygonscan.com/tx/${commission.usdcTransactionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {commission.usdcTransactionId.slice(0, 8)}...
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {commission.errorMessage ? (
                          <div className="max-w-xs truncate text-xs text-red-500" title={commission.errorMessage}>
                            {commission.errorMessage}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {(commission.status === "pending" || commission.status === "failed") ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcessSingle(commission.id)}
                              disabled={processing || processingId === commission.id || !commission.payoutWalletAddress}
                              title={!commission.payoutWalletAddress ? t("admin.payouts.noPayoutWallet") : ""}
                            >
                              {processingId === commission.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  {t("admin.payouts.processingStatus")}
                                </>
                              ) : commission.status === "failed" ? (
                                t("admin.payouts.retry")
                              ) : (
                                t("admin.payouts.process")
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleMarkCompleted(commission.id)}
                              disabled={processing || processingId === commission.id}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {t("admin.payouts.markComplete")}
                            </Button>
                          </div>
                        ) : (
                          <Badge className="bg-[#D4A853]">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {t("admin.payouts.completed")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.payouts.confirmBulkPayout")}</DialogTitle>
            <DialogDescription>
              {t("admin.payouts.confirmBulkPayoutDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
              <span className="text-sm font-medium">{t("admin.payouts.totalUsers")}:</span>
              <span className="text-lg font-bold">{summary.pending}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
              <span className="text-sm font-medium">{t("admin.payouts.totalAmount")}:</span>
              <span className="text-lg font-bold text-primary">${summary.totalAmount.toFixed(2)} USDC</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
              <span className="text-sm font-medium">{t("admin.payouts.payoutWalletBalance")}:</span>
              <span className={`text-lg font-bold ${balanceWarning ? 'text-red-500' : 'text-[#D4A853]'}`}>
                ${payoutWalletBalance?.toFixed(2) || "0.00"} USDC
              </span>
            </div>
            {balanceWarning && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-500">
                  {t("admin.payouts.insufficientBalanceWarning")}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleProcessBulk}>
              {t("admin.payouts.confirmAndProcess")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Modal */}
      <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("admin.payouts.payoutResults")}</DialogTitle>
            <DialogDescription>
              {t("admin.payouts.payoutResultsDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {processResults.map(result => (
              <div
                key={result.commissionId}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  result.success ? 'bg-[#D4A853]/10 border-[#D4A853]/20' :
                  result.skipped ? 'bg-gray-500/10 border-gray-500/20' :
                  'bg-red-500/10 border-red-500/20'
                }`}
              >
                <div className="flex-1">
                  <p className="font-medium">{result.userName}</p>
                  <p className="text-sm text-muted-foreground">${result.amount.toFixed(2)} USDC</p>
                  {result.error && (
                    <p className="text-xs text-red-500 mt-1">{result.error}</p>
                  )}
                  {result.txHash && (
                    <a
                      href={`https://polygonscan.com/tx/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                    >
                      {t("admin.payouts.viewOnPolygonScan")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div>
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-[#D4A853]" />
                  ) : result.skipped ? (
                    <Badge variant="outline">{t("admin.payouts.skipped")}</Badge>
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowResultsModal(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Payout Dialog */}
      <ManualPayoutDialog
        open={showManualPayoutDialog}
        onOpenChange={setShowManualPayoutDialog}
        users={users}
        onSuccess={fetchData}
      />
    </div>
  )
}
