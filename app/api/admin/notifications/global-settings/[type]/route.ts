/**
 * UPDATE GLOBAL NOTIFICATION SETTING API
 *
 * Allows superadmins to toggle individual notification types globally
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { invalidateGlobalSettingsCache } from "@/lib/notifications/utils/global-settings-cache"
import { connection } from "@/lib/notifications/queue/notification-queue"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params

    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is superadmin
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single()

    if (userData?.role !== "superadmin") {
      return NextResponse.json(
        { error: "Access denied. Superadmin only." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { enabled, reason } = body as { enabled: boolean; reason?: string }

    // Validate notification type exists
    const { data: existingSetting } = await supabase
      .from("notification_global_settings")
      .select("id")
      .eq("notification_type", type)
      .single()

    if (!existingSetting) {
      return NextResponse.json(
        { error: `Unknown notification type: ${type}` },
        { status: 404 }
      )
    }

    // Update setting
    const { error: updateError } = await supabase
      .from("notification_global_settings")
      .update({
        enabled,
        disabled_reason: enabled ? null : reason,
        disabled_by: enabled ? null : authUser.id,
        disabled_at: enabled ? null : new Date().toISOString(),
        last_modified_by: authUser.id,
        last_modified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("notification_type", type)

    if (updateError) {
      console.error("Error updating setting:", updateError)
      return NextResponse.json(
        { error: "Failed to update setting" },
        { status: 500 }
      )
    }

    // Invalidate cache so changes take effect immediately
    await invalidateGlobalSettingsCache(connection)

    console.log({
      event: 'global_toggle_changed',
      notification_type: type,
      enabled: enabled,
      changed_by: authUser.id,
      reason: reason,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in update global settings API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
