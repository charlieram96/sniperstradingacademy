import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { referralCode } = await request.json()

    if (!referralCode) {
      return NextResponse.json(
        { error: "Referral code is required" },
        { status: 400 }
      )
    }

    const codeUpperCase = referralCode.toUpperCase()

    // Check for bypass code (for principal/root user)
    if (codeUpperCase === "PRINCIPAL" || codeUpperCase === "SKIP" || codeUpperCase === "ROOT") {
      return NextResponse.json({
        valid: true,
        bypass: true,
        user: null,
        message: "Bypass code accepted - user will be assigned as root/principal user"
      })
    }

    const supabase = await createClient()

    // Find user by referral code (case-insensitive)
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, referral_code, initial_payment_completed, bypass_initial_payment")
      .ilike("referral_code", codeUpperCase)
      .single()

    if (error || !user) {
      console.error("Referral code not found:", { code: codeUpperCase, error })
      return NextResponse.json(
        { error: "Invalid referral code" },
        { status: 404 }
      )
    }

    // Check if referrer is active (has paid or has bypass)
    const isReferrerActive = user.initial_payment_completed || user.bypass_initial_payment
    if (!isReferrerActive) {
      console.log("Referral code from inactive user:", { code: codeUpperCase, userId: user.id })
      return NextResponse.json(
        { error: "This referral code is from an inactive account. Please ask your referrer to activate their account first, or use a different referral code." },
        { status: 403 }
      )
    }

    // Return user info (without sensitive data)
    return NextResponse.json({
      valid: true,
      bypass: false,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        referralCode: user.referral_code,
      },
    })
  } catch (error) {
    console.error("Error validating referral code:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
