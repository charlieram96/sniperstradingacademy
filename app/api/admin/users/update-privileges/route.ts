import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdminPrivilege } from "@/lib/admin/access-control"
import { ASSIGNABLE_ROLES, isPrivilegeKey, type AdminRole } from "@/lib/admin/permissions"

// GET ?userId=xxx — current role + permissions for a single user
export async function GET(req: NextRequest) {
  const auth = await requireAdminPrivilege("manage_privileges")
  if (!auth.ok) return auth.response

  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  const { data: user, error } = await createServiceRoleClient()
    .from("users")
    .select("id, name, email, role, permissions")
    .eq("id", userId)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({ user: { ...user, permissions: user.permissions ?? [] } })
}

export async function POST(req: NextRequest) {
  try {
    // Only those who can manage privileges (superadmin+) may call this
    const auth = await requireAdminPrivilege("manage_privileges")
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { userId, role, permissions } = body as {
      userId?: string
      role?: string
      permissions?: unknown
    }

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    // Validate role
    if (role !== undefined && !ASSIGNABLE_ROLES.includes(role as AdminRole)) {
      return NextResponse.json(
        { error: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate permissions array
    let cleanedPermissions: string[] | undefined
    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || !permissions.every(isPrivilegeKey)) {
        return NextResponse.json(
          { error: "permissions must be an array of valid privilege keys" },
          { status: 400 }
        )
      }
      // De-duplicate
      cleanedPermissions = Array.from(new Set(permissions as string[]))
    }

    // Guard against self-lockout: a superadmin+ cannot demote their own base role.
    if (userId === auth.ctx.userId && role !== undefined && role !== "superadmin+") {
      return NextResponse.json(
        { error: "You cannot change your own base role." },
        { status: 400 }
      )
    }

    const serviceSupabase = createServiceRoleClient()

    // Ensure target exists
    const { data: target, error: targetError } = await serviceSupabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 })
    }

    const updates: { role?: string; permissions?: string[] } = {}
    if (role !== undefined) updates.role = role
    if (cleanedPermissions !== undefined) updates.permissions = cleanedPermissions

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data: updated, error: updateError } = await serviceSupabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select("id, role, permissions")
      .single()

    if (updateError) {
      console.error("Error updating privileges:", updateError)
      return NextResponse.json({ error: "Failed to update privileges" }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    console.error("update-privileges error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
