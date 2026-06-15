import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { roleRank } from "@/lib/admin/permissions"

export const runtime = "nodejs"

/**
 * GET /api/admin/users/[id]/auth-info
 * Returns whether a target user has an email/password identity
 * (used to gate admin password-reset UI for OAuth-only users).
 * Superadmin+ only.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: adminData } = await supabase
      .from("users")
      .select("role, permissions")
      .eq("id", user.id)
      .single()

    if (!(roleRank(adminData?.role) >= roleRank("superadmin+") || (adminData?.permissions ?? []).includes("manage_users"))) {
      return NextResponse.json({ error: "Forbidden - superadmin+ required" }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const adminClient = createServiceRoleClient()
    const { data: { user: targetUser }, error: targetError } = await adminClient.auth.admin.getUserById(id)

    if (targetError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const providers = (targetUser.identities ?? []).map((i) => i.provider)
    const has_password_login = providers.includes("email")

    return NextResponse.json({ has_password_login, providers })
  } catch (error) {
    console.error("[AuthInfo] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
