"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Search, ChevronDown, ChevronRight, Users as UsersIcon, Network, GitBranch, Trash2, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"

interface NetworkUser {
  id: string
  email: string | null
  name: string | null
  network_position_id: string
  network_level: number
  network_position: number
  tree_parent_network_position_id: string | null
  is_active: boolean
  created_at: string
  initial_payment_completed: boolean
  last_referral_branch: number | null
  total_network_count: number
  active_network_count: number
  referred_by: string | null
  referrer: Array<{
    name: string | null
    network_position_id: string | null
  }> | null
}

interface ChildPosition {
  positionId: string
  position: number
  branch: 1 | 2 | 3
  occupied: boolean
  user: NetworkUser | null
}

interface NetworkVisualizerClientProps {
  usersByLevel: Record<number, NetworkUser[]>
  totalUsers: number
}

export function NetworkVisualizerClient({ usersByLevel, totalUsers }: NetworkVisualizerClientProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([0]))
  const [selectedUser, setSelectedUser] = useState<NetworkUser | null>(null)
  const [children, setChildren] = useState<ChildPosition[] | null>(null)
  const [loadingChildren, setLoadingChildren] = useState(false)

  // Delete functionality
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deletionReason, setDeletionReason] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [blockingUsers, setBlockingUsers] = useState<NetworkUser[]>([])
  const [showBlockingUsersDialog, setShowBlockingUsersDialog] = useState(false)

  const { toast } = useToast()

  const levels = Object.keys(usersByLevel).map(Number).sort((a, b) => a - b)

  // Helper function to find parent user
  const findParentUser = (parentPositionId: string | null): NetworkUser | null => {
    if (!parentPositionId) return null

    for (const level of Object.values(usersByLevel)) {
      const parent = level.find(u => u.network_position_id === parentPositionId)
      if (parent) return parent
    }
    return null
  }

  const toggleLevel = (level: number) => {
    const newExpanded = new Set(expandedLevels)
    if (newExpanded.has(level)) {
      newExpanded.delete(level)
    } else {
      newExpanded.add(level)
    }
    setExpandedLevels(newExpanded)
  }

  const handleUserClick = async (user: NetworkUser) => {
    setSelectedUser(user)
    setLoadingChildren(true)
    setChildren(null)

    try {
      const response = await fetch(`/api/admin/network/children?positionId=${user.network_position_id}`)
      if (response.ok) {
        const data = await response.json()
        setChildren(data.children)
      }
    } catch (error) {
      console.error("Error fetching children:", error)
    } finally {
      setLoadingChildren(false)
    }
  }

  const closeDialog = () => {
    setSelectedUser(null)
    setChildren(null)
  }

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
    setDeleteConfirmText("")
    setDeletionReason("")
  }

  const handleDeleteConfirm = async () => {
    if (!selectedUser || deleteConfirmText !== "DELETE") return

    setDeleting(true)

    try {
      const response = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          deletionReason: deletionReason || null,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        // Check if it's because of blocking users
        if (data.blocking_users && data.blocking_users.length > 0) {
          setBlockingUsers(data.blocking_users)
          setShowBlockingUsersDialog(true)
          setShowDeleteDialog(false)
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to delete user",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Success",
          description: "User deleted successfully",
        })
        setShowDeleteDialog(false)
        closeDialog()
        // Reload the page to refresh the user list
        window.location.reload()
      }
    } catch (error) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  // Filter users based on search
  const filteredUsersByLevel = Object.entries(usersByLevel).reduce((acc, [level, users]) => {
    const filtered = users.filter(user =>
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.network_position_id.toLowerCase().includes(searchTerm.toLowerCase())
    )
    if (filtered.length > 0) {
      acc[Number(level)] = filtered
    }
    return acc
  }, {} as Record<number, NetworkUser[]>)

  const filteredLevels = Object.keys(filteredUsersByLevel).map(Number).sort((a, b) => a - b)

  return (
    <>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Network Levels</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{levels.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Max Depth</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Level {Math.max(...levels)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Network</CardTitle>
            <CardDescription>Find users by email, name, or position ID</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardContent>
        </Card>

        {/* Network Levels */}
        <Card>
          <CardHeader>
            <CardTitle>Network Structure</CardTitle>
            <CardDescription>Click on any user to view their child positions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredLevels.map(level => {
                  const users = filteredUsersByLevel[level]
                  const isExpanded = expandedLevels.has(level)
                  const maxCapacity = level === 0 ? 1 : Math.pow(3, level)

                  return (
                    <div key={level} className="border rounded-lg">
                      {/* Level Header */}
                      <button
                        onClick={() => toggleLevel(level)}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-semibold">
                            Level {level} {level === 0 && "(Root)"}
                          </span>
                          <Badge variant="secondary">{users.length} / {maxCapacity} users</Badge>
                        </div>
                      </button>

                      {/* Level Content */}
                      {isExpanded && (
                        <div className="border-t p-4 space-y-2">
                          {users.map(user => (
                            <button
                              key={user.id}
                              onClick={() => handleUserClick(user)}
                              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left overflow-hidden"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium truncate">
                                    {user.name || user.email}
                                  </span>
                                  {user.is_active ? (
                                    <Badge className="bg-green-500">Active</Badge>
                                  ) : (
                                    <Badge variant="outline">Inactive</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span className="font-mono">{user.network_position_id}</span>
                                  <span>•</span>
                                  <span>Pos: {user.network_position}</span>
                                  {user.last_referral_branch && (
                                    <>
                                      <span>•</span>
                                      <span>Last Branch: {user.last_referral_branch}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details & Child Positions</DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* Parent Info */}
              {selectedUser.tree_parent_network_position_id && (() => {
                const parentUser = findParentUser(selectedUser.tree_parent_network_position_id)
                return parentUser ? (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-200 dark:border-blue-900">
                    <h3 className="font-semibold text-sm mb-2 text-blue-700 dark:text-blue-400">Direct Parent</h3>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="font-medium">{parentUser.name || parentUser.email}</span>
                      </div>
                      <div className="text-muted-foreground">{parentUser.email}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-mono text-xs bg-background px-2 py-1 rounded">
                          {parentUser.network_position_id}
                        </span>
                        {parentUser.is_active ? (
                          <Badge className="bg-green-500 text-xs">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null
              })()}

              {/* User Info */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">
                    {selectedUser.name || selectedUser.email}
                  </h3>
                  {selectedUser.is_active ? (
                    <Badge className="bg-green-500">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <span className="font-medium">{selectedUser.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Position ID:</span>{" "}
                    <span className="font-mono text-xs">{selectedUser.network_position_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Level:</span>{" "}
                    <span className="font-medium">{selectedUser.network_level}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Position:</span>{" "}
                    <span className="font-medium">{selectedUser.network_position}</span>
                  </div>
                  {selectedUser.last_referral_branch && (
                    <div>
                      <span className="text-muted-foreground">Last Referral Branch:</span>{" "}
                      <span className="font-medium">{selectedUser.last_referral_branch}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Network Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-200 dark:border-blue-900">
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
                    Total Network
                  </div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                    {selectedUser.total_network_count}
                  </div>
                  <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
                    members in downline
                  </div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border-2 border-green-200 dark:border-green-900">
                  <div className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">
                    Active Members
                  </div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-300">
                    {selectedUser.active_network_count}
                  </div>
                  <div className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                    active in downline
                  </div>
                </div>
              </div>

              {/* Referred By */}
              {selectedUser.referrer && selectedUser.referrer.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border-2 border-amber-200 dark:border-amber-900">
                  <h3 className="font-semibold text-sm mb-2 text-amber-700 dark:text-amber-400">Referred By</h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="font-medium">{selectedUser.referrer[0].name || "Unknown"}</span>
                    </div>
                    {selectedUser.referrer[0].network_position_id && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-background px-2 py-1 rounded">
                          Position: {selectedUser.referrer[0].network_position_id}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Children */}
              <div>
                <h3 className="font-semibold mb-3">Child Positions</h3>
                {loadingChildren ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading child positions...
                  </div>
                ) : children ? (
                  <div className="grid grid-cols-1 gap-3">
                    {children.map((child) => (
                      <div
                        key={child.positionId}
                        className={`p-4 rounded-lg border-2 ${
                          child.occupied
                            ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                            : "bg-muted border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={child.occupied ? "default" : "outline"}>
                            Branch {child.branch}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground">
                            {child.positionId}
                          </span>
                        </div>
                        {child.occupied && child.user ? (
                          <div className="space-y-1">
                            <div className="font-medium">
                              {child.user.name || child.user.email}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {child.user.email}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {child.user.is_active ? (
                                <Badge className="bg-green-500 text-xs">Active</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Inactive</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                Position: {child.position}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            Empty Position
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Failed to load children
                  </div>
                )}
              </div>

              {/* Delete User Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleDeleteClick}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  This action is permanent and will archive the user data
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User - Confirmation Required</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900 dark:text-red-400">Warning: This action is permanent</p>
                    <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                      You are about to delete {selectedUser?.name || selectedUser?.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-medium">This will:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Remove user from authentication system</li>
                  <li>Delete user from database</li>
                  <li>Archive user data for records</li>
                  <li>Decrement network counts for upline users</li>
                  <li>Make their network position available again</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deletion-reason">Reason for Deletion (Optional)</Label>
                <Textarea
                  id="deletion-reason"
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  placeholder="Why is this user being deleted?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
                <Input
                  id="confirm-delete"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmText !== "DELETE" || deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blocking Users Dialog */}
      <AlertDialog open={showBlockingUsersDialog} onOpenChange={setShowBlockingUsersDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Delete User</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-900 dark:text-yellow-400">
                      User has downline members
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                      You must delete these users first before deleting {selectedUser?.name || selectedUser?.email}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-medium mb-2">Blocking Users:</p>
                <div className="space-y-2">
                  {blockingUsers.map((user) => (
                    <div
                      key={user.id}
                      className="p-3 bg-muted rounded-lg border"
                    >
                      <div className="font-medium">{user.name || user.email}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      <div className="text-xs font-mono mt-1 text-primary">
                        {user.network_position_id}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowBlockingUsersDialog(false)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
