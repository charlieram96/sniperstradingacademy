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

    const supabase = await createClient()

    // Find user by referral code
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, referral_code")
      .eq("referral_code", referralCode.toUpperCase())
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: "Invalid referral code" },
        { status: 404 }
      )
    }

    // Return user info (without sensitive data)
    return NextResponse.json({
      valid: true,
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
