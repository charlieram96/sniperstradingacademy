"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
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
        .select("role")
        .eq("id", user.id)
        .single()

      if (['superadmin', 'superadmin+'].includes(userData?.role || '')) {
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
        alert(`Success! $${data.amount} transferred to ${data.userName}`)
      } else {
        alert(`Failed: ${data.error || "Unknown error"}`)
      }

      await fetchData()
    } catch (error) {
      alert("Error processing payout")
      console.error(error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleMarkCompleted = async (commissionId: string) => {
    if (!confirm("Mark this commission as completed? Use this only if payment was made outside the platform (check, cash, wire, etc.).")) {
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
        alert(`Success! Commission marked as completed (manual payment)`)
      } else {
        alert(`Failed: ${data.error || "Unknown error"}`)
      }

      await fetchData()
    } catch (error) {
      alert("Error marking commission as completed")
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
      alert("Error processing bulk payouts")
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
    if (!address) return "Not set"
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
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">This page is only accessible to superadmins.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Commission Payouts (USDC)</h1>
        </div>
        <p className="text-muted-foreground">Process residual commissions and direct bonuses via Polygon USDC</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.totalAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">USDC to pay out</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{summary.pending}</div>
            <p className="text-xs text-muted-foreground">Not processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{summary.failed}</div>
            <p className="text-xs text-muted-foreground">Needs retry</p>
          </CardContent>
        </Card>

        <Card className={balanceWarning ? "border-red-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Payout Wallet Balance
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balanceWarning ? 'text-red-500' : 'text-primary'}`}>
              ${payoutWalletBalance?.toFixed(2) || "0.00"}
            </div>
            {balanceWarning && (
              <p className="text-xs text-red-500 mt-1">⚠️ Insufficient balance</p>
            )}
            <p className="text-xs text-muted-foreground">USDC on Polygon</p>
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
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({commissions.length})</SelectItem>
                  <SelectItem value="pending">Pending ({summary.pending})</SelectItem>
                  <SelectItem value="failed">Failed ({summary.failed})</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={processing}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowManualPayoutDialog(true)}
                disabled={processing}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Manual Payout
              </Button>

              <Button
                onClick={() => setShowConfirmModal(true)}
                disabled={processing || summary.pending === 0 || balanceWarning}
                className="bg-primary hover:bg-primary/90"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Process All Pending ({summary.pending})
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
          <CardTitle>Commission Details</CardTitle>
          <CardDescription>Individual payout status and controls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tx Hash</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No commissions to display
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
                              Not Qualified
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {commission.commissionType === "direct_bonus" ? (
                          <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                            Direct Bonus
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                            Residual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        ${commission.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {commission.payoutWalletAddress ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {truncateAddress(commission.payoutWalletAddress)}
                          </code>
                        ) : (
                          <span className="text-xs text-amber-600">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {commission.status === "pending" ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            ⏸️ Pending
                          </Badge>
                        ) : commission.status === "failed" ? (
                          <Badge variant="destructive">
                            ❌ Failed
                          </Badge>
                        ) : commission.status === "paid" ? (
                          <Badge className="bg-green-600">
                            ✅ Paid
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
                              title={!commission.payoutWalletAddress ? "User has no payout wallet" : ""}
                            >
                              {processingId === commission.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Processing
                                </>
                              ) : commission.status === "failed" ? (
                                "Retry"
                              ) : (
                                "Process"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleMarkCompleted(commission.id)}
                              disabled={processing || processingId === commission.id}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Mark Complete
                            </Button>
                          </div>
                        ) : (
                          <Badge className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completed
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
            <DialogTitle>Confirm Bulk Payout</DialogTitle>
            <DialogDescription>
              You are about to process USDC payouts for all pending commissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="text-sm font-medium">Total Users:</span>
              <span className="text-lg font-bold">{summary.pending}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="text-sm font-medium">Total Amount:</span>
              <span className="text-lg font-bold text-primary">${summary.totalAmount.toFixed(2)} USDC</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="text-sm font-medium">Payout Wallet Balance:</span>
              <span className={`text-lg font-bold ${balanceWarning ? 'text-red-500' : 'text-green-600'}`}>
                ${payoutWalletBalance?.toFixed(2) || "0.00"} USDC
              </span>
            </div>
            {balanceWarning && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-500">
                  Warning: Insufficient payout wallet balance. Some transfers may fail.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleProcessBulk}>
              Confirm & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Modal */}
      <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payout Results</DialogTitle>
            <DialogDescription>
              Summary of bulk payout processing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {processResults.map(result => (
              <div
                key={result.commissionId}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  result.success ? 'bg-green-500/10 border-green-500/20' :
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
                      View on PolygonScan
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div>
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : result.skipped ? (
                    <Badge variant="outline">Skipped</Badge>
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowResultsModal(false)}>
              Close
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
