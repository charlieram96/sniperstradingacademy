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
import { Gift, AlertCircle, CheckCircle, Loader2, RefreshCw, DollarSign, Users, Clock, ExternalLink, Wallet } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface InitialPayment {
  id: string
  amount: number
  createdAt: string
  payer: {
    id: string
    name: string
    email: string
  }
  referrer: {
    id: string
    name: string
    email: string
    hasWallet: boolean
  } | null
  bonus: {
    id: string
    status: string
    amount: number
    paidAt: string | null
  } | null
}

interface Summary {
  totalPayments: number
  paymentsWithReferrers: number
  pendingBonuses: number
  paidBonuses: number
  noBonusYet: number
}

export default function DirectBonusesPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<InitialPayment[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalPayments: 0,
    paymentsWithReferrers: 0,
    pendingBonuses: 0,
    paidBonuses: 0,
    noBonusYet: 0
  })
  const [filter, setFilter] = useState<string>("all")
  const [processing, setProcessing] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [creatingBonusFor, setCreatingBonusFor] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<InitialPayment | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/direct-bonuses")
      const data = await response.json()

      if (response.ok && data.success) {
        setPayments(data.payments)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error("Error fetching direct bonuses data:", error)
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

  const handleCreateBonus = async (payment: InitialPayment) => {
    if (!payment.referrer) return

    setCreatingBonusFor(payment.id)
    try {
      const response = await fetch("/api/admin/direct-bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          referrerId: payment.referrer.id,
          referredId: payment.payer.id,
          amount: 249
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`Bonus created successfully! Commission ID: ${data.commission.id}`)
        await fetchData()
      } else {
        alert(`Failed to create bonus: ${data.error}`)
      }
    } catch (error) {
      alert("Error creating bonus")
      console.error(error)
    } finally {
      setCreatingBonusFor(null)
    }
  }

  const handleProcessBonus = async (commissionId: string) => {
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
        await fetchData()
      } else {
        alert(`Failed: ${data.error || "Unknown error"}`)
      }
    } catch (error) {
      alert("Error processing payout")
      console.error(error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleMarkComplete = async (commissionId: string) => {
    if (!confirm("Mark this bonus as completed? Use this only if payment was made outside the platform (check, cash, wire, etc.).")) {
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
        alert("Bonus marked as completed!")
        await fetchData()
      } else {
        alert(`Failed: ${data.error || "Unknown error"}`)
      }
    } catch (error) {
      alert("Error marking as complete")
      console.error(error)
    } finally {
      setProcessingId(null)
    }
  }

  const filteredPayments = payments.filter(p => {
    if (filter === "all") return true
    if (filter === "with_referrer") return p.referrer !== null
    if (filter === "pending_bonus") return p.bonus?.status === "pending"
    if (filter === "no_bonus") return p.referrer && !p.bonus
    if (filter === "paid") return p.bonus?.status === "paid"
    return true
  })

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
          <Gift className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Direct Bonus Management</h1>
        </div>
        <p className="text-muted-foreground">
          Track $499 initial payments and manage $249 referral bonuses
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total $499 Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{summary.totalPayments}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 90 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">With Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">{summary.paymentsWithReferrers}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Eligible for bonus</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Bonuses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="text-2xl font-bold text-amber-600">{summary.pendingBonuses}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid Bonuses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{summary.paidBonuses}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>

        <Card className={summary.noBonusYet > 0 ? "border-amber-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">No Bonus Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className={`h-5 w-5 ${summary.noBonusYet > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
              <span className={`text-2xl font-bold ${summary.noBonusYet > 0 ? "text-amber-600" : ""}`}>
                {summary.noBonusYet}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Needs action</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Filter payments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments ({payments.length})</SelectItem>
                  <SelectItem value="with_referrer">With Referrer ({summary.paymentsWithReferrers})</SelectItem>
                  <SelectItem value="pending_bonus">Pending Bonus ({summary.pendingBonuses})</SelectItem>
                  <SelectItem value="no_bonus">No Bonus Yet ({summary.noBonusYet})</SelectItem>
                  <SelectItem value="paid">Paid ({summary.paidBonuses})</SelectItem>
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
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>$499 Initial Payments</CardTitle>
          <CardDescription>View payments and manage associated referral bonuses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Bonus Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No payments match your filter
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">${payment.amount}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(payment.createdAt), { addSuffix: true })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(payment.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payment.payer.name}</p>
                          <p className="text-sm text-muted-foreground">{payment.payer.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.referrer ? (
                          <div>
                            <p className="font-medium">{payment.referrer.name}</p>
                            <p className="text-sm text-muted-foreground">{payment.referrer.email}</p>
                            {!payment.referrer.hasWallet && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-600 mt-1">
                                <Wallet className="h-3 w-3 mr-1" />
                                No wallet
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">No referrer</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!payment.referrer ? (
                          <Badge variant="secondary">N/A</Badge>
                        ) : !payment.bonus ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Not created
                          </Badge>
                        ) : payment.bonus.status === "pending" ? (
                          <div>
                            <Badge variant="outline" className="text-amber-600 border-amber-600">
                              Pending
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              ${payment.bonus.amount} to pay
                            </p>
                          </div>
                        ) : payment.bonus.status === "paid" ? (
                          <div>
                            <Badge className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Paid
                            </Badge>
                            {payment.bonus.paidAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(payment.bonus.paidAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary">{payment.bonus.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!payment.referrer ? (
                          <span className="text-muted-foreground text-sm">-</span>
                        ) : !payment.bonus ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateBonus(payment)}
                            disabled={creatingBonusFor === payment.id}
                          >
                            {creatingBonusFor === payment.id ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <Gift className="h-3 w-3 mr-1" />
                                Create $249 Bonus
                              </>
                            )}
                          </Button>
                        ) : payment.bonus.status === "pending" ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleProcessBonus(payment.bonus!.id)}
                              disabled={processingId === payment.bonus.id || !payment.referrer?.hasWallet}
                              title={!payment.referrer?.hasWallet ? "Referrer has no payout wallet" : ""}
                            >
                              {processingId === payment.bonus.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Paying...
                                </>
                              ) : (
                                <>
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  Pay $249
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleMarkComplete(payment.bonus!.id)}
                              disabled={processingId === payment.bonus.id}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Mark Paid
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

      {/* Info Box */}
      <Card className="mt-6 border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How Direct Bonuses Work</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>When a new user pays $499, a $249 bonus is automatically created for their referrer</li>
                <li>If no bonus was created (rare), you can manually create one using the "Create $249 Bonus" button</li>
                <li>Click "Pay $249" to process the USDC transfer to the referrer's wallet</li>
                <li>Use "Mark Paid" only if the bonus was paid outside the system (cash, wire, etc.)</li>
                <li>Referrers need a payout wallet configured to receive USDC payments</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
