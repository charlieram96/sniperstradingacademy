import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ROOT_USER_ID = 'b10f0367-0471-4eab-9d15-db68b1ac4556'

export async function POST(request: NextRequest) {
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

    const { referralCode } = await request.json()

    if (!referralCode) {
      return NextResponse.json(
        { error: "Referral code is required" },
        { status: 400 }
      )
    }

    const codeUpperCase = referralCode.toUpperCase()

    // Find referrer by referral code (case-insensitive)
    const { data: referrer, error: referrerError } = await supabase
      .from("users")
      .select("id, name, email, referral_code, initial_payment_completed, bypass_initial_payment")
      .ilike("referral_code", codeUpperCase)
      .single()

    if (referrerError || !referrer) {
      return NextResponse.json(
        { error: "Invalid referral code" },
        { status: 404 }
      )
    }

    // Check if referrer is active (has paid or has bypass)
    const isReferrerActive = referrer.initial_payment_completed || referrer.bypass_initial_payment
    if (!isReferrerActive) {
      return NextResponse.json(
        { error: "This referral code is from an inactive account. Please ask your referrer to activate their account first, or use a different referral code." },
        { status: 403 }
      )
    }

    // Cannot refer yourself
    if (referrer.id === user.id) {
      return NextResponse.json(
        { error: "You cannot use your own referral code" },
        { status: 400 }
      )
    }

    // Get user's current data
    const { data: currentUser, error: currentUserError } = await supabase
      .from("users")
      .select("referred_by, initial_payment_completed")
      .eq("id", user.id)
      .single()

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Only allow changing referral if user hasn't paid yet
    if (currentUser.initial_payment_completed) {
      return NextResponse.json(
        { error: "Cannot change referral after initial payment is completed" },
        { status: 400 }
      )
    }

    const oldReferrerId = currentUser.referred_by

    // Update user's referred_by
    const { error: updateError } = await supabase
      .from("users")
      .update({ referred_by: referrer.id })
      .eq("id", user.id)

    if (updateError) {
      console.error("Error updating user referred_by:", updateError)
      return NextResponse.json(
        { error: "Failed to update referral" },
        { status: 500 }
      )
    }

    // Delete old referral record if exists
    if (oldReferrerId) {
      await supabase
        .from("referrals")
        .delete()
        .eq("referrer_id", oldReferrerId)
        .eq("referred_id", user.id)
    }

    // Create new referral record
    const { error: referralError } = await supabase
      .from("referrals")
      .insert({
        referrer_id: referrer.id,
        referred_id: user.id,
        status: "pending",
        level: 1
      })

    if (referralError) {
      // Log but don't fail - the trigger should have created this
      console.error("Error creating referral record:", referralError)
    }

    return NextResponse.json({
      success: true,
      referrer: {
        id: referrer.id,
        name: referrer.name,
        email: referrer.email,
      },
      message: "Referral updated successfully"
    })
  } catch (error) {
    console.error("Error updating referral:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
