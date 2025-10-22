import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
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
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "superadmin") {
    redirect("/dashboard")
  }

  // Fetch all users with network positions
  const { data: networkUsers, error: usersError } = await supabase
    .from("users")
    .select("id, email, name, network_position_id, network_level, network_position, tree_parent_network_position_id, is_active, created_at, initial_payment_completed, last_referral_branch")
    .not("network_position_id", "is", null)
    .order("network_level", { ascending: true })
    .order("network_position", { ascending: true })

  if (usersError) {
    console.error("Error fetching network users:", usersError)
  }

  // Group users by level
  const usersByLevel = (networkUsers || []).reduce((acc, user) => {
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
      />
    </div>
  )
}
