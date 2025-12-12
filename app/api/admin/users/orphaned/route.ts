import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
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

    if (userData?.role !== "superadmin" && userData?.role !== "superadmin+") {
      return NextResponse.json(
        { error: "Forbidden - Superadmin access required" },
        { status: 403 }
      )
    }

    // Get all users from auth.users (need to use service role client for admin API)
    const adminClient = createServiceRoleClient()
    const { data: { users: authUsers }, error: authUsersError } = await adminClient.auth.admin.listUsers()

    if (authUsersError) {
      console.error("Error fetching auth users:", authUsersError)
      return NextResponse.json(
        { error: "Failed to fetch auth users" },
        { status: 500 }
      )
    }

    // Get all user IDs from public.users
    const { data: publicUsers, error: publicUsersError } = await supabase
      .from("users")
      .select("id")

    if (publicUsersError) {
      console.error("Error fetching public users:", publicUsersError)
      return NextResponse.json(
        { error: "Failed to fetch public users" },
        { status: 500 }
      )
    }

    const publicUserIds = new Set(publicUsers?.map(u => u.id) || [])

    // Find orphaned users (in auth but not in public)
    const orphanedUsers = authUsers
      .filter(authUser => !publicUserIds.has(authUser.id))
      .map(authUser => ({
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.name || null,
        created_at: authUser.created_at,
        email_confirmed_at: authUser.email_confirmed_at,
        last_sign_in_at: authUser.last_sign_in_at,
        referred_by: authUser.user_metadata?.referred_by || null,
        provider: authUser.app_metadata?.provider || 'email',
      }))

    return NextResponse.json({
      orphanedUsers,
      count: orphanedUsers.length
    })

  } catch (error) {
    console.error("Error in orphaned users API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
