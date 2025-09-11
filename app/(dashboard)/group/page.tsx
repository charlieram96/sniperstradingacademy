"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserPlus, TrendingUp, DollarSign, ChevronRight } from "lucide-react"

interface GroupMember {
  id: string
  name: string
  email: string
  level: number
  created_at: string
  subscription_status?: string
  referrals_count?: number
}

export default function GroupPage() {
  const { data: session } = useSession()
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [groupStats, setGroupStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalMonthlyRevenue: 0,
    levels: {} as Record<number, number>
  })
  const [loading, setLoading] = useState(true)
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([1]))

  useEffect(() => {
    if (session?.user?.id) {
      fetchGroupData()
    }
  }, [session])

  async function fetchGroupData() {
    const supabase = createClient()
    
    // Get all group members
    const { data: members } = await supabase
      .from("group_members")
      .select(`
        member_id,
        level,
        users!inner(
          id,
          name,
          email,
          created_at
        )
      `)
      .eq("group_owner_id", session?.user?.id)
      .order("level", { ascending: true })

    if (members) {
      // Get subscription status for each member
      const memberIds = members.map(m => m.member_id)
      
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("user_id, status")
        .in("user_id", memberIds)
        .eq("status", "active")

      const activeSubscribers = new Set(subscriptions?.map(s => s.user_id) || [])

      // Get referral counts for each member
      const { data: referralCounts } = await supabase
        .from("referrals")
        .select("referrer_id")
        .in("referrer_id", memberIds)
        .eq("status", "active")

      const referralCountMap = referralCounts?.reduce((acc, r) => {
        acc[r.referrer_id] = (acc[r.referrer_id] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      // Format member data
      const formattedMembers = members.map(m => ({
        id: m.users.id,
        name: m.users.name || "Unknown",
        email: m.users.email,
        level: m.level,
        created_at: m.users.created_at,
        subscription_status: activeSubscribers.has(m.users.id) ? "active" : "inactive",
        referrals_count: referralCountMap[m.users.id] || 0
      }))

      setGroupMembers(formattedMembers)

      // Calculate stats
      const levels = formattedMembers.reduce((acc, m) => {
        acc[m.level] = (acc[m.level] || 0) + 1
        return acc
      }, {} as Record<number, number>)

      const activeCount = formattedMembers.filter(m => m.subscription_status === "active").length

      setGroupStats({
        totalMembers: formattedMembers.length,
        activeMembers: activeCount,
        totalMonthlyRevenue: activeCount * 200,
        levels
      })
    }

    setLoading(false)
  }

  function toggleLevel(level: number) {
    const newExpanded = new Set(expandedLevels)
    if (newExpanded.has(level)) {
      newExpanded.delete(level)
    } else {
      newExpanded.add(level)
    }
    setExpandedLevels(newExpanded)
  }

  const groupedMembers = groupMembers.reduce((acc, member) => {
    if (!acc[member.level]) {
      acc[member.level] = []
    }
    acc[member.level].push(member)
    return acc
  }, {} as Record<number, GroupMember[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Trading Group</h1>
        <p className="text-gray-600 mt-2">View and manage your network of traders</p>
      </div>

      {/* Group Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupStats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              In your network
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupStats.activeMembers}</div>
            <p className="text-xs text-muted-foreground">
              Paying monthly
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${groupStats.totalMonthlyRevenue}</div>
            <p className="text-xs text-muted-foreground">
              Monthly total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Depth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(groupStats.levels).length}</div>
            <p className="text-xs text-muted-foreground">
              Referral levels
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Group Members Tree */}
      <Card>
        <CardHeader>
          <CardTitle>Network Members</CardTitle>
          <CardDescription>
            Your trading network organized by referral level
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedMembers).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No group members yet</p>
              <p className="text-sm mt-2">Share your referral link to grow your network</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedMembers)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([level, members]) => (
                  <div key={level} className="border rounded-lg">
                    <button
                      onClick={() => toggleLevel(Number(level))}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center">
                        <ChevronRight 
                          className={`h-4 w-4 mr-2 transition-transform ${
                            expandedLevels.has(Number(level)) ? "rotate-90" : ""
                          }`}
                        />
                        <span className="font-medium">
                          Level {level} ({members.length} member{members.length !== 1 ? "s" : ""})
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {members.filter(m => m.subscription_status === "active").length} active
                      </span>
                    </button>
                    
                    {expandedLevels.has(Number(level)) && (
                      <div className="border-t">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                            style={{ paddingLeft: `${(Number(level) + 1) * 1}rem` }}
                          >
                            <div className="flex-1">
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-gray-600">{member.email}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Joined {new Date(member.created_at).toLocaleDateString()}
                                {member.referrals_count > 0 && (
                                  <span className="ml-2">
                                    • {member.referrals_count} referral{member.referrals_count !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                member.subscription_status === "active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}>
                                {member.subscription_status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}