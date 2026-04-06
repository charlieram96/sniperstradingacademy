# Team Member Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Member Insights section to the My Team page with at-risk alerts, full downline member table, activity feed, and per-member payment history.

**Architecture:** New server-side API endpoint (`/api/team/member-payments`) fetches downline member payment data and computes stats. A new client component (`member-insights.tsx`) renders summary cards, tabbed content (At Risk / All Members / Activity Feed), and an enhanced member detail dialog with payment history. The component manages its own data fetching independently from the parent team page.

**Tech Stack:** Next.js API route, Supabase queries, React client component, existing UI library (Card, Tabs, Badge, Dialog, ScrollArea), framer-motion, useTranslation

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/api/team/member-payments/route.ts` | Create | API endpoint: fetch downline member payment data, compute stats, return member payment history |
| `components/team/member-insights.tsx` | Create | Client component: summary cards, tabbed content, member payment detail dialog |
| `app/(dashboard)/team/page.tsx` | Modify | Import and render `MemberInsights` in the correct position |

---

### Task 1: Create the API endpoint

**Files:**
- Create: `app/api/team/member-payments/route.ts`

- [ ] **Step 1: Create the API route directory**

```bash
mkdir -p app/api/team/member-payments
```

- [ ] **Step 2: Write the API endpoint**

Create `app/api/team/member-payments/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const memberId = searchParams.get('memberId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get the requesting user's network position
    const { data: caller } = await supabase
      .from('users')
      .select('network_position_id, network_level, network_position')
      .eq('id', userId)
      .single()

    if (!caller?.network_position_id) {
      return NextResponse.json({ error: 'User has no network position' }, { status: 400 })
    }

    // If memberId provided, return that member's payment history
    if (memberId) {
      // Verify memberId is in caller's downline using position-range math
      const { data: member } = await supabase
        .from('users')
        .select('id, name, email, is_active, last_payment_date, next_payment_due_date, payment_schedule, initial_payment_completed, initial_payment_date, inactive_since, created_at, network_level, network_position')
        .eq('id', memberId)
        .single()

      if (!member || !member.network_level || !member.network_position) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 })
      }

      // Position-range check: member must be a descendant of caller
      if (member.network_level <= caller.network_level) {
        return NextResponse.json({ error: 'Member is not in your downline' }, { status: 403 })
      }

      const levelDiff = member.network_level - caller.network_level
      const rangeStart = (caller.network_position - 1) * Math.pow(3, levelDiff) + 1
      const rangeEnd = rangeStart + Math.pow(3, levelDiff) - 1

      if (member.network_position < rangeStart || member.network_position > rangeEnd) {
        return NextResponse.json({ error: 'Member is not in your downline' }, { status: 403 })
      }

      // Fetch payment history for this member
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, payment_type, status, created_at')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false })
        .limit(50)

      return NextResponse.json({ member, payments: payments || [] })
    }

    // No memberId — return aggregate data for all downline members
    // Get all downline member IDs using the existing RPC
    const { data: downline } = await supabase
      .rpc('get_downline_contributors', { p_user_id: userId })
      .limit(10000)

    const downlineIds = downline?.map((m: { contributor_id: string }) => m.contributor_id) || []

    if (downlineIds.length === 0) {
      return NextResponse.json({
        members: [],
        recentPayments: [],
        stats: { totalMembers: 0, activeMembers: 0, atRiskCount: 0, recentlyLapsedCount: 0, revenueThisMonth: 0 }
      })
    }

    // Fetch member details with payment fields
    const { data: members } = await supabase
      .from('users')
      .select('id, name, email, is_active, last_payment_date, next_payment_due_date, payment_schedule, initial_payment_completed, initial_payment_date, inactive_since, created_at')
      .in('id', downlineIds)
      .limit(10000)

    const memberList = members || []

    // Fetch recent payments across all downline members (activity feed)
    const { data: recentPayments } = await supabase
      .from('payments')
      .select('id, user_id, amount, payment_type, status, created_at')
      .in('user_id', downlineIds)
      .order('created_at', { ascending: false })
      .limit(50)

    // Build a name lookup from the members list
    const nameMap = new Map(memberList.map(m => [m.id, m.name]))

    const recentPaymentsWithNames = (recentPayments || []).map(p => ({
      ...p,
      user_name: nameMap.get(p.user_id) || 'Unknown'
    }))

    // Compute stats
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const activeMembers = memberList.filter(m => m.is_active).length

    // At risk: overdue + due soon
    const atRiskCount = memberList.filter(m => {
      if (!m.next_payment_due_date) return false
      const dueDate = new Date(m.next_payment_due_date)
      if (m.is_active && dueDate < sevenDaysFromNow) return true // overdue or due soon
      return false
    }).length

    // Recently lapsed: inactive within last 30 days
    const recentlyLapsedCount = memberList.filter(m =>
      !m.is_active && m.inactive_since && new Date(m.inactive_since) > thirtyDaysAgo
    ).length

    // Revenue this month: sum of completed payments this month
    const revenueThisMonth = (recentPayments || [])
      .filter(p => p.status === 'completed' && new Date(p.created_at) >= startOfMonth)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    return NextResponse.json({
      members: memberList,
      recentPayments: recentPaymentsWithNames,
      stats: {
        totalMembers: memberList.length,
        activeMembers,
        atRiskCount,
        recentlyLapsedCount,
        revenueThisMonth
      }
    })
  } catch (error) {
    console.error('Error fetching member payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to this file

- [ ] **Step 4: Commit**

```bash
git add app/api/team/member-payments/route.ts
git commit -m "feat: add /api/team/member-payments endpoint

Serves downline member payment data with at-risk stats, activity feed,
and per-member payment history with downline authorization check."
```

---

### Task 2: Create the MemberInsights component

**Files:**
- Create: `components/team/member-insights.tsx`

- [ ] **Step 1: Create the component file**

Create `components/team/member-insights.tsx` with the full implementation. This is a large component, so here is the complete code:

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
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
import {
  Users,
  AlertCircle,
  XCircle,
  DollarSign,
  CheckCircle,
  Search,
  ChevronRight,
  ChevronLeft,
  Clock,
  CalendarDays,
  CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { staggerContainer, staggerItem } from "@/lib/motion"

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

interface AtRiskMember extends MemberData {
  riskCategory: "overdue" | "due_soon" | "lapsed"
  riskLabel: string
  sortPriority: number
}

function formatPaymentType(type: string): string {
  switch (type) {
    case "initial_unlock": return "Initial Unlock"
    case "monthly": return "Monthly"
    case "weekly": return "Weekly"
    case "monthly_subscription": return "Monthly"
    case "weekly_subscription": return "Weekly"
    default: return type
  }
}

function getRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getDaysUntil(dateStr: string): number {
  const now = new Date()
  const date = new Date(dateStr)
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function classifyAtRisk(members: MemberData[]): AtRiskMember[] {
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const result: AtRiskMember[] = []

  for (const m of members) {
    // Overdue: active but payment date has passed
    if (m.is_active && m.next_payment_due_date) {
      const dueDate = new Date(m.next_payment_due_date)
      if (dueDate < now) {
        const daysOverdue = Math.abs(getDaysUntil(m.next_payment_due_date))
        result.push({
          ...m,
          riskCategory: "overdue",
          riskLabel: `Overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`,
          sortPriority: 1,
        })
        continue
      }
      // Due soon: within 7 days
      if (dueDate <= sevenDaysFromNow) {
        const daysLeft = getDaysUntil(m.next_payment_due_date)
        result.push({
          ...m,
          riskCategory: "due_soon",
          riskLabel: `Due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
          sortPriority: 2,
        })
        continue
      }
    }

    // Recently lapsed: inactive within last 30 days
    if (!m.is_active && m.inactive_since && new Date(m.inactive_since) > thirtyDaysAgo) {
      const daysAgo = Math.abs(getDaysUntil(m.inactive_since))
      result.push({
        ...m,
        riskCategory: "lapsed",
        riskLabel: `Lapsed ${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`,
        sortPriority: 3,
      })
    }
  }

  // Sort by priority then by urgency within each category
  return result.sort((a, b) => {
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority
    if (a.riskCategory === "overdue") {
      return new Date(a.next_payment_due_date!).getTime() - new Date(b.next_payment_due_date!).getTime()
    }
    if (a.riskCategory === "due_soon") {
      return new Date(a.next_payment_due_date!).getTime() - new Date(b.next_payment_due_date!).getTime()
    }
    // Lapsed: most recent first
    return new Date(b.inactive_since!).getTime() - new Date(a.inactive_since!).getTime()
  })
}

type SortKey = "name" | "is_active" | "last_payment_date" | "next_payment_due_date" | "payment_schedule" | "created_at"

export function MemberInsights({ userId }: { userId: string }) {
  const [members, setMembers] = useState<MemberData[]>([])
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([])
  const [stats, setStats] = useState<InsightsStats>({
    totalMembers: 0, activeMembers: 0, atRiskCount: 0, recentlyLapsedCount: 0, revenueThisMonth: 0
  })
  const [loading, setLoading] = useState(true)

  // All Members tab state
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  // Member detail dialog state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<MemberData | null>(null)
  const [memberPayments, setMemberPayments] = useState<PaymentRecord[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/member-payments?userId=${userId}`)
      const data = await res.json()
      if (data.members) setMembers(data.members)
      if (data.recentPayments) setRecentPayments(data.recentPayments)
      if (data.stats) setStats(data.stats)
    } catch (err) {
      console.error("Failed to fetch member insights:", err)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData])

  const openMemberDetail = useCallback(async (memberId: string) => {
    setSelectedMemberId(memberId)
    setLoadingDetail(true)
    // Find the member locally first
    const local = members.find(m => m.id === memberId)
    setSelectedMember(local || null)

    try {
      const res = await fetch(`/api/team/member-payments?userId=${userId}&memberId=${memberId}`)
      const data = await res.json()
      if (data.member) setSelectedMember(data.member)
      if (data.payments) setMemberPayments(data.payments)
    } catch (err) {
      console.error("Failed to fetch member detail:", err)
    }
    setLoadingDetail(false)
  }, [userId, members])

  // At risk members
  const atRiskMembers = classifyAtRisk(members)

  // Filtered and sorted members for All Members tab
  const filteredMembers = members
    .filter(m => {
      if (search) {
        const q = search.toLowerCase()
        if (!m.name?.toLowerCase().includes(q) && !m.email?.toLowerCase().includes(q)) return false
      }
      if (statusFilter === "active" && !m.is_active) return false
      if (statusFilter === "inactive" && m.is_active) return false
      return true
    })
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === "boolean") return (av === bv ? 0 : av ? -1 : 1) * dir
      if (typeof av === "string") return av.localeCompare(String(bv)) * dir
      return 0
    })

  const totalPages = Math.ceil(filteredMembers.length / PAGE_SIZE)
  const pagedMembers = filteredMembers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
    setPage(0)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading member insights...</div>
        </CardContent>
      </Card>
    )
  }

  if (stats.totalMembers === 0) {
    return null // Don't render if no downline
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Summary Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={staggerItem}>
          <Card className="relative overflow-hidden">
            <Users className="absolute top-3 right-3 h-8 w-8 text-primary/10" />
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Active Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.activeMembers} <span className="text-base font-normal text-muted-foreground">/ {stats.totalMembers}</span></div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="relative overflow-hidden border-amber-500/30">
            <AlertCircle className="absolute top-3 right-3 h-8 w-8 text-amber-500/10" />
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">At Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{stats.atRiskCount}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="relative overflow-hidden border-red-500/30">
            <XCircle className="absolute top-3 right-3 h-8 w-8 text-red-500/10" />
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Recently Lapsed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.recentlyLapsedCount}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="relative overflow-hidden border-[#D4A853]/30">
            <DollarSign className="absolute top-3 right-3 h-8 w-8 text-[#D4A853]/10" />
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Revenue This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#D4A853]">${stats.revenueThisMonth.toLocaleString()}</div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Tabbed Content */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="at-risk">
            <TabsList className="mb-4">
              <TabsTrigger value="at-risk">
                At Risk {stats.atRiskCount + stats.recentlyLapsedCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs">{stats.atRiskCount + stats.recentlyLapsedCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all-members">All Members</TabsTrigger>
              <TabsTrigger value="activity">Activity Feed</TabsTrigger>
            </TabsList>

            {/* At Risk Tab */}
            <TabsContent value="at-risk">
              {atRiskMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle className="h-10 w-10 mb-3 text-primary" />
                  <p className="text-sm font-medium">All members are in good standing</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {atRiskMembers.map(m => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group"
                      onClick={() => openMemberDetail(m.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                          m.riskCategory === "overdue" ? "bg-red-500/10 text-red-500" :
                          m.riskCategory === "due_soon" ? "bg-amber-500/10 text-amber-500" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {m.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{m.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Last paid: {m.last_payment_date ? new Date(m.last_payment_date).toLocaleDateString() : "Never"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          m.riskCategory === "overdue" ? "destructive" :
                          m.riskCategory === "due_soon" ? "warning" :
                          "secondary"
                        }>
                          {m.riskLabel}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {m.payment_schedule === "weekly" ? "Weekly" : "Monthly"}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* All Members Tab */}
            <TabsContent value="all-members">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0) }}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0) }}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-6 gap-2 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold border-b">
                <button className="text-left" onClick={() => handleSort("name")}>Name {sortKey === "name" && (sortAsc ? "↑" : "↓")}</button>
                <button className="text-left" onClick={() => handleSort("is_active")}>Status {sortKey === "is_active" && (sortAsc ? "↑" : "↓")}</button>
                <button className="text-left" onClick={() => handleSort("last_payment_date")}>Last Paid {sortKey === "last_payment_date" && (sortAsc ? "↑" : "↓")}</button>
                <button className="text-left" onClick={() => handleSort("next_payment_due_date")}>Next Due {sortKey === "next_payment_due_date" && (sortAsc ? "↑" : "↓")}</button>
                <button className="text-left" onClick={() => handleSort("payment_schedule")}>Schedule {sortKey === "payment_schedule" && (sortAsc ? "↑" : "↓")}</button>
                <button className="text-left" onClick={() => handleSort("created_at")}>Joined {sortKey === "created_at" && (sortAsc ? "↑" : "↓")}</button>
              </div>

              {/* Table rows */}
              <div className="divide-y">
                {pagedMembers.map(m => (
                  <div
                    key={m.id}
                    className="grid grid-cols-6 gap-2 px-3 py-3 hover:bg-accent/50 cursor-pointer transition-colors text-sm"
                    onClick={() => openMemberDetail(m.id)}
                  >
                    <div className="truncate font-medium">{m.name}</div>
                    <div>
                      <Badge variant={m.is_active ? "success" : "secondary"} className="text-xs">
                        {m.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">{m.last_payment_date ? new Date(m.last_payment_date).toLocaleDateString() : "—"}</div>
                    <div className="text-muted-foreground">{m.next_payment_due_date ? new Date(m.next_payment_due_date).toLocaleDateString() : "—"}</div>
                    <div><Badge variant="outline" className="text-xs">{m.payment_schedule === "weekly" ? "Weekly" : "Monthly"}</Badge></div>
                    <div className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredMembers.length)} of {filteredMembers.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {filteredMembers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-8 w-8 mb-2" />
                  <p className="text-sm">No members match your search</p>
                </div>
              )}
            </TabsContent>

            {/* Activity Feed Tab */}
            <TabsContent value="activity">
              {recentPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-8 w-8 mb-2" />
                  <p className="text-sm">No recent payment activity</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-1">
                    {recentPayments.map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/30 transition-colors">
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${p.status === "completed" ? "bg-emerald-500" : "bg-red-500"}`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm">
                            <span className="font-medium">{p.user_name}</span>
                            {p.status === "completed" ? " paid " : " failed "}
                            <span className="font-semibold">${Number(p.amount).toLocaleString()}</span>
                            {" — "}
                            <span className="text-muted-foreground">{formatPaymentType(p.payment_type)}</span>
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{getRelativeTime(p.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Member Payment Detail Dialog */}
      <Dialog open={!!selectedMemberId} onOpenChange={open => { if (!open) { setSelectedMemberId(null); setMemberPayments([]) } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {selectedMember?.name} — Payment Details
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              {/* Status Overview */}
              <div className="p-4 rounded-lg bg-surface-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Status</span>
                  <Badge variant={selectedMember.is_active ? "success" : "secondary"}>
                    {selectedMember.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">{selectedMember.email}</div>
              </div>

              {/* Payment Status */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> Payment Status
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-surface-2">
                    <div className="text-xs text-muted-foreground">Next Payment Due</div>
                    {selectedMember.next_payment_due_date ? (
                      <>
                        <div className="text-lg font-bold mt-1">
                          {new Date(selectedMember.next_payment_due_date).toLocaleDateString()}
                        </div>
                        <div className={`text-xs mt-0.5 ${
                          getDaysUntil(selectedMember.next_payment_due_date) < 0 ? "text-red-500 font-semibold" :
                          getDaysUntil(selectedMember.next_payment_due_date) <= 7 ? "text-amber-500" :
                          "text-muted-foreground"
                        }`}>
                          {getDaysUntil(selectedMember.next_payment_due_date) < 0
                            ? `Overdue by ${Math.abs(getDaysUntil(selectedMember.next_payment_due_date))} days`
                            : `In ${getDaysUntil(selectedMember.next_payment_due_date)} days`}
                        </div>
                      </>
                    ) : (
                      <div className="text-lg font-bold mt-1 text-muted-foreground">—</div>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-surface-2">
                    <div className="text-xs text-muted-foreground">Payment Schedule</div>
                    <div className="text-lg font-bold mt-1">
                      <Badge variant="outline">{selectedMember.payment_schedule === "weekly" ? "Weekly" : "Monthly"}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Member since {selectedMember.initial_payment_date
                        ? new Date(selectedMember.initial_payment_date).toLocaleDateString()
                        : new Date(selectedMember.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Payment History
                </h4>
                {loadingDetail ? (
                  <div className="text-sm text-muted-foreground text-center py-6">Loading payments...</div>
                ) : memberPayments.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">No payment records found</div>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {memberPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2">
                          <div>
                            <div className="text-sm font-medium">${Number(p.amount).toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(p.created_at).toLocaleDateString()} at {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{formatPaymentType(p.payment_type)}</Badge>
                            <Badge variant={
                              p.status === "completed" ? "success" :
                              p.status === "failed" ? "destructive" :
                              "warning"
                            } className="text-xs">
                              {p.status === "completed" ? "Completed" : p.status === "failed" ? "Failed" : "Pending"}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to this file

- [ ] **Step 3: Commit**

```bash
git add components/team/member-insights.tsx
git commit -m "feat: add MemberInsights component

Summary cards (active, at-risk, lapsed, revenue), tabbed content
(At Risk, All Members with pagination/sort/search, Activity Feed),
and per-member payment history dialog."
```

---

### Task 3: Integrate MemberInsights into the Team page

**Files:**
- Modify: `app/(dashboard)/team/page.tsx`

- [ ] **Step 1: Add the import**

At the top of `app/(dashboard)/team/page.tsx`, after the existing imports (around line 11, after the `StructureDropdown` import), add:

```typescript
import { MemberInsights } from "@/components/team/member-insights"
```

- [ ] **Step 2: Render the component**

In the JSX, after the closing `</Dialog>` tag of the member detail dialog (line 610) and before the `{/* Current Structure + Structure Overview side by side */}` comment (line 612), insert:

```tsx
      {/* Member Insights Section */}
      {userId && <MemberInsights userId={userId} />}
```

The insertion point is between the `</Dialog>` closing tag and the `{/* Current Structure + Structure Overview side by side */}` comment.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/team/page.tsx
git commit -m "feat: integrate MemberInsights into My Team page

Renders below direct referrals and above structure cards."
```

---

### Task 4: Verify end-to-end

- [ ] **Step 1: Run the dev server and verify**

Run: `npm run dev`

Test manually:
1. Navigate to the My Team page as a user with downline members
2. Verify the 4 summary cards render with correct counts
3. Click "At Risk" tab — verify overdue/due-soon/lapsed members appear sorted by urgency
4. Click "All Members" tab — verify search, filter, sort, and pagination work
5. Click "Activity Feed" tab — verify recent payments show with correct names and amounts
6. Click any member row — verify the payment detail dialog opens with payment history

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean output, no errors

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address any issues found during verification"
```
