import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Get the first user (user #1) ordered by created_at
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, referral_code")
      .order("created_at", { ascending: true })
      .limit(1)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: "Default referral user not found" },
        { status: 404 }
      )
    }

    // Return user info
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        referralCode: user.referral_code,
      },
    })
  } catch (error) {
    console.error("Error getting default referral:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
