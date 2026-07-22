"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { staggerContainer, staggerItem } from "@/lib/motion"
import {
  Users,
  AlertCircle,
  XCircle,
  DollarSign,
  ChevronRight,
  CheckCircle,
  Search,
  Clock,
  CreditCard,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

// ── Types ──────────────────────────────────────────────────────────────────

interface MemberData {
  id: string
  name: string
  email: string
  is_active: boolean
  last_payment_date: string | null
  next_payment_due_date: string | null
  payment_schedule: string | null
  initial_payment_completed: boolean
  initial_payment_date: string | null
  inactive_since: string | null
  created_at: string
}

interface RecentPayment {
  id: string
  user_id: string
  user_name: string
  amount: number
  payment_type: string
  status: string
  created_at: string
}

interface PaymentRecord {
  id: string
  amount: number
  payment_type: string
  status: string
  created_at: string
}

interface InsightsStats {
  totalMembers: number
  activeMembers: number
  atRiskCount: number
  recentlyLapsedCount: number
  revenueThisMonth: number
}

interface InsightsResponse {
  members: MemberData[]
  recentPayments: RecentPayment[]
  stats: InsightsStats
}

interface MemberPaymentsResponse {
  member: MemberData
  payments: PaymentRecord[]
}

type AtRiskCategory = "overdue" | "due-soon" | "lapsed"

interface AtRiskMember {
  member: MemberData
  category: AtRiskCategory
  daysValue: number // days overdue, days until due, or days since lapsed
}

type SortColumn =
  | "name"
  | "status"
  | "lastPaid"
  | "nextDue"
  | "schedule"
  | "joined"
type SortDirection = "asc" | "desc"

// ── Helpers ────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A"
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function relativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths}mo ago`
}

function formatPaymentType(type: string): string {
  const t = type.toLowerCase()
  if (t.includes("initial") || t.includes("unlock")) return "Initial Unlock"
  if (t.includes("monthly")) return "Monthly"
  if (t.includes("weekly")) return "Weekly"
  return type
}

function formatSchedule(schedule: string | null): string {
  if (!schedule) return "N/A"
  const s = schedule.toLowerCase()
  if (s.includes("week")) return "Weekly"
  if (s.includes("month")) return "Monthly"
  return schedule
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── Component ──────────────────────────────────────────────────────────────

export function MemberInsights({ userId }: { userId: string }) {
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<MemberData | null>(null)
  const [memberPayments, setMemberPayments] = useState<PaymentRecord[]>([])
  const [memberPaymentsLoading, setMemberPaymentsLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // All Members tab state
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortColumn, setSortColumn] = useState<SortColumn>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  // Fetch main data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/team/member-payments?userId=${userId}`)
        if (res.ok) {
          const json: InsightsResponse = await res.json()
          setData(json)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [userId])

  // Fetch member payment detail
  const openMemberDetail = useCallback(
    async (member: MemberData) => {
      setSelectedMember(member)
      setDialogOpen(true)
      setMemberPaymentsLoading(true)
      setMemberPayments([])
      try {
        const res = await fetch(
          `/api/team/member-payments?userId=${userId}&memberId=${member.id}`
        )
        if (res.ok) {
          const json: MemberPaymentsResponse = await res.json()
          setMemberPayments(json.payments)
        }
      } catch {
        // silently fail
      } finally {
        setMemberPaymentsLoading(false)
      }
    },
    [userId]
  )

  // Classify at-risk members
  const atRiskMembers = useMemo((): AtRiskMember[] => {
    if (!data) return []
    const now = new Date()
    const result: AtRiskMember[] = []

    for (const m of data.members) {
      if (m.is_active && m.next_payment_due_date) {
        const dueDate = new Date(m.next_payment_due_date)
        const daysUntilDue = daysBetween(now, dueDate)
        if (daysUntilDue < 0) {
          result.push({
            member: m,
            category: "overdue",
            daysValue: Math.abs(daysUntilDue),
          })
        } else if (daysUntilDue <= 7) {
          result.push({
            member: m,
            category: "due-soon",
            daysValue: daysUntilDue,
          })
        }
      } else if (!m.is_active && m.inactive_since) {
        const inactiveSince = new Date(m.inactive_since)
        const daysSinceLapsed = daysBetween(inactiveSince, now)
        if (daysSinceLapsed <= 30) {
          result.push({
            member: m,
            category: "lapsed",
            daysValue: daysSinceLapsed,
          })
        }
      }
    }

    // Sort: overdue first (by due date asc), then due-soon (asc), then lapsed (most recent first)
    const categoryOrder: Record<AtRiskCategory, number> = {
      overdue: 0,
      "due-soon": 1,
      lapsed: 2,
    }
    result.sort((a, b) => {
      const catDiff = categoryOrder[a.category] - categoryOrder[b.category]
      if (catDiff !== 0) return catDiff
      if (a.category === "lapsed") return a.daysValue - b.daysValue // most recent first
      return a.daysValue - b.daysValue
    })

    return result
  }, [data])

  // Filtered + sorted members for All Members tab
  const filteredMembers = useMemo(() => {
    if (!data) return []
    let members = [...data.members]

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      members = members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter === "active") {
      members = members.filter((m) => m.is_active)
    } else if (statusFilter === "inactive") {
      members = members.filter((m) => !m.is_active)
    }

    // Sort
    members.sort((a, b) => {
      let cmp = 0
      switch (sortColumn) {
        case "name":
          cmp = a.name.localeCompare(b.name)
          break
        case "status":
          cmp = Number(b.is_active) - Number(a.is_active)
          break
        case "lastPaid":
          cmp =
            (a.last_payment_date ?? "").localeCompare(
              b.last_payment_date ?? ""
            )
          break
        case "nextDue":
          cmp =
            (a.next_payment_due_date ?? "").localeCompare(
              b.next_payment_due_date ?? ""
            )
          break
        case "schedule":
          cmp = (a.payment_schedule ?? "").localeCompare(
            b.payment_schedule ?? ""
          )
          break
        case "joined":
          cmp = a.created_at.localeCompare(b.created_at)
          break
      }
      return sortDirection === "asc" ? cmp : -cmp
    })

    return members
  }, [data, searchQuery, statusFilter, sortColumn, sortDirection])

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize))
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, sortColumn, sortDirection])

  const toggleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(col)
      setSortDirection("asc")
    }
  }

  const sortArrow = (col: SortColumn) => {
    if (sortColumn !== col) return ""
    return sortDirection === "asc" ? " \u2191" : " \u2193"
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || data.stats.totalMembers === 0) return null

  const { stats, recentPayments } = data

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ──────────────────────────────────────────── */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Active Members */}
        <motion.div variants={staggerItem}>
          <Card className="border-emerald-500/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Active Members
                  </p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {stats.activeMembers} / {stats.totalMembers}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-500/10 p-2">
                  <Users className="size-5 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* At Risk */}
        <motion.div variants={staggerItem}>
          <Card className="border-amber-500/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">At Risk</p>
                  <p className="text-2xl font-bold text-amber-400">
                    {stats.atRiskCount}
                  </p>
                </div>
                <div className="rounded-full bg-amber-500/10 p-2">
                  <AlertCircle className="size-5 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recently Lapsed */}
        <motion.div variants={staggerItem}>
          <Card className="border-red-500/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Recently Lapsed
                  </p>
                  <p className="text-2xl font-bold text-red-400">
                    {stats.recentlyLapsedCount}
                  </p>
                </div>
                <div className="rounded-full bg-red-500/10 p-2">
                  <XCircle className="size-5 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Revenue This Month */}
        <motion.div variants={staggerItem}>
          <Card className="border-gold-400/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Revenue This Month
                  </p>
                  <p className="text-2xl font-bold text-gold-400">
                    {formatCurrency(stats.revenueThisMonth)}
                  </p>
                </div>
                <div className="rounded-full bg-gold-400/10 p-2">
                  <DollarSign className="size-5 text-gold-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Tabbed Content ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="at-risk">
            <TabsList>
              <TabsTrigger value="at-risk">
                At Risk
                {atRiskMembers.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">
                    {atRiskMembers.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all-members">All Members</TabsTrigger>
              <TabsTrigger value="activity">Activity Feed</TabsTrigger>
            </TabsList>

            {/* ── At Risk Tab ──────────────────────────────────────── */}
            <TabsContent value="at-risk">
              {atRiskMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle className="size-10 mb-3 text-emerald-400" />
                  <p className="text-sm">
                    All members are in good standing
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {atRiskMembers.map((item) => (
                    <button
                      key={item.member.id}
                      onClick={() => openMemberDetail(item.member)}
                      className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-surface-2 transition-colors"
                    >
                      {/* Avatar */}
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
                          item.category === "overdue"
                            ? "bg-red-500"
                            : item.category === "due-soon"
                              ? "bg-amber-500"
                              : "bg-zinc-500"
                        }`}
                      >
                        {item.member.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.member.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last paid: {formatDate(item.member.last_payment_date)}
                        </p>
                      </div>

                      {/* Status badge */}
                      {item.category === "overdue" && (
                        <Badge variant="destructive">
                          Overdue
                        </Badge>
                      )}
                      {item.category === "due-soon" && (
                        <Badge className="bg-amber-500/12 text-amber-400">
                          Due in {item.daysValue} days
                        </Badge>
                      )}
                      {item.category === "lapsed" && (
                        <Badge variant="secondary">
                          Lapsed {item.daysValue} days ago
                        </Badge>
                      )}

                      {/* Schedule */}
                      <Badge variant="outline" className="hidden sm:inline-flex">
                        {formatSchedule(item.member.payment_schedule)}
                      </Badge>

                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── All Members Tab ──────────────────────────────────── */}
            <TabsContent value="all-members">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    {(
                      [
                        ["name", "Name"],
                        ["status", "Status"],
                        ["lastPaid", "Last Paid"],
                        ["nextDue", "Next Due"],
                        ["schedule", "Schedule"],
                        ["joined", "Joined"],
                      ] as [SortColumn, string][]
                    ).map(([col, label]) => (
                      <TableHead key={col}>
                        <button
                          onClick={() => toggleSort(col)}
                          className="uppercase tracking-[0.08em] hover:text-foreground transition-colors"
                        >
                          {label}
                          {sortArrow(col)}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMembers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-12 text-center text-muted-foreground"
                      >
                        No members found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedMembers.map((m) => (
                      <TableRow
                        key={m.id}
                        onClick={() => openMemberDetail(m)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-medium text-foreground">
                          {m.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={m.is_active ? "success" : "secondary"}
                          >
                            {m.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(m.last_payment_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(m.next_payment_due_date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {formatSchedule(m.payment_schedule)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(m.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {filteredMembers.length > 0 && (
                <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                  <p>
                    Showing{" "}
                    {(currentPage - 1) * pageSize + 1}-
                    {Math.min(currentPage * pageSize, filteredMembers.length)}{" "}
                    of {filteredMembers.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Prev
                    </Button>
                    <span>
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Activity Feed Tab ────────────────────────────────── */}
            <TabsContent value="activity">
              {recentPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="size-10 mb-3" />
                  <p className="text-sm">No recent payment activity</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {recentPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-start gap-3 px-1 py-2"
                      >
                        <div
                          className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                            payment.status === "completed" ||
                            payment.status === "succeeded"
                              ? "bg-emerald-400"
                              : "bg-red-400"
                          }`}
                        />
                        <p className="text-sm text-foreground-secondary">
                          <span className="font-medium text-foreground">
                            {payment.user_name}
                          </span>{" "}
                          paid ${payment.amount} &mdash;{" "}
                          {formatPaymentType(payment.payment_type)} &mdash;{" "}
                          <span className="text-muted-foreground">
                            {relativeTime(payment.created_at)}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Member Payment Detail Dialog ───────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5" />
              {selectedMember?.name} &mdash; Payment Details
            </DialogTitle>
            <DialogDescription className="sr-only">
              Payment details for {selectedMember?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-5">
              {/* Status overview */}
              <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
                <Badge
                  variant={
                    selectedMember.is_active ? "success" : "secondary"
                  }
                >
                  {selectedMember.is_active ? "Active" : "Inactive"}
                </Badge>
                <span className="text-sm text-muted-foreground truncate">
                  {selectedMember.email}
                </span>
              </div>

              {/* Payment Status */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Payment Status</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Next Payment Due
                    </p>
                    {selectedMember.next_payment_due_date ? (
                      <>
                        <p className="text-sm font-medium">
                          {formatDate(selectedMember.next_payment_due_date)}
                        </p>
                        <p
                          className={`text-xs ${
                            daysBetween(
                              new Date(),
                              new Date(selectedMember.next_payment_due_date)
                            ) < 0
                              ? "text-red-400"
                              : daysBetween(
                                    new Date(),
                                    new Date(
                                      selectedMember.next_payment_due_date
                                    )
                                  ) <= 7
                                ? "text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {daysBetween(
                            new Date(),
                            new Date(selectedMember.next_payment_due_date)
                          ) < 0
                            ? `Overdue by ${Math.abs(daysBetween(new Date(), new Date(selectedMember.next_payment_due_date)))} days`
                            : `In ${daysBetween(new Date(), new Date(selectedMember.next_payment_due_date))} days`}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">N/A</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Payment Schedule
                    </p>
                    <Badge variant="outline">
                      {formatSchedule(selectedMember.payment_schedule)}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Member since {formatDate(selectedMember.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <h4 className="text-sm font-semibold mb-3">
                  Payment History
                </h4>
                {memberPaymentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : memberPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No payment history
                  </p>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {memberPayments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2"
                        >
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">
                              ${p.amount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(p.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {formatPaymentType(p.payment_type)}
                            </Badge>
                            <Badge
                              variant={
                                p.status === "completed" ||
                                p.status === "succeeded"
                                  ? "success"
                                  : p.status === "failed"
                                    ? "destructive"
                                    : "default"
                              }
                            >
                              {p.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
