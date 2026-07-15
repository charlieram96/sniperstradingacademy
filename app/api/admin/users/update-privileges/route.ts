import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdminAccess, requireAdminPrivilege } from "@/lib/admin/access-control"
import {
  ASSIGNABLE_ROLES,
  canManageTarget,
  hasPrivilege,
  isPrivilegeKey,
  roleRank,
  type PrivilegeKey,
} from "@/lib/admin/permissions"

// The DB enum user_role has no "user" label — "member" is the base role.
// Accept "user" from older clients as an alias and normalize before writing.
const VALID_ROLES: string[] = [...ASSIGNABLE_ROLES]

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
    // Superadmins may call this (the network page routes its member<->admin
    // toggle here); what each caller can actually change is narrowed by the
    // rank guards below.
    const auth = await requireAdminAccess("superadmin", "manage_privileges")
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { userId, role: rawRole, permissions } = body as {
      userId?: string
      role?: string
      permissions?: unknown
    }
    const role = rawRole === "user" ? "member" : rawRole

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    // Validate role
    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${VALID_ROLES.join(", ")}` },
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
      .select("id, role, permissions")
      .eq("id", userId)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 })
    }

    const actorRole = auth.ctx.role

    // Rank guard 1: actor must outrank the target at their CURRENT role
    // (superadmin+ may manage everyone, including peer superadmin+).
    if (!canManageTarget(actorRole, target.role)) {
      return NextResponse.json(
        { error: "You do not outrank this user, so you cannot modify their role or privileges." },
        { status: 403 }
      )
    }

    // Rank guard 2: actor may only ASSIGN roles they could manage.
    if (role !== undefined && !canManageTarget(actorRole, role)) {
      return NextResponse.json(
        { error: "You cannot assign a role at or above your own rank." },
        { status: 403 }
      )
    }

    // Rank guard 3: non-superadmin+ actors may only grant privileges they
    // themselves hold. Removing privileges is unrestricted.
    if (cleanedPermissions !== undefined && roleRank(actorRole) < roleRank("superadmin+")) {
      const current = new Set((target.permissions ?? []) as string[])
      const notHeld = cleanedPermissions.filter(
        (k) => !current.has(k) && !hasPrivilege(actorRole, auth.ctx.permissions, k as PrivilegeKey)
      )
      if (notHeld.length > 0) {
        return NextResponse.json(
          { error: `You cannot grant privileges you do not hold: ${notHeld.join(", ")}` },
          { status: 403 }
        )
      }
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
