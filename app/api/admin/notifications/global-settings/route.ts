/**
 * GLOBAL NOTIFICATION SETTINGS API
 *
 * Allows superadmins to view and manage global notification toggles
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
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

    // Fetch all global settings
    const { data: settings, error: settingsError } = await supabase
      .from("notification_global_settings")
      .select(`
        *,
        disabled_by_user:disabled_by(id, name, email),
        last_modified_by_user:last_modified_by(id, name, email)
      `)
      .order("notification_type", { ascending: true })

    if (settingsError) {
      console.error("Error fetching global settings:", settingsError)
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      )
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Error in global settings API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
