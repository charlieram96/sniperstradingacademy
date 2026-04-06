import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

/**
 * POST /api/admin/users/reset-password
 * Sends a password reset email to the target user. Superadmin+ only.
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
      .select("role, name")
      .eq("id", user.id)
      .single()

    if (adminData?.role !== "superadmin+") {
      return NextResponse.json({ error: "Forbidden - superadmin+ required" }, { status: 403 })
    }

    const { user_id } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    // Get the target user's email
    const adminClient = createServiceRoleClient()
    const { data: { user: targetUser }, error: targetError } = await adminClient.auth.admin.getUserById(user_id)

    if (targetError || !targetUser?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Send password reset email via Supabase
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: targetUser.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
      },
    })

    if (resetError) {
      console.error("[ResetPassword] Error generating reset link:", resetError)
      return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 })
    }

    // Audit log
    await supabase.from("crypto_audit_log").insert({
      event_type: "admin_action",
      admin_id: user.id,
      entity_type: "user",
      entity_id: user_id,
      details: {
        action: "password_reset_sent",
        target_email: targetUser.email,
        triggered_by: adminData?.name || user.email,
      },
    })

    return NextResponse.json({ success: true, message: `Password reset email sent to ${targetUser.email}` })
  } catch (error) {
    console.error("[ResetPassword] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
