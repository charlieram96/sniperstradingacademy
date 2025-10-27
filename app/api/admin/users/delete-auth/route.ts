import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is superadmin
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (userData?.role !== "superadmin") {
      return NextResponse.json(
        { error: "Forbidden - Superadmin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { user_id, email_confirmation } = body

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      )
    }

    // Get user from auth.users to verify email matches
    const { data: { user: authUser }, error: authUserError } = await supabase.auth.admin.getUserById(user_id)

    if (authUserError || !authUser) {
      console.error("Error fetching auth user:", authUserError)
      return NextResponse.json(
        { error: "User not found in auth.users" },
        { status: 404 }
      )
    }

    // Verify email confirmation matches
    if (email_confirmation !== authUser.email) {
      return NextResponse.json(
        { error: "Email confirmation does not match" },
        { status: 400 }
      )
    }

    // Check if user exists in public.users (shouldn't if orphaned, but check anyway)
    const { data: publicUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", user_id)
      .single()

    if (publicUser) {
      return NextResponse.json(
        { error: "User exists in public.users. Use the regular delete function instead." },
        { status: 400 }
      )
    }

    // Delete user from auth.users using admin API
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id)

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError)
      return NextResponse.json(
        { error: `Failed to delete user: ${deleteError.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ Deleted orphaned auth user: ${authUser.email} (${authUser.id})`)

    return NextResponse.json({
      success: true,
      message: "User deleted successfully from auth.users",
      email: authUser.email
    })

  } catch (error) {
    console.error("Error in delete auth user API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
