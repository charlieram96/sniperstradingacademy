import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/server"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get user's connected account ID
    const { data: user } = await supabase
      .from("users")
      .select("stripe_connect_account_id")
      .eq("id", authUser.id)
      .single()

    if (!user?.stripe_connect_account_id) {
      return NextResponse.json(
        { error: "No connected account found. Please complete onboarding first." },
        { status: 400 }
      )
    }

    const stripe = getStripe()

    // Verify the account is fully onboarded
    const account = await stripe.accounts.retrieve(user.stripe_connect_account_id)

    if (!account.details_submitted) {
      return NextResponse.json(
        { error: "Please complete bank account onboarding first" },
        { status: 400 }
      )
    }

    // Create a login link for the Stripe Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(user.stripe_connect_account_id)

    return NextResponse.json({
      url: loginLink.url,
    })
  } catch (error) {
    console.error("Stripe dashboard link error:", error)
    return NextResponse.json(
      { error: "Failed to create dashboard link" },
      { status: 500 }
    )
  }
}
