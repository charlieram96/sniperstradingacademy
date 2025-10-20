"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StructureDropdown } from "@/components/team/structure-dropdown"
import {
  Users,
  UserPlus,
  TrendingUp,
  DollarSign,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Crown,
  Sparkles,
  Share2,
  Info,
  ChevronRight,
  XCircle
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface TeamMember {
  id: string
  name: string
  email: string
  network_position_id?: string
  network_level?: number
  network_position?: number
  level: number
  created_at: string
  subscription_status?: string
  referrals_count?: number
  active_network_count?: number
  total_network_count?: number
  active_direct_referrals_count?: number
  is_direct_referral?: boolean
  tree_parent_id?: string | null
  spillover_from?: string | null // For backwards compatibility
  position?: number // Position in the 3-wide structure (1, 2, or 3)
  structure?: number // Which structure this member belongs to (1-6)
  is_active?: boolean
}

interface TreeChild {
  child_id: string | null
  child_name: string
  child_email: string | null
  child_position_id: string
  child_slot_number: number
  is_filled: boolean
  is_direct_referral: boolean
}

export default function TeamPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [directReferrals, setDirectReferrals] = useState<TeamMember[]>([])
  const [treeChildren, setTreeChildren] = useState<TreeChild[]>([])
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showMemberDialog, setShowMemberDialog] = useState(false)
  const [isUserActive, setIsUserActive] = useState(false)
  const [hasPremiumBypass, setHasPremiumBypass] = useState(false)
  const [teamStats, setTeamStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    directReferralsCount: 0,
    activeDirectReferralsCount: 0,
    totalMonthlyVolume: 0,
    qualificationStatus: false,
    levels: {} as Record<number, number>,
    structures: 1,
    commissionRate: 0.10,
    completedStructures: 0,
    currentStructureProgress: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUser()
  }, [])

  const fetchTeamData = useCallback(async () => {
    if (!userId) return

    try {
      // Fetch network stats from API
      const statsResponse = await fetch(`/api/network/stats?userId=${userId}`)
      const stats = await statsResponse.json()

      const supabase = createClient()

      // Get current user's network position, active status, and granular bypass settings
      const { data: currentUser } = await supabase
        .from("users")
        .select("network_position_id, is_active, bypass_direct_referrals, bypass_subscription")
        .eq("id", userId)
        .single()

      setIsUserActive(currentUser?.is_active || currentUser?.bypass_subscription || false)
      setHasPremiumBypass(currentUser?.bypass_direct_referrals || false)

      if (!currentUser?.network_position_id) {
        // User doesn't have a network position yet
        setLoading(false)
        return
      }

      // Get all downline members using the database function
      const { data: downlineMembers } = await supabase
        .rpc("get_downline_contributors", { p_user_id: userId })

      // Get tree children (3 direct positions below user)
      const treeChildrenResponse = await fetch(`/api/network/tree-children?userId=${userId}`)
      const treeChildrenData = await treeChildrenResponse.json()
      setTreeChildren(treeChildrenData.treeChildren || [])

      // Get all direct referrals with detailed stats
      const { data: directRefs } = await supabase
        .from("users")
        .select("id, name, email, network_position_id, network_level, is_active, created_at, direct_referrals_count, active_direct_referrals_count, active_network_count, total_network_count")
        .eq("referred_by", userId)

      // Get full user details for all downline members
      const downlineIds = downlineMembers?.map((m: { contributor_id: string }) => m.contributor_id) || []
      const { data: fullUserData } = await supabase
        .from("users")
        .select("id, name, email, created_at, is_active, direct_referrals_count, active_network_count, network_level")
        .in("id", downlineIds)

      // Create a map for quick lookup
      const userDataMap = new Map(fullUserData?.map(u => [u.id, u]) || [])

      // Format member data
      const formattedMembers: TeamMember[] = downlineMembers?.map((m: {
        contributor_id: string
        contributor_name: string
        contributor_position_id: string
        is_active: boolean
      }) => {
        const userData = userDataMap.get(m.contributor_id)
        const isDirectReferral = directRefs?.some(d => d.id === m.contributor_id) || false

        return {
          id: m.contributor_id,
          name: m.contributor_name || "Unknown",
          email: userData?.email || "",
          network_position_id: m.contributor_position_id,
          level: userData?.network_level || 1,
          created_at: userData?.created_at || new Date().toISOString(),
          subscription_status: m.is_active ? "active" : "inactive",
          is_direct_referral: isDirectReferral,
          referrals_count: userData?.direct_referrals_count || 0,
          active_network_count: userData?.active_network_count || 0
        }
      }) || []

      // Separate direct referrals with full stats
      const directs = directRefs?.map(d => ({
        id: d.id,
        name: d.name || "Unknown",
        email: d.email,
        network_position_id: d.network_position_id || "",
        network_level: d.network_level || 0,
        level: 1,
        created_at: d.created_at,
        subscription_status: d.is_active ? "active" : "inactive",
        is_direct_referral: true,
        is_active: d.is_active,
        referrals_count: d.direct_referrals_count || 0,
        active_direct_referrals_count: d.active_direct_referrals_count || 0,
        active_network_count: d.active_network_count || 0,
        total_network_count: d.total_network_count || 0
      })) || []

      setDirectReferrals(directs)
      setTeamMembers(formattedMembers)

      // Use stats from API
      if (stats.network && stats.structures && stats.earnings) {
        const levels = {} as Record<number, number>
        // Group by level (would need to parse from network_position_id)

        // Count active direct referrals
        const activeDirectCount = directs.filter(d => d.is_active).length

        setTeamStats({
          totalMembers: stats.network.totalMembers,
          activeMembers: stats.network.activeMembers,
          directReferralsCount: stats.network.directReferrals,
          activeDirectReferralsCount: activeDirectCount,
          totalMonthlyVolume: stats.earnings.actualMonthlyEarnings,
          qualificationStatus: stats.earnings.canWithdraw,
          levels,
          structures: stats.structures.current,
          commissionRate: stats.earnings.commissionRate,
          completedStructures: stats.structures.completed,
          currentStructureProgress: stats.structures.progress
        })
      }
    } catch (error) {
      console.error("Error fetching team data:", error)
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchTeamData()
  }, [fetchTeamData])

  const totalMaxMembers = 1092

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading team data...</div>
      </div>
    )
  }

  // Calculate qualification requirements based on current structure
  const getRequiredActiveReferrals = (structureNum: number) => {
    return structureNum * 3 // Structure 1 = 3, Structure 2 = 6, etc.
  }

  const requiredActiveReferrals = getRequiredActiveReferrals(teamStats.structures)
  const activeDirectCount = teamStats.activeDirectReferralsCount
  const isQualifiedForCurrentStructure = hasPremiumBypass || (isUserActive && activeDirectCount >= requiredActiveReferrals)

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Team</h1>
            <p className="text-muted-foreground mt-2">
              Build and manage your 3-wide, 6-deep trading network
            </p>
          </div>
        </div>
      </div>

      {/* Qualification Status Alert - TOP OF PAGE */}
      <Card className={`mb-6 ${
        isQualifiedForCurrentStructure
          ? 'border-green-500 bg-green-500/5'
          : 'border-amber-500 bg-amber-500/5'
      }`}>
        <CardHeader>
          <div className="flex items-start gap-3">
            {isQualifiedForCurrentStructure ? (
              <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <CardTitle className={isQualifiedForCurrentStructure ? 'text-green-700 dark:text-green-400' : 'text-foreground'}>
                {isQualifiedForCurrentStructure
                  ? `✓ Qualified for Structure ${teamStats.structures} Payouts!`
                  : 'Qualification Status'}
              </CardTitle>
              <CardDescription className="mt-2">
                {hasPremiumBypass ? (
                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                    ✨ You have Referral Bypass - qualified for earnings without referral requirements
                  </span>
                ) : !isUserActive ? (
                  <span className="text-destructive font-medium">
                    ⚠️ You must be active (paid subscription) to qualify for payouts
                  </span>
                ) : isQualifiedForCurrentStructure ? (
                  <span className="text-green-600 dark:text-green-400">
                    You meet all requirements for Structure {teamStats.structures} earnings. Keep building to unlock higher structures!
                  </span>
                ) : (
                  <span>
                    You need {requiredActiveReferrals - activeDirectCount} more active direct {requiredActiveReferrals - activeDirectCount === 1 ? 'referral' : 'referrals'} to qualify for Structure {teamStats.structures} payouts
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Active Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div className="flex items-center gap-2">
                {isUserActive ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium">Your Active Status</span>
              </div>
              <Badge className={isUserActive ? 'bg-green-500 text-white' : 'bg-destructive text-white'}>
                {isUserActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            {/* Active Direct Referrals Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Active Direct Referrals (Structure {teamStats.structures})
                </span>
                <span className={`text-sm font-bold ${
                  activeDirectCount >= requiredActiveReferrals ? 'text-green-600' : 'text-muted-foreground'
                }`}>
                  {activeDirectCount}/{requiredActiveReferrals}
                </span>
              </div>
              <Progress
                value={(activeDirectCount / requiredActiveReferrals) * 100}
                className={`h-2 ${
                  activeDirectCount >= requiredActiveReferrals
                    ? 'bg-green-100 dark:bg-green-950'
                    : 'bg-muted'
                }`}
              />
            </div>

            {/* Higher Structure Info */}
            {teamStats.structures < 6 && isQualifiedForCurrentStructure && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Next level:</span> To qualify for Structure {teamStats.structures + 1} payouts, you&apos;ll need {getRequiredActiveReferrals(teamStats.structures + 1)} active direct referrals and 1,092+ active members.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tree Children - Your 3 Direct Positions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Tree Positions
          </CardTitle>
          <CardDescription>
            These are your 3 direct positions in the network tree (different from direct referrals)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {treeChildren.map((child) => (
              <div
                key={child.child_slot_number}
                className={`p-4 rounded-lg border-2 ${
                  child.is_filled
                    ? child.is_direct_referral
                      ? 'bg-primary/5 border-primary'
                      : 'bg-muted/50 border-muted'
                    : 'bg-background border-dashed border-muted-foreground/30'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        child.is_filled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {child.child_slot_number}
                    </div>
                    <span className="text-xs text-muted-foreground">Slot {child.child_slot_number}</span>
                  </div>
                  {child.is_filled && child.is_direct_referral && (
                    <Badge variant="default" className="text-xs">
                      Your Referral
                    </Badge>
                  )}
                  {child.is_filled && !child.is_direct_referral && (
                    <Badge variant="secondary" className="text-xs">
                      Spillover
                    </Badge>
                  )}
                </div>

                {child.is_filled ? (
                  <>
                    <p className="font-semibold truncate">{child.child_name}</p>
                    {child.child_email && (
                      <p className="text-xs text-muted-foreground truncate">{child.child_email}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {child.child_position_id}
                    </p>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Empty Slot</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Will auto-fill with your next referral
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Direct Referrals Section - Clickable */}
      <Card className="mb-6 border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Your Direct Referrals
          </CardTitle>
          <CardDescription>
            People you personally referred - click to view their team details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {directReferrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>No direct referrals yet</p>
              <p className="text-sm mt-2">Share your referral link to start building your team</p>
            </div>
          ) : (
            <div className="space-y-3">
              {directReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => {
                    setSelectedMember(referral)
                    setShowMemberDialog(true)
                  }}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      referral.subscription_status === 'active'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {referral.subscription_status === 'active' ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <UserCheck className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{referral.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Joined {new Date(referral.created_at).toLocaleDateString()} • {referral.total_network_count} members in structure
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge className={`${
                        referral.subscription_status === 'active'
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-muted text-muted-foreground border-muted'
                      }`}>
                        {referral.subscription_status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {referral.active_direct_referrals_count}/{referral.referrals_count || 0} active refs
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Details Dialog */}
      <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              {selectedMember?.name}&apos;s Team Details
            </DialogTitle>
            <DialogDescription>
              View statistics and network information for this direct referral
            </DialogDescription>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              {/* Member Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Status</span>
                  <Badge className={selectedMember.is_active ? 'bg-green-500 text-white' : 'bg-muted'}>
                    {selectedMember.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">{selectedMember.email}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Joined {new Date(selectedMember.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Referral Stats */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Referral Statistics</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">Total Direct Referrals</div>
                    <div className="text-2xl font-bold mt-1">{selectedMember.referrals_count || 0}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-xs text-muted-foreground">Active Direct Referrals</div>
                    <div className="text-2xl font-bold text-primary mt-1">{selectedMember.active_direct_referrals_count || 0}</div>
                  </div>
                </div>
              </div>

              {/* Network Stats */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Network Structure</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">Total Members</div>
                    <div className="text-2xl font-bold mt-1">{selectedMember.total_network_count || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">All members in structure</div>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <div className="text-xs text-muted-foreground">Active Members</div>
                    <div className="text-2xl font-bold text-green-600 mt-1">{selectedMember.active_network_count || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">With subscription</div>
                  </div>
                </div>
              </div>

              {/* Qualification Status */}
              <div className="p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Qualified for Payouts</span>
                  {selectedMember.is_active && (selectedMember.active_direct_referrals_count || 0) >= 3 ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Yes</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">No</span>
                    </div>
                  )}
                </div>
                {!selectedMember.is_active ? (
                  <p className="text-xs text-muted-foreground mt-2">Member is not active</p>
                ) : (selectedMember.active_direct_referrals_count || 0) < 3 ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    Needs {3 - (selectedMember.active_direct_referrals_count || 0)} more active direct referrals
                  </p>
                ) : (
                  <p className="text-xs text-green-600 mt-2">Meets all requirements ✓</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Current Structure - PRIMARY FOCUS */}
      <Card className="mb-6 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-primary" />
            Current Structure Progress
          </CardTitle>
          <CardDescription className="text-base">
            Build your 3-wide unlimited depth structure to maximize earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Current Structure Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground">Active Members</p>
              <p className="text-3xl font-bold text-primary">{teamStats.activeMembers}/{1092 * teamStats.structures}</p>
              <Progress value={(teamStats.activeMembers / (1092 * teamStats.structures)) * 100} className="h-2 mt-2" />
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-3xl font-bold">{teamStats.totalMembers}</p>
              <p className="text-xs text-muted-foreground mt-1">Informational only</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Monthly Earnings</p>
              <p className="text-3xl font-bold text-primary">${(teamStats.activeMembers * 19.9).toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-1">19.9 × active count</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Structure Overview - SECONDARY */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Structure Overview
          </CardTitle>
          <CardDescription>
            Build multiple structures to increase your commission rate up to 16%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Active Structures</p>
              <p className="text-2xl font-bold">{teamStats.structures}/6</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Commission Rate</p>
              <p className="text-2xl font-bold text-primary">{(teamStats.commissionRate * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Completed Structures</p>
              <p className="text-2xl font-bold">{teamStats.completedStructures}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Next Structure At</p>
              <p className="text-2xl font-bold">{1092 - teamStats.currentStructureProgress}</p>
            </div>
          </div>
          
          {/* Interactive Structure Dropdowns */}
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => i + 1).map((structureNum) => {
              const isUnlocked = structureNum <= teamStats.structures
              const isComplete = structureNum <= teamStats.completedStructures
              
              // Filter members for this specific structure
              // In a real implementation, you'd need to track which members belong to which structure
              // For now, we'll distribute members across structures
              const structureMembers = teamMembers.filter((_, index) => {
                const structureIndex = Math.floor(index / 1092) + 1
                return structureIndex === structureNum
              })
              
              const membersInStructure = structureNum === 1 ? 
                Math.min(teamStats.totalMembers, 1092) :
                structureNum <= teamStats.completedStructures ? 1092 :
                structureNum === teamStats.completedStructures + 1 ? teamStats.currentStructureProgress : 0
              
              return (
                <StructureDropdown
                  key={structureNum}
                  structureNum={structureNum}
                  isActive={isUnlocked}
                  isComplete={isComplete}
                  members={structureMembers}
                  totalMembers={membersInStructure}
                  maxMembers={1092}
                  commissionRate={10 + (structureNum - 1)}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4 inline mr-2" />
              Total Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">of {totalMaxMembers} possible</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <UserCheck className="h-4 w-4 inline mr-2" />
              Direct Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats.directReferralsCount}/3</div>
            <p className="text-xs text-muted-foreground">
              {teamStats.qualificationStatus ? "Qualified ✓" : "Not qualified"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <UserPlus className="h-4 w-4 inline mr-2" />
              Active Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats.activeMembers}</div>
            <p className="text-xs text-muted-foreground">with subscription</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4 inline mr-2" />
              Sniper Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${teamStats.totalMonthlyVolume.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">monthly team volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4 inline mr-2" />
              Your Residual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${teamStats.qualificationStatus ? (teamStats.totalMonthlyVolume * 0.1).toLocaleString() : "0"}
            </div>
            <p className="text-xs text-muted-foreground">10% commission</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}