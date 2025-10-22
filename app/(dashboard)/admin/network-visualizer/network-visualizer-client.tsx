"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronDown, ChevronRight, Users as UsersIcon, Network, GitBranch } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

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

  const levels = Object.keys(usersByLevel).map(Number).sort((a, b) => a - b)

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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
