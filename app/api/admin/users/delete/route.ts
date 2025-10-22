import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Check authentication and authorization
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is superadmin
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden - Superadmin only" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { userId, deletionReason } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Call database function to check downline and delete
    const { data: result, error: dbError } = await supabase
      .rpc("delete_user_and_cleanup", {
        p_user_id: userId,
        p_deleted_by: user.id,
        p_deletion_reason: deletionReason || null
      })

    if (dbError) {
      console.error("Database error during user deletion:", dbError)
      return NextResponse.json({
        success: false,
        error: dbError.message
      }, { status: 500 })
    }

    // Check if deletion was successful
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    // If successful, also delete from auth.users using Supabase Admin API
    try {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)

      if (authDeleteError) {
        console.error("Auth deletion error:", authDeleteError)
        // User is deleted from public.users but not from auth - log this
        // Consider this a partial success
        return NextResponse.json({
          success: true,
          message: "User deleted from database, but auth deletion failed",
          warning: authDeleteError.message
        })
      }
    } catch (authError) {
      console.error("Error calling auth admin API:", authError)
      // Continue - main deletion succeeded
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error("Error in delete user API:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error"
      },
      { status: 500 }
    )
  }
}
