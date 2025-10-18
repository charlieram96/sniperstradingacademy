"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Network, Search, Shield, ShieldCheck, Users, CheckCircle2, XCircle, AlertTriangle, Crown, Sparkles } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
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
  total_network_count: number
  active_network_count: number
  current_commission_rate: number
  monthly_commission: number
  created_at: string
  last_payment_date: string | null
  payment_schedule: "weekly" | "monthly"
  referral_code: string | null
  premium_bypass: boolean
}

type SortField = "name" | "email" | "created_at" | "total_network_count" | "monthly_commission" | "active_direct_referrals_count"
type SortDirection = "asc" | "desc"

export default function AdminNetworkPage() {
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [userToToggle, setUserToToggle] = useState<{ id: string; name: string; currentRole: "member" | "admin" | "superadmin" } | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showPremiumBypassDialog, setShowPremiumBypassDialog] = useState(false)
  const [userForPremiumBypass, setUserForPremiumBypass] = useState<{ id: string; name: string; currentBypass: boolean } | null>(null)

  useEffect(() => {
    checkAdminStatus()
    fetchAllUsers()
  }, [])

  useEffect(() => {
    filterAndSortUsers()
  }, [users, searchQuery, roleFilter, statusFilter, sortField, sortDirection])

  async function checkAdminStatus() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      setIsAdmin(userData?.role === "admin" || userData?.role === "superadmin")
      setIsSuperAdmin(userData?.role === "superadmin")
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
        total_network_count,
        active_network_count,
        current_commission_rate,
        monthly_commission,
        created_at,
        last_payment_date,
        payment_schedule,
        referral_code,
        premium_bypass
      `)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setUsers(data)
    }
    setLoading(false)
  }

  function filterAndSortUsers() {
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
  }

  function openConfirmDialog(userId: string, userName: string, currentRole: "member" | "admin" | "superadmin") {
    setUserToToggle({ id: userId, name: userName, currentRole })
    setShowConfirmDialog(true)
  }

  function openPremiumBypassDialog(userId: string, userName: string, currentBypass: boolean) {
    setUserForPremiumBypass({ id: userId, name: userName, currentBypass })
    setShowPremiumBypassDialog(true)
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

  async function confirmTogglePremiumBypass() {
    if (!userForPremiumBypass) return

    setIsUpdating(true)
    const newBypassStatus = !userForPremiumBypass.currentBypass

    const supabase = createClient()
    const { error } = await supabase
      .from("users")
      .update({ premium_bypass: newBypassStatus })
      .eq("id", userForPremiumBypass.id)

    if (error) {
      console.error("Error updating premium bypass:", error)
      setIsUpdating(false)
      return
    }

    // Refresh user list
    await fetchAllUsers()

    // Update selected user if it's the one we just modified
    if (selectedUser?.id === userForPremiumBypass.id) {
      setSelectedUser({ ...selectedUser, premium_bypass: newBypassStatus })
    }

    setIsUpdating(false)
    setShowPremiumBypassDialog(false)
    setUserForPremiumBypass(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Network className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Network View</h1>
        </div>
        <p className="text-muted-foreground">Complete view of all users in the Trading Hub network</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {users.filter((u) => u.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {users.filter((u) => u.initial_payment_completed).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {users.filter((u) => u.role === "admin").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Superadmins</CardTitle>
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
                  placeholder="Search by name or email..."
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
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="member">Members Only</SelectItem>
                <SelectItem value="admin">Admins Only</SelectItem>
                <SelectItem value="superadmin">Superadmins Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-4 mt-4">
            <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Join Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="total_network_count">Team Size</SelectItem>
                <SelectItem value="monthly_commission">Commission</SelectItem>
                <SelectItem value="active_direct_referrals_count">Direct Referrals</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortDirection} onValueChange={(value: SortDirection) => setSortDirection(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
          <CardDescription>Click on a user to view details and manage admin privileges</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No users match your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
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
                        {user.premium_bypass && (
                          <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                            <Crown className="h-3 w-3 mr-1" />
                            Premium Bypass
                          </Badge>
                        )}
                        {user.is_active ? (
                          <Badge className="bg-green-500 text-white">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Direct Referrals</p>
                          <p className="font-medium">{user.active_direct_referrals_count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Team</p>
                          <p className="font-medium">{user.total_network_count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Active Team</p>
                          <p className="font-medium">{user.active_network_count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Commission Rate</p>
                          <p className="font-medium">{(user.current_commission_rate * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Monthly Earnings</p>
                          <p className="font-medium text-primary">{formatCurrency(user.monthly_commission)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedUser?.id === user.id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">User ID</p>
                          <p className="font-mono text-xs">{user.id}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Referral Code</p>
                          <p className="font-mono text-sm font-medium">{user.referral_code || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Joined</p>
                          <p className="font-medium">
                            {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment Schedule</p>
                          <p className="font-medium capitalize">{user.payment_schedule}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Initial Payment</p>
                          <p className={`font-medium ${user.initial_payment_completed ? 'text-green-600' : 'text-yellow-600'}`}>
                            {user.initial_payment_completed ? "Completed" : "Pending"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Last Payment</p>
                          <p className="font-medium">
                            {user.last_payment_date
                              ? new Date(user.last_payment_date).toLocaleDateString()
                              : "Never"}
                          </p>
                        </div>
                      </div>
                      {isSuperAdmin && user.role !== "superadmin" && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            variant={user.role === "admin" ? "destructive" : "default"}
                            onClick={(e) => {
                              e.stopPropagation()
                              openConfirmDialog(user.id, user.name || user.email, user.role)
                            }}
                          >
                            <Shield className="h-3 w-3 mr-2" />
                            {user.role === "admin" ? "Revoke Admin" : "Grant Admin"}
                          </Button>
                          <Button
                            size="sm"
                            variant={user.premium_bypass ? "outline" : "default"}
                            className={user.premium_bypass ? "border-purple-600 text-purple-600" : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"}
                            onClick={(e) => {
                              e.stopPropagation()
                              openPremiumBypassDialog(user.id, user.name || user.email, user.premium_bypass)
                            }}
                          >
                            <Crown className="h-3 w-3 mr-2" />
                            {user.premium_bypass ? "Remove Premium Bypass" : "Grant Premium Bypass"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {userToToggle?.currentRole === "admin" ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Revoke Admin Privileges
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Grant Admin Privileges
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
              Cancel
            </Button>
            <Button
              variant={userToToggle?.currentRole === "admin" ? "destructive" : "default"}
              onClick={confirmToggleAdminRole}
              disabled={isUpdating}
            >
              {isUpdating ? (
                "Updating..."
              ) : userToToggle?.currentRole === "admin" ? (
                "Revoke Admin"
              ) : (
                "Grant Admin"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Premium Bypass Confirmation Dialog */}
      <Dialog open={showPremiumBypassDialog} onOpenChange={setShowPremiumBypassDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {userForPremiumBypass?.currentBypass ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Remove Premium Bypass
                </>
              ) : (
                <>
                  <Crown className="h-5 w-5 text-purple-600" />
                  Grant Premium Bypass
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {userForPremiumBypass?.currentBypass ? (
                <>
                  Are you sure you want to remove premium bypass from{" "}
                  <span className="font-semibold text-foreground">{userForPremiumBypass?.name}</span>?
                  They will need to pay the $499 initial payment and $199 monthly subscription to access the platform.
                </>
              ) : (
                <>
                  Are you sure you want to grant premium bypass to{" "}
                  <span className="font-semibold text-foreground">{userForPremiumBypass?.name}</span>?
                  They will have full platform access without paying the $499 initial payment or $199 monthly subscription, and will always qualify for earnings regardless of referral requirements.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPremiumBypassDialog(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant={userForPremiumBypass?.currentBypass ? "destructive" : "default"}
              className={!userForPremiumBypass?.currentBypass ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" : ""}
              onClick={confirmTogglePremiumBypass}
              disabled={isUpdating}
            >
              {isUpdating ? (
                "Updating..."
              ) : userForPremiumBypass?.currentBypass ? (
                "Remove Premium Bypass"
              ) : (
                "Grant Premium Bypass"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
