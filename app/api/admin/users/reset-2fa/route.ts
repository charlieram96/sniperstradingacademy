import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { roleRank } from "@/lib/admin/permissions"

/**
 * POST /api/admin/users/reset-2fa
 * Removes all MFA factors for a user, effectively resetting their 2FA. Superadmin+ only.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: adminData } = await supabase
      .from("users")
      .select("role, name, permissions")
      .eq("id", user.id)
      .single()

    if (!(roleRank(adminData?.role) >= roleRank("superadmin+") || (adminData?.permissions ?? []).includes("manage_users"))) {
      return NextResponse.json({ error: "Forbidden - superadmin+ required" }, { status: 403 })
    }

    const { user_id } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    // Get target user info for audit logging
    const adminClient = createServiceRoleClient()
    const { data: { user: targetUser }, error: targetError } = await adminClient.auth.admin.getUserById(user_id)

    if (targetError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Remove all MFA factors via database function
    const { data: deletedCount, error: resetError } = await adminClient
      .rpc("admin_reset_2fa", { p_user_id: user_id })

    if (resetError) {
      console.error("[Reset2FA] Error resetting 2FA:", resetError)
      return NextResponse.json({ error: "Failed to reset 2FA" }, { status: 500 })
    }

    const removed = deletedCount || 0

    // Audit log
    await supabase.from("crypto_audit_log").insert({
      event_type: "admin_action",
      admin_id: user.id,
      entity_type: "user",
      entity_id: user_id,
      details: {
        action: "2fa_reset",
        target_email: targetUser.email,
        factors_removed: removed,
        triggered_by: adminData?.name || user.email,
      },
    })

    if (removed === 0) {
      return NextResponse.json({ success: true, message: "User has no 2FA factors enrolled" })
    }

    return NextResponse.json({
      success: true,
      message: `Removed ${removed} 2FA factor${removed !== 1 ? "s" : ""} for ${targetUser.email}`,
    })
  } catch (error) {
    console.error("[Reset2FA] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
