"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  ExternalLink
} from "lucide-react"
import { formatDollars } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { hasPrivilege } from "@/lib/admin/permissions"
import { useTranslation } from "@/components/language-provider"

interface TransactionLog {
  id: string
  direction: "incoming" | "outgoing"
  type: string
  amount: number
  status: string
  userName: string | null
  userEmail: string
  txHash: string | null
  createdAt: string
  paidAt: string | null
}

interface Stats {
  totalIncoming: number
  totalIncomingAmount: number
  totalOutgoing: number
  totalOutgoingAmount: number
  pendingPayouts: number
  pendingPayoutsAmount: number
  failedTransactions: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

const TYPE_LABELS: Record<string, string> = {
  initial: "Initial Payment",
  weekly: "Weekly Subscription",
  monthly: "Monthly Subscription",
  direct_bonus: "Direct Bonus",
  residual: "Residual Commission",
  residual_monthly: "Monthly Residual",
  crypto_deposit: "Crypto Deposit",
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-[#D4A853]",
  succeeded: "bg-[#D4A853]",
  paid: "bg-[#D4A853]",
  pending: "bg-yellow-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
  disputed: "bg-orange-500",
  refunded: "bg-purple-500",
}

export default function TransactionLogsPage() {
  const { t } = useTranslation()

  const getTypeLabel = (type: string): string => {
    const typeLabels: Record<string, string> = {
      initial: t("admin.transactionLogs.initialPayment"),
      weekly: t("admin.transactionLogs.weeklySubscription"),
      monthly: t("admin.transactionLogs.monthlySubscription"),
      direct_bonus: t("admin.transactionLogs.directBonus"),
      residual: t("admin.transactionLogs.residualCommission"),
      residual_monthly: t("admin.transactionLogs.monthlyResidual"),
      crypto_deposit: t("admin.transactionLogs.cryptoDeposit"),
    }
    return typeLabels[type] || type
  }

  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [transactions, setTransactions] = useState<TransactionLog[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [directionFilter, setDirectionFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [page, setPage] = useState(1)

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        direction: directionFilter,
        status: statusFilter,
        type: typeFilter,
        page: page.toString(),
        limit: "50",
      })

      const response = await fetch(`/api/admin/transaction-logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setTransactions(data.transactions)
        setStats(data.stats)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
    }
  }, [directionFilter, statusFilter, typeFilter, page])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchTransactions()
    setRefreshing(false)
  }

  const checkSuperAdminStatus = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("role, permissions")
        .eq("id", user.id)
        .single()

      if (hasPrivilege(userData?.role, userData?.permissions, 'view_transaction_logs')) {
        setIsSuperAdmin(true)
        await fetchTransactions()
      }
    }
    setLoading(false)
  }, [fetchTransactions])

  useEffect(() => {
    checkSuperAdminStatus()
  }, [checkSuperAdminStatus])

  useEffect(() => {
    if (isSuperAdmin) {
      fetchTransactions()
    }
  }, [isSuperAdmin, directionFilter, statusFilter, typeFilter, page, fetchTransactions])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [directionFilter, statusFilter, typeFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">{t("admin.transactionLogs.title")}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {t("admin.transactionLogs.refresh")}
          </Button>
        </div>
        <p className="text-muted-foreground">{t("admin.transactionLogs.description")}</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.transactionLogs.totalIncoming")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="h-5 w-5 text-[#D4A853]" />
                <div>
                  <p className="text-2xl font-bold text-[#D4A853]">{formatDollars(stats.totalIncomingAmount)}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.transactionLogs.transactionsCount").replace("{count}", String(stats.totalIncoming))}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.transactionLogs.totalOutgoing")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{formatDollars(stats.totalOutgoingAmount)}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.transactionLogs.transactionsCount").replace("{count}", String(stats.totalOutgoing))}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.transactionLogs.pendingPayouts")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{formatDollars(stats.pendingPayoutsAmount)}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.transactionLogs.pendingCount").replace("{count}", String(stats.pendingPayouts))}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.transactionLogs.failed")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.failedTransactions}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.transactionLogs.transactions")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("admin.transactionLogs.filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">{t("admin.transactionLogs.direction")}</label>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.transactionLogs.allDirections")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.transactionLogs.allDirections")}</SelectItem>
                  <SelectItem value="incoming">{t("admin.transactionLogs.incomingOnly")}</SelectItem>
                  <SelectItem value="outgoing">{t("admin.transactionLogs.outgoingOnly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">{t("admin.transactionLogs.status")}</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.transactionLogs.allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.transactionLogs.allStatuses")}</SelectItem>
                  <SelectItem value="completed">{t("admin.transactionLogs.completed")}</SelectItem>
                  <SelectItem value="pending">{t("admin.transactionLogs.pending")}</SelectItem>
                  <SelectItem value="failed">{t("admin.transactionLogs.failed2")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">{t("admin.transactionLogs.type")}</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.transactionLogs.allTypes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.transactionLogs.allTypes")}</SelectItem>
                  <SelectItem value="crypto_deposit">{t("admin.transactionLogs.cryptoDeposit")}</SelectItem>
                  <SelectItem value="initial">{t("admin.transactionLogs.initialPayment")}</SelectItem>
                  <SelectItem value="weekly">{t("admin.transactionLogs.weeklySubscription")}</SelectItem>
                  <SelectItem value="monthly">{t("admin.transactionLogs.monthlySubscription")}</SelectItem>
                  <SelectItem value="direct_bonus">{t("admin.transactionLogs.directBonus")}</SelectItem>
                  <SelectItem value="residual">{t("admin.transactionLogs.residualCommission")}</SelectItem>
                  <SelectItem value="residual_monthly">{t("admin.transactionLogs.monthlyResidual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t("admin.transactionLogs.transactions")}
            {pagination && (
              <span className="text-sm font-normal text-muted-foreground">
                ({pagination.total} total)
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {t("admin.transactionLogs.allTransactions")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.transactionLogs.date")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.direction")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.type")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.user")}</TableHead>
                  <TableHead className="text-right">{t("admin.transactionLogs.amount")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.status")}</TableHead>
                  <TableHead>{t("admin.transactionLogs.txHash")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {t("admin.transactionLogs.noTransactions")}
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {tx.direction === "incoming" ? (
                          <div className="flex items-center gap-1">
                            <ArrowDownCircle className="h-4 w-4 text-[#D4A853]" />
                            <span className="text-sm text-[#D4A853]">{t("admin.transactionLogs.in")}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <ArrowUpCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm text-red-600">{t("admin.transactionLogs.out")}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {getTypeLabel(tx.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{tx.userName || t("common.noName")}</p>
                          <p className="text-xs text-muted-foreground">{tx.userEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${
                        tx.direction === "incoming" ? "text-[#D4A853]" : "text-red-600"
                      }`}>
                        {tx.direction === "incoming" ? "+" : "-"}{formatDollars(tx.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_COLORS[tx.status] || "bg-gray-500"} text-white capitalize`}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tx.txHash ? (
                          <a
                            href={`https://polygonscan.com/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            {tx.txHash.slice(0, 8)}...
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {t("admin.transactionLogs.pageOf").replace("{page}", String(pagination.page)).replace("{total}", String(pagination.totalPages))}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("admin.transactionLogs.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasMore}
                >
                  {t("admin.transactionLogs.next")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
