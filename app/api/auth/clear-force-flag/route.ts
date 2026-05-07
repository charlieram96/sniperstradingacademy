import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * POST /api/auth/clear-force-flag
 * Clears users.force_password_change for the authenticated caller.
 * Called by /reset-password after a forced password change succeeds.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createServiceRoleClient()
    const { error: updateError } = await adminClient
      .from("users")
      .update({ force_password_change: false })
      .eq("id", user.id)

    if (updateError) {
      console.error("[ClearForceFlag] update error:", updateError)
      return NextResponse.json({ error: "Failed to clear flag" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[ClearForceFlag] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
