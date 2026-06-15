import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { hasPrivilege } from "@/lib/admin/permissions"
import { NetworkVisualizerClient } from "./network-visualizer-client"

export default async function NetworkVisualizerPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  // Check if user is superadmin
  const { data: userData } = await supabase
    .from("users")
    .select("role, permissions")
    .eq("id", user.id)
    .single()

  if (!hasPrivilege(userData?.role, userData?.permissions, "view_network_visualizer")) {
    redirect("/dashboard")
  }

  // Fetch all users with network positions
  const { data: networkUsersRaw, error: usersError } = await supabase
    .from("users")
    .select("id, email, name, network_position_id, network_level, network_position, tree_parent_network_position_id, is_active, created_at, initial_payment_completed, last_referral_branch, total_network_count, active_network_count, direct_referrals_count, active_direct_referrals_count, referred_by")
    .not("network_position_id", "is", null)
    .order("network_level", { ascending: true })
    .order("network_position", { ascending: true })

  if (usersError) {
    console.error("Error fetching network users:", usersError)
  }

  // Resolve each user's actual referrer (the person in their `referred_by` field).
  // We look these up directly by id rather than via a PostgREST embed, because the
  // embed traverses the foreign key in the reverse direction (it returns downline).
  // A referrer may not have a network position, so we query the ids explicitly.
  const referrerIds = Array.from(
    new Set((networkUsersRaw || []).map((u) => u.referred_by).filter((id): id is string => !!id))
  )

  const referrerMap = new Map<string, { name: string | null; network_position_id: string | null }>()
  if (referrerIds.length > 0) {
    const { data: referrers } = await supabase
      .from("users")
      .select("id, name, network_position_id")
      .in("id", referrerIds)

    for (const r of referrers || []) {
      referrerMap.set(r.id, { name: r.name, network_position_id: r.network_position_id })
    }
  }

  const networkUsers = (networkUsersRaw || []).map((u) => ({
    ...u,
    referrer: u.referred_by ? referrerMap.get(u.referred_by) ?? null : null,
  }))

  // Group users by level
  const usersByLevel = networkUsers.reduce((acc, user) => {
    const level = user.network_level || 0
    if (!acc[level]) {
      acc[level] = []
    }
    acc[level].push(user)
    return acc
  }, {} as Record<number, NonNullable<typeof networkUsers>>)

  return (
    <div className="max-w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Network Visualizer</h1>
        <p className="text-muted-foreground">View and explore the entire network structure</p>
      </div>

      <NetworkVisualizerClient
        usersByLevel={usersByLevel}
        totalUsers={networkUsers?.length || 0}
        viewerRole={userData?.role ?? null}
      />
    </div>
  )
}
