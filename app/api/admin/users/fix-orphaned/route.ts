import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

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
    const { user_id, referred_by } = body

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      )
    }

    // Get user from auth.users (need service role client for admin API)
    const adminClient = createServiceRoleClient()
    const { data: { user: authUser }, error: authUserError } = await adminClient.auth.admin.getUserById(user_id)

    if (authUserError || !authUser) {
      console.error("Error fetching auth user:", authUserError)
      return NextResponse.json(
        { error: "User not found in auth.users" },
        { status: 404 }
      )
    }

    // Check if user already exists in public.users
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", user_id)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists in public.users" },
        { status: 409 }
      )
    }

    // Determine referrer
    const ROOT_USER_ID = 'b10f0367-0471-4eab-9d15-db68b1ac4556'
    let finalReferredBy = referred_by || authUser.user_metadata?.referred_by || ROOT_USER_ID

    // Validate referrer exists if not root
    if (finalReferredBy !== ROOT_USER_ID) {
      const { data: referrerExists } = await supabase
        .from("users")
        .select("id")
        .eq("id", finalReferredBy)
        .single()

      if (!referrerExists) {
        console.warn(`Referrer ${finalReferredBy} not found, defaulting to root`)
        finalReferredBy = ROOT_USER_ID
      }
    }

    // Generate referral code
    const referralCode = Math.random().toString(36).substring(2, 10)

    // Create user in public.users
    const { error: insertError } = await supabase
      .from("users")
      .insert({
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.name || null,
        referred_by: finalReferredBy,
        referral_code: referralCode,
        initial_payment_completed: false,
        is_active: false,
      })

    if (insertError) {
      console.error("Error creating user in public.users:", insertError)
      return NextResponse.json(
        { error: `Failed to create user: ${insertError.message}` },
        { status: 500 }
      )
    }

    // Create referral record if referrer is not root
    if (finalReferredBy !== ROOT_USER_ID) {
      const { error: referralError } = await supabase
        .from("referrals")
        .insert({
          referrer_id: finalReferredBy,
          referred_id: authUser.id,
          status: "pending",
        })

      if (referralError) {
        console.error("Error creating referral record:", referralError)
        // Don't fail the whole operation, just log it
      }
    }

    console.log(`✅ Fixed orphaned user: ${authUser.email} (${authUser.id})`)
    console.log(`   Referred by: ${finalReferredBy}`)

    return NextResponse.json({
      success: true,
      message: "User fixed successfully",
      user: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.name,
        referred_by: finalReferredBy,
        referral_code: referralCode,
      }
    })

  } catch (error) {
    console.error("Error in fix orphaned user API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
