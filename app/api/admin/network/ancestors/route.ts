import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getParentPositionId, parseNetworkPositionId } from "@/lib/network-positions"

export const runtime = "nodejs"

/**
 * GET /api/admin/network/ancestors?positionId=L008P0000004503
 *
 * Returns the full ancestor chain (from the given position up to and
 * including root). Used by the reassign dialog to populate the
 * "new sponsor" dropdown — sponsor must be an ancestor of the new position.
 *
 * The response includes the starting position itself so the admin can
 * pick the new tree parent as the sponsor.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: adminRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (adminRow?.role !== "superadmin" && adminRow?.role !== "superadmin+") {
    return NextResponse.json({ error: "Forbidden - Superadmin only" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const positionId = searchParams.get("positionId")
  if (!positionId) {
    return NextResponse.json({ error: "positionId is required" }, { status: 400 })
  }

  try {
    parseNetworkPositionId(positionId)
  } catch {
    return NextResponse.json({ error: "Invalid positionId" }, { status: 400 })
  }

  const chain: string[] = []
  let current: string | null = positionId
  const MAX_DEPTH = 50
  let guard = 0
  while (current && guard < MAX_DEPTH) {
    chain.push(current)
    current = getParentPositionId(current)
    guard += 1
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("id, name, email, network_position_id, network_level, network_position")
    .in("network_position_id", chain)

  if (error) {
    console.error("[AncestorsAPI] fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch ancestors" }, { status: 500 })
  }

  const byPosition = new Map(users?.map(u => [u.network_position_id, u]) ?? [])
  const ancestors = chain
    .map(pos => byPosition.get(pos))
    .filter((u): u is NonNullable<typeof u> => !!u)

  return NextResponse.json({ ancestors })
}
