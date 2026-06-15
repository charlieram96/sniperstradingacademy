"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  ShieldAlert,
  XCircle,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { roleRank } from "@/lib/admin/permissions"
import { useTranslation } from "@/components/language-provider"

interface FlaggedUser {
  id: string
  email: string
  name: string | null
  payment_schedule: string | null
  flagged_for_review_at: string
  is_active: boolean
  missed_weeks: number
  last_payment_date: string | null
}

interface Stats {
  totalFlagged: number
  flaggedThisWeek: number
  weeklyCount: number
  monthlyCount: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

export default function FlaggedReviewsPage() {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [users, setUsers] = useState<FlaggedUser[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [search, setSearch] = useState("")
  const [scheduleFilter, setScheduleFilter] = useState("all")
  const [page, setPage] = useState(1)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<"dismiss" | "deactivate">("dismiss")
  const [selectedUser, setSelectedUser] = useState<FlaggedUser | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        search,
        schedule: scheduleFilter,
        page: page.toString(),
        limit: "50",
      })

      const response = await fetch(`/api/admin/flagged-reviews?${params}`)
      const data = await response.json()

      if (data.success) {
        setUsers(data.users)
        setStats(data.stats)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("Failed to fetch flagged reviews:", error)
    }
  }, [search, scheduleFilter, page])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const checkAuth = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("role, permissions")
        .eq("id", user.id)
        .single()

      if (roleRank(userData?.role) >= roleRank('superadmin+') || (userData?.permissions ?? []).includes('view_flagged_reviews')) {
        setAuthorized(true)
        await fetchData()
      }
    }
    setLoading(false)
  }, [fetchData])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (authorized) {
      fetchData()
    }
  }, [authorized, search, scheduleFilter, page, fetchData])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, scheduleFilter])

  const openDialog = (user: FlaggedUser, action: "dismiss" | "deactivate") => {
    setSelectedUser(user)
    setDialogAction(action)
    setDialogOpen(true)
  }

  const handleResolve = async () => {
    if (!selectedUser) return

    setActionLoading(true)
    try {
      const response = await fetch("/api/admin/flagged-reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: dialogAction,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setDialogOpen(false)
        setSelectedUser(null)
        await fetchData()
      }
    } catch (error) {
      console.error("Failed to resolve flag:", error)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!authorized) {
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
            <AlertTriangle className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">{t("admin.flaggedReviews.title")}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {t("admin.flaggedReviews.refresh")}
          </Button>
        </div>
        <p className="text-muted-foreground">{t("admin.flaggedReviews.description")}</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.flaggedReviews.totalFlagged")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalFlagged}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.flaggedReviews.users")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.flaggedReviews.flaggedThisWeek")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.flaggedThisWeek}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.flaggedReviews.users")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.flaggedReviews.weeklyPayers")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.weeklyCount}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.flaggedReviews.users")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.flaggedReviews.monthlyPayers")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.monthlyCount}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.flaggedReviews.users")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                placeholder={t("admin.flaggedReviews.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.flaggedReviews.allSchedules")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.flaggedReviews.allSchedules")}</SelectItem>
                  <SelectItem value="weekly">{t("admin.flaggedReviews.weekly")}</SelectItem>
                  <SelectItem value="monthly">{t("admin.flaggedReviews.monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t("admin.flaggedReviews.title")}
            {pagination && (
              <span className="text-sm font-normal text-muted-foreground">
                ({pagination.total} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.flaggedReviews.user")}</TableHead>
                  <TableHead>{t("admin.flaggedReviews.schedule")}</TableHead>
                  <TableHead>{t("admin.flaggedReviews.flaggedDate")}</TableHead>
                  <TableHead>{t("admin.flaggedReviews.missedWeeks")}</TableHead>
                  <TableHead>{t("admin.flaggedReviews.lastPayment")}</TableHead>
                  <TableHead>{t("admin.flaggedReviews.status")}</TableHead>
                  <TableHead>{t("admin.flaggedReviews.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-muted-foreground font-medium">{t("admin.flaggedReviews.noFlaggedUsers")}</p>
                        <p className="text-sm text-muted-foreground">{t("admin.flaggedReviews.noFlaggedDescription")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{u.name || t("common.noName")}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {u.payment_schedule || "monthly"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.flagged_for_review_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${u.missed_weeks >= 20 ? "bg-red-500" : u.missed_weeks >= 16 ? "bg-orange-500" : "bg-yellow-500"} text-white`}>
                          {t("admin.flaggedReviews.weeks").replace("{count}", String(u.missed_weeks))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.last_payment_date
                          ? new Date(u.last_payment_date).toLocaleDateString()
                          : t("admin.flaggedReviews.neverPaid")}
                      </TableCell>
                      <TableCell>
                        <Badge className={u.is_active ? "bg-[#D4A853] text-white" : "bg-gray-500 text-white"}>
                          {u.is_active ? t("admin.flaggedReviews.active") : t("admin.flaggedReviews.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog(u, "dismiss")}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            {t("admin.flaggedReviews.dismiss")}
                          </Button>
                          {u.is_active && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => openDialog(u, "deactivate")}
                            >
                              {t("admin.flaggedReviews.deactivate")}
                            </Button>
                          )}
                        </div>
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
                {t("admin.flaggedReviews.pageOf").replace("{page}", String(pagination.page)).replace("{total}", String(pagination.totalPages))}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("admin.flaggedReviews.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasMore}
                >
                  {t("admin.flaggedReviews.next")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "dismiss"
                ? t("admin.flaggedReviews.dismissTitle")
                : t("admin.flaggedReviews.deactivateTitle")}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "dismiss"
                ? t("admin.flaggedReviews.confirmDismiss")
                : t("admin.flaggedReviews.confirmDeactivate")}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-2">
              <p className="text-sm font-medium">{selectedUser.name || selectedUser.email}</p>
              <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={actionLoading}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={dialogAction === "deactivate" ? "destructive" : "default"}
              onClick={handleResolve}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialogAction === "dismiss"
                ? t("admin.flaggedReviews.dismiss")
                : t("admin.flaggedReviews.deactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
