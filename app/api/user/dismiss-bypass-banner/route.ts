import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Update user's bypass_banner_dismissed flag
    const { error: updateError } = await supabase
      .from("users")
      .update({ bypass_banner_dismissed: true })
      .eq("id", user.id)

    if (updateError) {
      console.error("Error dismissing bypass banner:", updateError)
      return NextResponse.json(
        { error: "Failed to dismiss banner" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Exception dismissing bypass banner:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
