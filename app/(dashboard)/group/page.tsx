"use client"

import { useState, useEffect, useCallback } from "react"
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

  const fetchGroupData = useCallback(async () => {
    if (!session?.user?.id) return
    
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
      .eq("group_owner_id", session.user.id)
      .order("level", { ascending: true })

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
          referrals_count: referralCountMap[user.id] || 0
        }
      })

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
  }, [session?.user?.id])

  useEffect(() => {
    fetchGroupData()
  }, [fetchGroupData])

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
        <div className="text-gray-500">Loading group data...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Your Trading Group</h1>
        <p className="text-gray-600 mt-2">
          View and manage your network of traders across all levels
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              <Users className="h-4 w-4 inline mr-2" />
              Total Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupStats.totalMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              <UserPlus className="h-4 w-4 inline mr-2" />
              Active Subscribers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupStats.activeMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              <DollarSign className="h-4 w-4 inline mr-2" />
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${groupStats.totalMonthlyRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              <TrendingUp className="h-4 w-4 inline mr-2" />
              Your Commission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${(groupStats.totalMonthlyRevenue * 0.1).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members by Level */}
      <Card>
        <CardHeader>
          <CardTitle>Network Structure</CardTitle>
          <CardDescription>
            Members organized by level (up to 6 levels deep)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedMembers).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No members in your group yet. Start inviting traders to build your network!
            </div>
          ) : (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map(level => {
                const members = groupedMembers[level] || []
                const isExpanded = expandedLevels.has(level)
                
                return (
                  <div key={level} className="border rounded-lg">
                    <button
                      onClick={() => toggleLevel(level)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">Level {level}</span>
                        <span className="text-sm text-gray-500">
                          {members.length} member{members.length !== 1 ? 's' : ''}
                        </span>
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
                              <div className="font-medium">{member.name}</div>
                              <div className="text-sm text-gray-500">{member.email}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                member.subscription_status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {member.subscription_status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                              {member.referrals_count && member.referrals_count > 0 && (
                                <span className="text-sm text-gray-500">
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
    </div>
  )
}