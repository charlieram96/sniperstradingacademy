"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Network, Search, Shield, ShieldCheck, Users, CheckCircle2, XCircle, AlertTriangle, Crown, Sparkles, Trash2, UserPlus, Loader2, Power, DollarSign, CreditCard, Copy, UserCheck } from "lucide-react"
import QRCode from "qrcode"
import { formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/language-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface NetworkUser {
  id: string
  name: string | null
  email: string
  role: "member" | "admin" | "superadmin"
  is_active: boolean
  initial_payment_completed: boolean
  active_direct_referrals_count: number
  direct_referrals_count: number
  total_network_count: number
  active_network_count: number
  current_commission_rate: number
  sniper_volume_current_month: number
  monthly_commission: number // Calculated: sniper_volume_current_month × current_commission_rate
  created_at: string
  last_payment_date: string | null
  payment_schedule: "weekly" | "monthly"
  referral_code: string | null
  premium_bypass: boolean
  bypass_direct_referrals: number // Changed from boolean to number (0-18)
  bypass_subscription: boolean
  bypass_initial_payment: boolean
  referred_by: string | null
  referrer: Array<{
    name: string | null
    network_position_id: string | null
  }> | null
  payout_wallet_address: string | null
}

type SortField = "name" | "email" | "created_at" | "total_network_count" | "monthly_commission" | "active_direct_referrals_count"
type SortDirection = "asc" | "desc"

export default function AdminNetworkPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<NetworkUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<NetworkUser[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "member" | "admin" | "superadmin">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [selectedUser, setSelectedUser] = useState<NetworkUser | null>(null)
  const [showUserDetailDialog, setShowUserDetailDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [userToToggle, setUserToToggle] = useState<{ id: string; name: string; currentRole: "member" | "admin" | "superadmin" } | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showBypassDialog, setShowBypassDialog] = useState(false)
  const [userForBypass, setUserForBypass] = useState<{
    id: string;
    name: string;
    currentBypasses: {
      directReferralsCount: number;
      subscription: boolean;
      initialPayment: boolean;
    };
    initialPaymentCompleted: boolean;
  } | null>(null)
  const [bypassSelections, setBypassSelections] = useState({
    directReferralsCount: 0,
    subscription: false,
    initialPayment: false
  })
  const [orphanedUsers, setOrphanedUsers] = useState<Array<{
    id: string
    email: string
    name: string | null
    created_at: string
    referred_by: string | null
    provider: string
  }>>([])
  const [loadingOrphaned, setLoadingOrphaned] = useState(true)
  const [showFixDialog, setShowFixDialog] = useState(false)
  const [showDeleteAuthDialog, setShowDeleteAuthDialog] = useState(false)
  const [orphanedUserToFix, setOrphanedUserToFix] = useState<{
    id: string
    email: string
    name: string | null
    referred_by: string | null
  } | null>(null)
  const [orphanedUserToDelete, setOrphanedUserToDelete] = useState<{
    id: string
    email: string
    name: string | null
  } | null>(null)
  const [emailConfirmation, setEmailConfirmation] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // New action states
  const [showManualPayoutDialog, setShowManualPayoutDialog] = useState(false)
  const [userForPayout, setUserForPayout] = useState<NetworkUser | null>(null)
  const [payoutAmount, setPayoutAmount] = useState("")

  const [showDeletionRequestDialog, setShowDeletionRequestDialog] = useState(false)
  const [userForDeletion, setUserForDeletion] = useState<NetworkUser | null>(null)

  const [pendingDeletions, setPendingDeletions] = useState<Array<{
    id: string
    user_id: string
    user_email: string
    user_name: string | null
    requested_at: string
    requested_by: string
    requester: { name: string | null; email: string } | null
  }>>([])
  const [pendingDeletionsCount, setPendingDeletionsCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [userForPayment, setUserForPayment] = useState<NetworkUser | null>(null)
  const [paymentType, setPaymentType] = useState<"weekly" | "monthly" | "initial">("weekly")
  const [paymentAddress, setPaymentAddress] = useState<string | null>(null)
  const [paymentQrCode, setPaymentQrCode] = useState<string | null>(null)
  const [expectedPaymentAmount, setExpectedPaymentAmount] = useState(0)
  const [loadingPaymentAddress, setLoadingPaymentAddress] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)

  const filterAndSortUsers = useCallback(() => {
    let result = [...users]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (user) =>
          user.name?.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      )
    }

    // Role filter
    if (roleFilter !== "all") {
      result = result.filter((user) => user.role === roleFilter)
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((user) =>
        statusFilter === "active" ? user.is_active : !user.is_active
      )
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number = a[sortField] || ""
      let bVal: string | number = b[sortField] || ""

      if (sortField === "name") {
        aVal = a.name || a.email
        bVal = b.name || b.email
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })

    setFilteredUsers(result)
  }, [users, searchQuery, roleFilter, statusFilter, sortField, sortDirection])

  useEffect(() => {
    checkAdminStatus()
    fetchAllUsers()
    fetchOrphanedUsers()
    fetchPendingDeletions()
  }, [])

  useEffect(() => {
    filterAndSortUsers()
  }, [filterAndSortUsers])

  async function checkAdminStatus() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      setCurrentUserId(user.id)
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      setIsAdmin(userData?.role === "admin" || userData?.role === "superadmin" || userData?.role === "superadmin+")
      setIsSuperAdmin(userData?.role === "superadmin" || userData?.role === "superadmin+")
    }
  }

  async function fetchAllUsers() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        name,
        email,
        role,
        is_active,
        initial_payment_completed,
        active_direct_referrals_count,
        direct_referrals_count,
        total_network_count,
        active_network_count,
        current_commission_rate,
        sniper_volume_current_month,
        created_at,
        last_payment_date,
        payment_schedule,
        referral_code,
        premium_bypass,
        bypass_direct_referrals,
        bypass_subscription,
        bypass_initial_payment,
        referred_by,
        payout_wallet_address,
        referrer:users!referred_by(name, network_position_id)
      `)
      .order("created_at", { ascending: false })

    if (!error && data) {
      // Calculate monthly_commission dynamically
      const usersWithCommission = data.map(user => ({
        ...user,
        monthly_commission: parseFloat(user.sniper_volume_current_month || 0) * parseFloat(user.current_commission_rate || 0)
      }))
      setUsers(usersWithCommission)
    }
    setLoading(false)
  }

  async function fetchOrphanedUsers() {
    try {
      const response = await fetch("/api/admin/users/orphaned")
      if (response.ok) {
        const data = await response.json()
        setOrphanedUsers(data.orphanedUsers || [])
      }
    } catch (error) {
      console.error("Error fetching orphaned users:", error)
    } finally {
      setLoadingOrphaned(false)
    }
  }

  function openFixDialog(user: { id: string; email: string; name: string | null; referred_by: string | null }) {
    setOrphanedUserToFix(user)
    setShowFixDialog(true)
  }

  function openDeleteAuthDialog(user: { id: string; email: string; name: string | null }) {
    setOrphanedUserToDelete(user)
    setEmailConfirmation("")
    setShowDeleteAuthDialog(true)
  }

  async function handleFixOrphanedUser() {
    if (!orphanedUserToFix) return

    setIsProcessing(true)
    try {
      const response = await fetch("/api/admin/users/fix-orphaned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: orphanedUserToFix.id,
          referred_by: orphanedUserToFix.referred_by
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(`Failed to fix user: ${errorData.error || 'Unknown error'}`)
        setIsProcessing(false)
        return
      }

      await fetchOrphanedUsers()
      await fetchAllUsers()
      setShowFixDialog(false)
      setOrphanedUserToFix(null)
      alert("User fixed successfully!")
    } catch (error) {
      console.error("Error fixing user:", error)
      alert("Failed to fix user. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleDeleteAuthUser() {
    if (!orphanedUserToDelete || emailConfirmation !== orphanedUserToDelete.email) {
      alert("Email confirmation does not match")
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch("/api/admin/users/delete-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: orphanedUserToDelete.id,
          email_confirmation: emailConfirmation
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(`Failed to delete user: ${errorData.error || 'Unknown error'}`)
        setIsProcessing(false)
        return
      }

      await fetchOrphanedUsers()
      setShowDeleteAuthDialog(false)
      setOrphanedUserToDelete(null)
      setEmailConfirmation("")
      alert("User deleted successfully from auth.users!")
    } catch (error) {
      console.error("Error deleting user:", error)
      alert("Failed to delete user. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  function openConfirmDialog(userId: string, userName: string, currentRole: "member" | "admin" | "superadmin") {
    setUserToToggle({ id: userId, name: userName, currentRole })
    setShowConfirmDialog(true)
  }

  function openBypassDialog(user: NetworkUser) {
    setUserForBypass({
      id: user.id,
      name: user.name || user.email,
      currentBypasses: {
        directReferralsCount: user.bypass_direct_referrals,
        subscription: user.bypass_subscription,
        initialPayment: user.bypass_initial_payment
      },
      initialPaymentCompleted: user.initial_payment_completed
    })
    // Initialize states with current values
    setBypassSelections({
      directReferralsCount: user.bypass_direct_referrals,
      subscription: user.bypass_subscription,
      initialPayment: user.bypass_initial_payment
    })
    setShowBypassDialog(true)
  }

  async function confirmToggleAdminRole() {
    if (!userToToggle) return

    setIsUpdating(true)
    const newRole = userToToggle.currentRole === "admin" ? "member" : "admin"

    const supabase = createClient()
    const { error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", userToToggle.id)

    if (error) {
      console.error("Error updating user role:", error)
      setIsUpdating(false)
      return
    }

    // Refresh user list
    await fetchAllUsers()

    // Update selected user if it's the one we just modified
    if (selectedUser?.id === userToToggle.id) {
      setSelectedUser({ ...selectedUser, role: newRole })
    }

    setIsUpdating(false)
    setShowConfirmDialog(false)
    setUserToToggle(null)
  }

  async function confirmUpdateBypass() {
    if (!userForBypass) return

    setIsUpdating(true)

    try {
      // Call bypass grant API endpoint
      const response = await fetch("/api/admin/bypass/grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userForBypass.id,
          bypassDirectReferralsCount: bypassSelections.directReferralsCount,
          bypassSubscription: bypassSelections.subscription,
          bypassInitialPayment: bypassSelections.initialPayment
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Error granting bypass access:", errorData)
        alert(`Failed to grant bypass: ${errorData.error || 'Unknown error'}`)
        setIsUpdating(false)
        return
      }

      const result = await response.json()
      console.log("Bypass grant result:", result)

      // Show success message with process log
      if (result.processLog && result.processLog.length > 0) {
        console.log("Process log:", result.processLog.join("\n"))
      }

      // Refresh user list
      await fetchAllUsers()

      // Update selected user if it's the one we just modified
      if (selectedUser?.id === userForBypass.id) {
        setSelectedUser({
          ...selectedUser,
          bypass_direct_referrals: bypassSelections.directReferralsCount,
          bypass_subscription: bypassSelections.subscription,
          bypass_initial_payment: bypassSelections.initialPayment
        })
      }

      setIsUpdating(false)
      setShowBypassDialog(false)
      setUserForBypass(null)
    } catch (error) {
      console.error("Exception granting bypass:", error)
      alert("Failed to grant bypass access. Please try again.")
      setIsUpdating(false)
    }
  }

  // Toggle user active/inactive
  async function handleToggleActive(user: NetworkUser) {
    setIsProcessing(true)
    try {
      const response = await fetch("/api/admin/users/toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          isActive: !user.is_active
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(`Failed to toggle status: ${errorData.error || 'Unknown error'}`)
        return
      }

      await fetchAllUsers()
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, is_active: !user.is_active })
      }
    } catch (error) {
      console.error("Error toggling user status:", error)
      alert("Failed to toggle user status. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Manual payout functions
  function openManualPayoutDialog(user: NetworkUser) {
    setUserForPayout(user)
    setPayoutAmount("")
    setShowManualPayoutDialog(true)
  }

  async function handleManualPayout() {
    if (!userForPayout || !payoutAmount) return

    const amount = parseFloat(payoutAmount)
    if (isNaN(amount) || amount <= 0 || amount > 2000) {
      alert("Amount must be between 0.01 and 2,000 USDC")
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch("/api/admin/payouts/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userForPayout.id,
          amount,
          description: `Manual payout for ${userForPayout.name || userForPayout.email}`
        })
      })

      const data = await response.json()
      if (!response.ok) {
        alert(`Failed to create payout: ${data.error || 'Unknown error'}`)
        return
      }

      alert(`Payout of ${amount.toFixed(2)} USDC sent successfully!`)
      setShowManualPayoutDialog(false)
      setUserForPayout(null)
    } catch (error) {
      console.error("Error creating manual payout:", error)
      alert("Failed to create payout. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Deletion request functions
  async function fetchPendingDeletions() {
    try {
      const response = await fetch("/api/admin/users/deletion-requests?status=pending")
      if (response.ok) {
        const data = await response.json()
        setPendingDeletions(data.requests || [])
        setPendingDeletionsCount(data.pendingCount || 0)
      }
    } catch (error) {
      console.error("Error fetching pending deletions:", error)
    }
  }

  function openDeletionRequestDialog(user: NetworkUser) {
    setUserForDeletion(user)
    setShowDeletionRequestDialog(true)
  }

  async function handleRequestDeletion() {
    if (!userForDeletion) return

    setIsProcessing(true)
    try {
      const response = await fetch("/api/admin/users/request-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userForDeletion.id })
      })

      const data = await response.json()
      if (!response.ok) {
        alert(`Failed to request deletion: ${data.error || 'Unknown error'}`)
        return
      }

      alert("Deletion request submitted. Another superadmin must approve it.")
      setShowDeletionRequestDialog(false)
      setUserForDeletion(null)
      await fetchPendingDeletions()
    } catch (error) {
      console.error("Error requesting deletion:", error)
      alert("Failed to request deletion. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleApproveDeletion(requestId: string) {
    if (!confirm("Are you sure you want to approve this deletion? This action is permanent.")) return

    setIsProcessing(true)
    try {
      const response = await fetch("/api/admin/users/approve-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId })
      })

      const data = await response.json()
      if (!response.ok) {
        alert(`Failed to approve deletion: ${data.error || 'Unknown error'}`)
        return
      }

      alert(`User ${data.deletedUserEmail} has been permanently deleted.`)
      await fetchPendingDeletions()
      await fetchAllUsers()
    } catch (error) {
      console.error("Error approving deletion:", error)
      alert("Failed to approve deletion. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleRejectDeletion(requestId: string) {
    const reason = prompt("Enter rejection reason (optional):")

    setIsProcessing(true)
    try {
      const response = await fetch("/api/admin/users/reject-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, reason })
      })

      if (!response.ok) {
        const data = await response.json()
        alert(`Failed to reject deletion: ${data.error || 'Unknown error'}`)
        return
      }

      alert("Deletion request rejected.")
      await fetchPendingDeletions()
    } catch (error) {
      console.error("Error rejecting deletion:", error)
      alert("Failed to reject deletion. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Payment on behalf functions
  async function openPaymentDialog(user: NetworkUser) {
    setUserForPayment(user)
    setPaymentAddress(null)
    setPaymentQrCode(null)
    setPaymentType(user.initial_payment_completed ? "weekly" : "initial")
    setShowPaymentDialog(true)
    await fetchPaymentAddress(user.id, user.initial_payment_completed ? "weekly" : "initial")
  }

  async function fetchPaymentAddress(userId: string, type: "weekly" | "monthly" | "initial") {
    setLoadingPaymentAddress(true)
    try {
      const response = await fetch("/api/admin/users/payment-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, paymentType: type })
      })

      const data = await response.json()
      if (!response.ok) {
        alert(`Failed to get payment address: ${data.error || 'Unknown error'}`)
        return
      }

      setPaymentAddress(data.depositAddress)
      setExpectedPaymentAmount(data.remainingAmount || data.expectedAmount)

      // Generate QR code
      if (data.depositAddress) {
        const qrUrl = await QRCode.toDataURL(data.depositAddress, {
          width: 200,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' }
        })
        setPaymentQrCode(qrUrl)
      }
    } catch (error) {
      console.error("Error fetching payment address:", error)
      alert("Failed to fetch payment address. Please try again.")
    } finally {
      setLoadingPaymentAddress(false)
    }
  }

  async function handlePaymentTypeChange(type: "weekly" | "monthly" | "initial") {
    setPaymentType(type)
    if (userForPayment) {
      await fetchPaymentAddress(userForPayment.id, type)
    }
  }

  function handleCopyAddress() {
    if (paymentAddress) {
      navigator.clipboard.writeText(paymentAddress)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Network className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">{t("admin.network.title")}</h1>
        </div>
        <p className="text-muted-foreground">{t("admin.network.description")}</p>
      </div>

      {/* Pending Deletion Requests Section - Superadmin Only */}
      {isSuperAdmin && pendingDeletionsCount > 0 && (
        <Card className="mb-6 border-red-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Trash2 className="h-5 w-5" />
                  {t("admin.network.pendingDeletionRequests")}
                </CardTitle>
                <CardDescription>
                  {t("admin.network.pendingDeletionRequestsDesc")}
                </CardDescription>
              </div>
              <Badge variant="destructive">
                {pendingDeletionsCount} {t("admin.network.pending")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-sm font-semibold">{t("admin.network.user")}</th>
                    <th className="text-left p-2 text-sm font-semibold">{t("admin.network.requestedBy")}</th>
                    <th className="text-left p-2 text-sm font-semibold">{t("admin.network.requestedAt")}</th>
                    <th className="text-right p-2 text-sm font-semibold">{t("admin.network.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDeletions.map((req) => (
                    <tr key={req.id} className="border-b border-border-subtle hover:bg-surface-2">
                      <td className="p-2 text-sm">
                        <div>
                          <p className="font-medium">{req.user_name || "No name"}</p>
                          <p className="text-xs text-muted-foreground">{req.user_email}</p>
                        </div>
                      </td>
                      <td className="p-2 text-sm">
                        {req.requester?.name || req.requester?.email || t("common.unknown")}
                      </td>
                      <td className="p-2 text-sm">
                        {new Date(req.requested_at).toLocaleString()}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex gap-2 justify-end">
                          {req.requested_by !== currentUserId ? (
                            <>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleApproveDeletion(req.id)}
                                disabled={isProcessing}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {t("admin.network.approve")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectDeletion(req.id)}
                                disabled={isProcessing}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                {t("admin.network.reject")}
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("admin.network.awaitingOtherSuperadmin")}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orphaned Users Section - Superadmin Only */}
      {isSuperAdmin && (
        <Card className="mb-6 border-amber-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                  {t("admin.network.orphanedUsers")}
                </CardTitle>
                <CardDescription>
                  {t("admin.network.orphanedUsersDesc")}
                </CardDescription>
              </div>
              {!loadingOrphaned && (
                <Badge variant={orphanedUsers.length > 0 ? "destructive" : "secondary"}>
                  {orphanedUsers.length} orphaned
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingOrphaned ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : orphanedUsers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-[#D4A853]" />
                <p>{t("admin.network.noOrphanedUsers")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 text-sm font-semibold">{t("admin.network.email")}</th>
                      <th className="text-left p-2 text-sm font-semibold">{t("admin.network.name")}</th>
                      <th className="text-left p-2 text-sm font-semibold">{t("admin.network.created")}</th>
                      <th className="text-left p-2 text-sm font-semibold">{t("admin.network.provider")}</th>
                      <th className="text-right p-2 text-sm font-semibold">{t("admin.network.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphanedUsers.map((user) => (
                      <tr key={user.id} className="border-b border-border-subtle hover:bg-surface-2">
                        <td className="p-2 text-sm">{user.email}</td>
                        <td className="p-2 text-sm">{user.name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-2 text-sm">{new Date(user.created_at).toLocaleDateString()}</td>
                        <td className="p-2 text-sm">{user.provider}</td>
                        <td className="p-2 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openFixDialog({
                                id: user.id,
                                email: user.email,
                                name: user.name,
                                referred_by: user.referred_by
                              })}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              {t("admin.network.fix")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openDeleteAuthDialog({
                                id: user.id,
                                email: user.email,
                                name: user.name
                              })}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.network.totalUsers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.network.activeUsers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#D4A853]">
              {users.filter((u) => u.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.network.paidMembers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {users.filter((u) => u.initial_payment_completed).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.network.admins")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {users.filter((u) => u.role === "admin").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.network.superadmins")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {users.filter((u) => u.role === "superadmin").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("admin.network.searchByNameOrEmail")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={(value: "all" | "member" | "admin" | "superadmin") => setRoleFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.network.allRoles")}</SelectItem>
                <SelectItem value="member">{t("admin.network.membersOnly")}</SelectItem>
                <SelectItem value="admin">{t("admin.network.adminsOnly")}</SelectItem>
                <SelectItem value="superadmin">{t("admin.network.superadminsOnly")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.network.allStatus")}</SelectItem>
                <SelectItem value="active">{t("admin.network.activeOnly")}</SelectItem>
                <SelectItem value="inactive">{t("admin.network.inactiveOnly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-4 mt-4">
            <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">{t("admin.network.joinDate")}</SelectItem>
                <SelectItem value="name">{t("admin.network.name")}</SelectItem>
                <SelectItem value="email">{t("admin.network.email")}</SelectItem>
                <SelectItem value="total_network_count">{t("admin.network.teamSize")}</SelectItem>
                <SelectItem value="monthly_commission">{t("admin.network.commission")}</SelectItem>
                <SelectItem value="active_direct_referrals_count">{t("admin.network.directReferrals")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortDirection} onValueChange={(value: SortDirection) => setSortDirection(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">{t("admin.network.ascending")}</SelectItem>
                <SelectItem value="desc">{t("admin.network.descending")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.network.allUsers").replace("{count}", String(filteredUsers.length))}</CardTitle>
          <CardDescription>{t("admin.network.clickToViewDetails")}</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">{t("admin.network.noUsersMatch")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => { setSelectedUser(user); setShowUserDetailDialog(true) }}
                  className="p-4 border border-border-subtle rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{user.name || "No name"}</h3>
                        {user.role === "superadmin" && (
                          <Badge className="bg-purple-600 text-white">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Superadmin
                          </Badge>
                        )}
                        {user.role === "admin" && (
                          <Badge className="bg-primary text-white">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                        {(user.bypass_direct_referrals || user.bypass_subscription || user.bypass_initial_payment) && (
                          <>
                            {user.bypass_direct_referrals && (
                              <Badge className="bg-blue-600 text-white">
                                <Users className="h-3 w-3 mr-1" />
                                {t("admin.network.bypassReferrals")}
                              </Badge>
                            )}
                            {user.bypass_subscription && (
                              <Badge className="bg-[#D4A853] text-white">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {t("admin.network.bypassSubscription")}
                              </Badge>
                            )}
                            {user.bypass_initial_payment && (
                              <Badge className="bg-purple-600 text-white">
                                <Crown className="h-3 w-3 mr-1" />
                                {t("admin.network.bypassInitialPayment")}
                              </Badge>
                            )}
                          </>
                        )}
                        {user.is_active ? (
                          <Badge variant="success">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {t("admin.network.active")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <XCircle className="h-3 w-3 mr-1" />
                            {t("admin.network.inactive")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">{t("admin.network.directReferrals")}</p>
                          <p className="font-medium">{user.active_direct_referrals_count}/{user.direct_referrals_count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("admin.network.totalTeam")}</p>
                          <p className="font-medium">{user.total_network_count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("admin.network.activeTeam")}</p>
                          <p className="font-medium">{user.active_network_count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("admin.network.commissionRate")}</p>
                          <p className="font-medium">{(user.current_commission_rate * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("admin.network.monthlyEarnings")}</p>
                          <p className="font-medium text-primary">{formatCurrency(user.monthly_commission)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("admin.network.referredBy")}</p>
                          <p className="font-medium truncate">
                            {user.referrer && user.referrer.length > 0 ? (
                              user.referrer[0].name || t("common.unknown")
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={showUserDetailDialog} onOpenChange={setShowUserDetailDialog}>
        <DialogContent className="max-w-lg">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  {t("admin.network.userDetails").replace("{name}", selectedUser.name || t("common.noName"))}
                </DialogTitle>
                <DialogDescription>{t("admin.network.viewStatsAndManage")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                {/* User Info */}
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedUser.is_active ? (
                      <Badge variant="success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t("admin.network.active")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <XCircle className="h-3 w-3 mr-1" />
                        {t("admin.network.inactive")}
                      </Badge>
                    )}
                    {selectedUser.role === "superadmin" && (
                      <Badge className="bg-purple-600 text-white">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Superadmin
                      </Badge>
                    )}
                    {selectedUser.role === "admin" && (
                      <Badge className="bg-primary text-white">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                    {selectedUser.role === "member" && (
                      <Badge variant="outline">Member</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                  <p className="text-muted-foreground">Joined {new Date(selectedUser.created_at).toLocaleDateString()}</p>
                </div>

                {/* Referral Statistics */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("admin.network.referralStatistics")}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground">{t("admin.network.totalDirectReferrals")}</p>
                      <p className="text-2xl font-bold">{selectedUser.direct_referrals_count}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground">{t("admin.network.activeDirectReferrals")}</p>
                      <p className="text-2xl font-bold text-primary">{selectedUser.active_direct_referrals_count}</p>
                    </div>
                  </div>
                </div>

                {/* Network Stats */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("admin.network.networkStats")}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground">{t("admin.network.totalTeam")}</p>
                      <p className="text-2xl font-bold">{selectedUser.total_network_count}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground">{t("admin.network.activeTeam")}</p>
                      <p className="text-2xl font-bold text-primary">{selectedUser.active_network_count}</p>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("admin.network.additionalInfo")}</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t("admin.network.referralCode")}</p>
                      <p className="font-mono font-medium">{selectedUser.referral_code || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("admin.network.referredBy")}</p>
                      <p className="font-medium">
                        {selectedUser.referrer && selectedUser.referrer.length > 0 ? (
                          <>
                            {selectedUser.referrer[0].name || t("common.unknown")}
                            {selectedUser.referrer[0].network_position_id && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (Pos: {selectedUser.referrer[0].network_position_id})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">{t("admin.network.noReferrer")}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("admin.network.commissionRate")}</p>
                      <p className="font-medium">{(selectedUser.current_commission_rate * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("admin.network.paymentSchedule")}</p>
                      <p className="font-medium capitalize">{selectedUser.payment_schedule}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("admin.network.initialPayment")}</p>
                      <p className={`font-medium ${selectedUser.initial_payment_completed ? 'text-[#D4A853]' : 'text-yellow-600'}`}>
                        {selectedUser.initial_payment_completed ? t("admin.network.completed") : t("admin.payouts.pending")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("admin.network.lastPayment")}</p>
                      <p className="font-medium">
                        {selectedUser.last_payment_date
                          ? new Date(selectedUser.last_payment_date).toLocaleDateString()
                          : t("admin.financials.never")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Admin Actions */}
                {isSuperAdmin && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">{t("admin.network.adminActions")}</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.initial_payment_completed && (
                        <Button
                          size="sm"
                          variant={selectedUser.is_active ? "outline" : "default"}
                          onClick={() => handleToggleActive(selectedUser)}
                          disabled={isProcessing}
                        >
                          <Power className="h-3 w-3 mr-2" />
                          {selectedUser.is_active ? t("admin.network.deactivate") : t("admin.network.activate")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={selectedUser.role === "admin" ? "destructive" : "default"}
                        onClick={() => {
                          openConfirmDialog(selectedUser.id, selectedUser.name || selectedUser.email, selectedUser.role)
                        }}
                      >
                        <Shield className="h-3 w-3 mr-2" />
                        {selectedUser.role === "admin" ? t("admin.network.revokeAdmin") : t("admin.network.grantAdmin")}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                        onClick={() => openBypassDialog(selectedUser)}
                      >
                        <Sparkles className="h-3 w-3 mr-2" />
                        {t("admin.network.grantBypass")}
                      </Button>
                      {selectedUser.payout_wallet_address && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openManualPayoutDialog(selectedUser)}
                        >
                          <DollarSign className="h-3 w-3 mr-2" />
                          {t("admin.network.manualPayout")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPaymentDialog(selectedUser)}
                      >
                        <CreditCard className="h-3 w-3 mr-2" />
                        {t("admin.network.makePayment")}
                      </Button>
                      {selectedUser.role !== "superadmin" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openDeletionRequestDialog(selectedUser)}
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          {t("admin.network.deleteAccount")}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {userToToggle?.currentRole === "admin" ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  {t("admin.network.revokeAdminPrivileges")}
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {t("admin.network.grantAdminPrivileges")}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {userToToggle?.currentRole === "admin" ? (
                <>
                  Are you sure you want to revoke admin privileges from{" "}
                  <span className="font-semibold text-foreground">{userToToggle?.name}</span>?
                  They will lose access to the admin panel and network view.
                </>
              ) : (
                <>
                  Are you sure you want to grant admin privileges to{" "}
                  <span className="font-semibold text-foreground">{userToToggle?.name}</span>?
                  They will have full access to the admin panel and network view.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isUpdating}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant={userToToggle?.currentRole === "admin" ? "destructive" : "default"}
              onClick={confirmToggleAdminRole}
              disabled={isUpdating}
            >
              {isUpdating ? (
                t("admin.network.updating")
              ) : userToToggle?.currentRole === "admin" ? (
                t("admin.network.revokeAdmin")
              ) : (
                t("admin.network.grantAdmin")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bypass Access Dialog */}
      <Dialog open={showBypassDialog} onOpenChange={setShowBypassDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              {t("admin.network.grantBypassAccess")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.network.grantBypassDesc").replace("{name}", userForBypass?.name || "")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bypass-referrals-count" className="text-sm font-medium">
                {t("admin.network.directReferralsBypassCount")}
              </Label>
              <Input
                id="bypass-referrals-count"
                type="number"
                min={0}
                max={18}
                value={bypassSelections.directReferralsCount}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0
                  const clamped = Math.max(0, Math.min(18, value))
                  setBypassSelections(prev => ({ ...prev, directReferralsCount: clamped }))
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.network.directReferralsBypassDesc")}
              </p>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="bypass-subscription"
                checked={bypassSelections.subscription}
                onCheckedChange={(checked) =>
                  setBypassSelections(prev => ({ ...prev, subscription: checked === true }))
                }
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="bypass-subscription"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t("admin.network.bypassSubscriptionRequirement")}
                </label>
                <p className="text-sm text-muted-foreground">
                  {t("admin.network.bypassSubscriptionDesc")}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="bypass-initial"
                checked={bypassSelections.initialPayment}
                disabled={userForBypass?.currentBypasses.initialPayment || userForBypass?.initialPaymentCompleted}
                onCheckedChange={(checked) =>
                  setBypassSelections(prev => ({ ...prev, initialPayment: checked === true }))
                }
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="bypass-initial"
                  className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${(userForBypass?.currentBypasses.initialPayment || userForBypass?.initialPaymentCompleted) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {t("admin.network.bypassInitialPaymentRequirement")}
                  {userForBypass?.currentBypasses.initialPayment && (
                    <span className="text-purple-600 ml-2">({t("admin.network.alreadyBypassed")})</span>
                  )}
                  {userForBypass?.initialPaymentCompleted && !userForBypass?.currentBypasses.initialPayment && (
                    <span className="text-[#D4A853] ml-2">({t("admin.network.alreadyPaid")})</span>
                  )}
                </label>
                <p className="text-sm text-muted-foreground">
                  {userForBypass?.initialPaymentCompleted
                    ? t("admin.network.alreadyCompletedPayment")
                    : userForBypass?.currentBypasses.initialPayment
                    ? t("admin.network.permanentBypass")
                    : t("admin.network.bypassInitialPaymentDesc")}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBypassDialog(false)}
              disabled={isUpdating}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="default"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              onClick={confirmUpdateBypass}
              disabled={isUpdating}
            >
              {isUpdating ? t("admin.network.updating") : t("admin.network.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fix Orphaned User Dialog */}
      <Dialog open={showFixDialog} onOpenChange={setShowFixDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.network.fixOrphanedUser")}</DialogTitle>
            <DialogDescription>
              {t("admin.network.fixOrphanedUserDesc")}
            </DialogDescription>
          </DialogHeader>
          {orphanedUserToFix && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-2 rounded-lg">
                <p className="text-sm"><strong>Email:</strong> {orphanedUserToFix.email}</p>
                <p className="text-sm"><strong>Name:</strong> {orphanedUserToFix.name || "Not set"}</p>
                {orphanedUserToFix.referred_by && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Will be referred by: {orphanedUserToFix.referred_by}
                  </p>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <p>This will:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Create user record in public.users</li>
                  <li>Generate referral code</li>
                  <li>Create referral relationship (if referrer exists)</li>
                  <li>Set initial_payment_completed = false</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFixDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleFixOrphanedUser} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("admin.network.fixing")}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("admin.network.fixUser")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Auth User Dialog */}
      <Dialog open={showDeleteAuthDialog} onOpenChange={setShowDeleteAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t("admin.network.deleteUserFromAuth")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.network.deleteUserFromAuthDesc")}
            </DialogDescription>
          </DialogHeader>
          {orphanedUserToDelete && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                <p className="text-sm"><strong>Email:</strong> {orphanedUserToDelete.email}</p>
                <p className="text-sm"><strong>Name:</strong> {orphanedUserToDelete.name || "Not set"}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-confirm">{t("admin.network.typeEmailToConfirm")}</Label>
                <Input
                  id="email-confirm"
                  type="text"
                  value={emailConfirmation}
                  onChange={(e) => setEmailConfirmation(e.target.value)}
                  placeholder={orphanedUserToDelete.email}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAuthDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAuthUser}
              disabled={isProcessing || emailConfirmation !== orphanedUserToDelete?.email}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("admin.network.deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("admin.network.deletePermanently")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Payout Dialog */}
      <Dialog open={showManualPayoutDialog} onOpenChange={setShowManualPayoutDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#D4A853]" />
              {t("admin.network.manualPayoutTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.network.manualPayoutDesc").replace("{name}", userForPayout?.name || userForPayout?.email || "")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="payout-amount">{t("admin.network.amountUsdc")}</Label>
              <Input
                id="payout-amount"
                type="number"
                min="0.01"
                max="2000"
                step="0.01"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">{t("admin.network.maxUsdc")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowManualPayoutDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleManualPayout}
              disabled={isProcessing || !payoutAmount || parseFloat(payoutAmount) <= 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("admin.network.sending")}
                </>
              ) : (
                t("admin.network.send")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Deletion Dialog */}
      <Dialog open={showDeletionRequestDialog} onOpenChange={setShowDeletionRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              {t("admin.network.requestAccountDeletion")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.network.requestAccountDeletionDesc")}
            </DialogDescription>
          </DialogHeader>
          {userForDeletion && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                <p className="text-sm"><strong>Name:</strong> {userForDeletion.name || "No name"}</p>
                <p className="text-sm"><strong>Email:</strong> {userForDeletion.email}</p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>User profile and all associated data</li>
                  <li>Authentication credentials</li>
                  <li>Commission history</li>
                  <li>Payment records</li>
                </ul>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> This action requires approval from another superadmin before execution.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeletionRequestDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRequestDeletion}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("admin.network.requesting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("admin.network.requestDeletion")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment QR Code Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {t("admin.network.makePaymentForUser")}
            </DialogTitle>
            <DialogDescription>
              Make a payment on behalf of{" "}
              <span className="font-semibold text-foreground">{userForPayment?.name || userForPayment?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Payment Type Selector */}
            <div className="space-y-2">
              <Label>{t("admin.network.paymentType")}</Label>
              <Select
                value={paymentType}
                onValueChange={(value: "weekly" | "monthly" | "initial") => handlePaymentTypeChange(value)}
                disabled={loadingPaymentAddress}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!userForPayment?.initial_payment_completed && (
                    <SelectItem value="initial">Initial Payment ($499)</SelectItem>
                  )}
                  {userForPayment?.initial_payment_completed && (
                    <>
                      <SelectItem value="weekly">Weekly Subscription ($49.75)</SelectItem>
                      <SelectItem value="monthly">Monthly Subscription ($199)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Expected Amount */}
            <div className="p-3 bg-surface-2 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">{t("admin.network.amountDue")}</p>
              <p className="text-2xl font-bold text-primary">${expectedPaymentAmount.toFixed(2)}</p>
            </div>

            {/* QR Code & Address */}
            {loadingPaymentAddress ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : paymentAddress ? (
              <div className="flex flex-col items-center gap-4">
                {paymentQrCode && (
                  <div className="p-4 bg-white rounded-lg border">
                    <img src={paymentQrCode} alt="Payment QR Code" className="w-48 h-48" />
                  </div>
                )}
                <div className="text-center w-full">
                  <p className="text-sm text-muted-foreground mb-2">
                    {t("admin.network.sendUsdcPolygon")}
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-lg">
                    <code className="text-xs font-mono break-all flex-1">
                      {paymentAddress}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyAddress}
                      className="shrink-0"
                    >
                      {copiedAddress ? (
                        <CheckCircle2 className="h-4 w-4 text-[#D4A853]" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  <p>{t("admin.network.paymentAutoDetected")}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                {t("admin.network.failedToLoadPaymentAddress")}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
