import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hasPrivilege, roleRank, type AdminRole, type PrivilegeKey } from "@/lib/admin/permissions"

export interface AdminContext {
  userId: string
  role: string | null
  permissions: string[]
}

type RequireResult =
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse }

/**
 * Server-side guard for admin API routes. Returns the caller's admin context when
 * they hold `privilege` (via role floor OR explicit grant), otherwise a 401/403
 * NextResponse to return immediately.
 *
 * Usage:
 *   const auth = await requireAdminPrivilege("view_transaction_logs")
 *   if (!auth.ok) return auth.response
 *   const { userId, role, permissions } = auth.ctx
 */
export async function requireAdminPrivilege(privilege: PrivilegeKey): Promise<RequireResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role, permissions")
    .eq("id", user.id)
    .single()

  const role = userData?.role ?? null
  const permissions = (userData?.permissions ?? []) as string[]

  if (!hasPrivilege(role, permissions, privilege)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, ctx: { userId: user.id, role, permissions } }
}

/**
 * Floor-preserving guard. Grants access when the caller's role meets `minRole`
 * (the route's existing role floor) OR holds `privilege` explicitly. Use this when
 * wiring an existing admin route so role-based access is never removed and granular
 * grants only ADD access.
 */
export async function requireAdminAccess(minRole: AdminRole, privilege: PrivilegeKey): Promise<RequireResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role, permissions")
    .eq("id", user.id)
    .single()

  const role = userData?.role ?? null
  const permissions = (userData?.permissions ?? []) as string[]

  const allowed = roleRank(role) >= roleRank(minRole) || permissions.includes(privilege)
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, ctx: { userId: user.id, role, permissions } }
}
