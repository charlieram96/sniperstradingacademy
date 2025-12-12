import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { calculateChildPositions, formatNetworkPositionId, parseNetworkPositionId } from "@/lib/network-positions"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Check authentication and authorization
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is superadmin
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "superadmin" && userData?.role !== "superadmin+") {
    return NextResponse.json({ error: "Forbidden - Superadmin only" }, { status: 403 })
  }

  // Get position ID from query params
  const { searchParams } = new URL(request.url)
  const positionId = searchParams.get("positionId")

  if (!positionId) {
    return NextResponse.json({ error: "Position ID is required" }, { status: 400 })
  }

  try {
    // Parse the position
    const { level, position } = parseNetworkPositionId(positionId)

    // Calculate the 3 child positions
    const childPositions = calculateChildPositions(position)
    const childLevel = level + 1

    // Create position IDs for all 3 children
    const childPositionIds = childPositions.map(pos =>
      formatNetworkPositionId(childLevel, pos)
    )

    // Fetch users at these positions
    const { data: children, error } = await supabase
      .from("users")
      .select("id, email, name, network_position_id, network_level, network_position, is_active, created_at, initial_payment_completed")
      .in("network_position_id", childPositionIds)
      .order("network_position", { ascending: true })

    if (error) {
      console.error("Error fetching children:", error)
      return NextResponse.json({ error: "Failed to fetch children" }, { status: 500 })
    }

    // Create result with all 3 positions (occupied or empty)
    const result = childPositionIds.map((childPosId, index) => {
      const user = children?.find(u => u.network_position_id === childPosId)
      return {
        positionId: childPosId,
        position: childPositions[index],
        branch: (index + 1) as 1 | 2 | 3,
        occupied: !!user,
        user: user || null
      }
    })

    return NextResponse.json({ children: result })
  } catch (error) {
    console.error("Error processing request:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
