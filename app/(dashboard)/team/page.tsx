"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StructureDropdown } from "@/components/team/structure-dropdown"
import { AddTestMembersButton } from "@/components/team/add-test-members-button"
import { 
  Users, 
  UserPlus, 
  TrendingUp, 
  DollarSign, 
  ChevronRight,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Crown,
  Sparkles,
  Share2
} from "lucide-react"

interface TeamMember {
  id: string
  name: string
  email: string
  level: number
  created_at: string
  subscription_status?: string
  referrals_count?: number
  is_direct_referral?: boolean
  spillover_from?: string | null
  position?: number // Position in the 3-wide structure (1, 2, or 3)
  structure?: number // Which structure this member belongs to (1-6)
}

export default function TeamPage() {
  const { data: session } = useSession()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [directReferrals, setDirectReferrals] = useState<TeamMember[]>([])
  const [teamStats, setTeamStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    directReferralsCount: 0,
    totalMonthlyVolume: 0,
    qualificationStatus: false,
    levels: {} as Record<number, number>,
    structures: 1,
    commissionRate: 0.10,
    completedStructures: 0,
    currentStructureProgress: 0
  })
  const [loading, setLoading] = useState(true)
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([1]))

  const fetchTeamData = useCallback(async () => {
    if (!session?.user?.id) return
    
    const supabase = createClient()
    
    // Get all team members including spillover info
    const { data: members } = await supabase
      .from("group_members")
      .select(`
        member_id,
        level,
        is_direct_referral,
        spillover_from,
        position,
        users!inner(
          id,
          name,
          email,
          created_at
        )
      `)
      .eq("group_owner_id", session.user.id)
      .order("level", { ascending: true })
      .order("position", { ascending: true })

    if (members) {
      // Get subscription status for each member
      const memberIds = members.map(m => m.member_id)
      
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("user_id, status")
        .in("user_id", memberIds)
        .eq("status", "active")

      const activeSubscribers = new Set(subscriptions?.map((s: { user_id: string }) => s.user_id) || [])

      // Get referral counts for each member
      const { data: referralCounts } = await supabase
        .from("referrals")
        .select("referrer_id")
        .in("referrer_id", memberIds)
        .eq("status", "active")

      const referralCountMap = referralCounts?.reduce((acc: Record<string, number>, r: { referrer_id: string }) => {
        acc[r.referrer_id] = (acc[r.referrer_id] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      // Format member data
      interface UserData {
        id: string
        name: string | null
        email: string
        created_at: string
      }
      
      interface MemberData {
        member_id: string
        level: number
        is_direct_referral: boolean
        spillover_from: string | null
        position: number
        users: UserData | UserData[]
      }
      
      const formattedMembers = members.map((m: MemberData) => {
        const user = Array.isArray(m.users) ? m.users[0] : m.users
        return {
          id: user.id,
          name: user.name || "Unknown",
          email: user.email,
          level: m.level,
          created_at: user.created_at,
          subscription_status: activeSubscribers.has(user.id) ? "active" : "inactive",
          referrals_count: referralCountMap[user.id] || 0,
          is_direct_referral: m.is_direct_referral,
          spillover_from: m.spillover_from,
          position: m.position
        }
      })

      // Separate direct referrals
      const directs = formattedMembers.filter(m => m.is_direct_referral)
      setDirectReferrals(directs)
      setTeamMembers(formattedMembers)

      // Calculate stats
      const levels = formattedMembers.reduce((acc, m) => {
        acc[m.level] = (acc[m.level] || 0) + 1
        return acc
      }, {} as Record<number, number>)

      const activeCount = formattedMembers.filter(m => m.subscription_status === "active").length
      const totalMembers = formattedMembers.length
      
      // Calculate structures
      const maxPerStructure = 1092 // 3 + 9 + 27 + 81 + 243 + 729
      const completedStructures = Math.floor(totalMembers / maxPerStructure)
      const currentStructureProgress = totalMembers % maxPerStructure
      
      // Calculate unlocked structures based on direct referrals
      let unlockedStructures = 1
      if (completedStructures >= 1 && directs.length >= 6) unlockedStructures = 2
      if (completedStructures >= 2 && directs.length >= 9) unlockedStructures = 3
      if (completedStructures >= 3 && directs.length >= 12) unlockedStructures = 4
      if (completedStructures >= 4 && directs.length >= 15) unlockedStructures = 5
      if (completedStructures >= 5 && directs.length >= 18) unlockedStructures = 6
      
      const commissionRate = 0.10 + (Math.min(unlockedStructures - 1, 5) * 0.01)
      const totalVolume = activeCount * 200 * commissionRate // $200 per active member * commission rate

      setTeamStats({
        totalMembers,
        activeMembers: activeCount,
        directReferralsCount: directs.length,
        totalMonthlyVolume: totalVolume,
        qualificationStatus: directs.length >= 3,
        levels,
        structures: unlockedStructures,
        commissionRate,
        completedStructures,
        currentStructureProgress
      })
    }

    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => {
    fetchTeamData()
  }, [fetchTeamData])

  function toggleLevel(level: number) {
    const newExpanded = new Set(expandedLevels)
    if (newExpanded.has(level)) {
      newExpanded.delete(level)
    } else {
      newExpanded.add(level)
    }
    setExpandedLevels(newExpanded)
  }

  const groupedMembers = teamMembers.reduce((acc, member) => {
    if (!acc[member.level]) {
      acc[member.level] = []
    }
    acc[member.level].push(member)
    return acc
  }, {} as Record<number, TeamMember[]>)

  // Calculate max potential at each level
  const maxPerLevel = [3, 9, 27, 81, 243, 729]
  const totalMaxMembers = 1092

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading team data...</div>
      </div>
    )
  }

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
          <AddTestMembersButton />
        </div>
      </div>

      {/* Current Structure - PRIMARY FOCUS */}
      <Card className="mb-6 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-primary" />
            Current Structure Progress
          </CardTitle>
          <CardDescription className="text-base">
            Build your 3-wide, 6-deep structure to maximize earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Current Structure Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-3xl font-bold text-primary">{teamStats.totalMembers}/1092</p>
              <Progress value={(teamStats.totalMembers / 1092) * 100} className="h-2 mt-2" />
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Active Members</p>
              <p className="text-3xl font-bold">{teamStats.activeMembers}</p>
              <p className="text-xs text-muted-foreground mt-1">With subscription</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Monthly Earnings</p>
              <p className="text-3xl font-bold text-primary">${teamStats.totalMonthlyVolume.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-1">At current rate</p>
            </div>
          </div>

          {/* Level by Level Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Level Breakdown</h4>
            {[1, 2, 3, 4, 5, 6].map(level => {
              const members = groupedMembers[level] || []
              const maxAtLevel = maxPerLevel[level - 1]
              const percentage = (members.length / maxAtLevel) * 100
              
              return (
                <div key={level} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-medium">Level {level}</div>
                  <div className="flex-1">
                    <Progress value={percentage} className="h-3" />
                  </div>
                  <div className="w-24 text-right text-sm text-muted-foreground">
                    {members.length}/{maxAtLevel}
                  </div>
                </div>
              )
            })}
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

      {/* Qualification Status Alert */}
      {!teamStats.qualificationStatus && (
        <Card className="mb-6 border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-foreground">Unlock Your Earnings</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Refer {3 - teamStats.directReferralsCount} more {3 - teamStats.directReferralsCount === 1 ? 'person' : 'people'} to unlock residual income
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress 
              value={(teamStats.directReferralsCount / 3) * 100} 
              className="h-2 bg-muted"
            />
            <p className="text-sm text-muted-foreground mt-2">
              {teamStats.directReferralsCount}/3 direct referrals completed
            </p>
          </CardContent>
        </Card>
      )}

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

      {/* Main Content Tabs */}
      <Tabs defaultValue="structure" className="space-y-4">
        <TabsList>
          <TabsTrigger value="structure">Team Structure</TabsTrigger>
          <TabsTrigger value="direct">Direct Referrals</TabsTrigger>
          <TabsTrigger value="spillover">Spillover Tracking</TabsTrigger>
        </TabsList>

        {/* Team Structure Tab */}
        <TabsContent value="structure">
          <Card>
            <CardHeader>
              <CardTitle>Network Structure</CardTitle>
              <CardDescription>
                Your team organized by level (up to 6 levels deep, 3 wide per person)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(groupedMembers).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members in your team yet. Start inviting traders to build your network!
                </div>
              ) : (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6].map(level => {
                    const members = groupedMembers[level] || []
                    const maxAtLevel = maxPerLevel[level - 1]
                    const isExpanded = expandedLevels.has(level)
                    
                    return (
                      <div key={level} className="border rounded-lg">
                        <button
                          onClick={() => toggleLevel(level)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium">Level {level}</span>
                            <span className="text-sm text-muted-foreground">
                              {members.length}/{maxAtLevel} positions filled
                            </span>
                            <Progress 
                              value={(members.length / maxAtLevel) * 100} 
                              className="w-20 h-2 bg-muted"
                            />
                          </div>
                          <ChevronRight 
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </button>
                        
                        {isExpanded && members.length > 0 && (
                          <div className="border-t divide-y">
                            {members.map(member => (
                              <div key={member.id} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium">{member.name}</div>
                                    {member.is_direct_referral && (
                                      <Badge className="bg-primary/10 text-primary" variant="secondary">
                                        <Crown className="h-3 w-3 mr-1" />
                                        Direct
                                      </Badge>
                                    )}
                                    {member.spillover_from && (
                                      <Badge variant="outline" className="text-xs">
                                        <Sparkles className="h-3 w-3 mr-1" />
                                        Spillover
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">{member.email}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    member.subscription_status === 'active'
                                      ? 'bg-primary/10 text-primary'
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {member.subscription_status === 'active' ? 'Active' : 'Inactive'}
                                  </span>
                                  {member.referrals_count && member.referrals_count > 0 && (
                                    <span className="text-sm text-muted-foreground">
                                      {member.referrals_count} referral{member.referrals_count !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Direct Referrals Tab */}
        <TabsContent value="direct">
          <Card>
            <CardHeader>
              <CardTitle>Your Direct Referrals</CardTitle>
              <CardDescription>
                People you personally referred (earn $250 bonus for each)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {directReferrals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No direct referrals yet</p>
                  <p className="text-sm mt-2">Share your referral link to start earning bonuses</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[1, 2, 3].map(slot => {
                    const referral = directReferrals[slot - 1]
                    
                    return (
                      <div key={slot} className="border rounded-lg p-4">
                        {referral ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserCheck className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium">{referral.name}</div>
                                <div className="text-sm text-muted-foreground">{referral.email}</div>
                                <div className="text-xs text-muted-foreground/70 mt-1">
                                  Joined {new Date(referral.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className="bg-primary/10 text-primary">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                $250 Bonus
                              </Badge>
                              <div className="mt-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  referral.subscription_status === 'active'
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {referral.subscription_status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                <UserPlus className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="font-medium text-muted-foreground">Slot {slot} - Empty</div>
                                <div className="text-sm text-muted-foreground">Invite someone to fill this slot</div>
                              </div>
                            </div>
                            <Button variant="outline" size="sm">
                              <Share2 className="h-4 w-4 mr-2" />
                              Invite
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spillover Tab */}
        <TabsContent value="spillover">
          <Card>
            <CardHeader>
              <CardTitle>Spillover Tracking</CardTitle>
              <CardDescription>
                Members placed in your team from your upline&apos;s overflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamMembers.filter(m => m.spillover_from).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No spillover members yet</p>
                  <p className="text-sm mt-2">When your upline refers more than 3 people, extras will spill into your team</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {teamMembers.filter(m => m.spillover_from).map(member => (
                    <div key={member.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{member.name}</div>
                            <Badge variant="outline" className="text-xs">
                              Level {member.level}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                          <div className="text-xs text-muted-foreground/70 mt-1">
                            Spillover from your upline • Position {member.position}
                          </div>
                        </div>
                        <div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            member.subscription_status === 'active'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {member.subscription_status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}