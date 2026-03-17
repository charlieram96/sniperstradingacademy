import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const stripe = getStripe()

    // Check if user already has a connected account
    const { data: user } = await supabase
      .from("users")
      .select("stripe_connect_account_id, email, name")
      .eq("id", authUser.id)
      .single()

    let accountId = user?.stripe_connect_account_id

    // Create a new connected account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user?.email || authUser.email,
        metadata: {
          userId: authUser.id,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
      })

      accountId = account.id

      // Save the connected account ID to the database
      await supabase
        .from("users")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", authUser.id)
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${req.nextUrl.origin}/dashboard?connect_refresh=true`,
      return_url: `${req.nextUrl.origin}/dashboard?connect_success=true`,
      type: "account_onboarding",
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    console.error("Stripe Connect onboarding error:", error)
    return NextResponse.json(
      { error: "Failed to create onboarding session" },
      { status: 500 }
    )
  }
}

// GET endpoint to check Connect account status
export async function GET() {
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
      return NextResponse.json({ 
        connected: false,
        onboarded: false 
      })
    }

    const stripe = getStripe()
    
    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(user.stripe_connect_account_id)
    
    return NextResponse.json({
      connected: true,
      onboarded: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
      charges_enabled: account.charges_enabled,
      account: {
        id: account.id,
        email: account.email,
        created: account.created,
      }
    })
  } catch (error) {
    console.error("Error checking Connect account status:", error)
    return NextResponse.json(
      { error: "Failed to check account status" },
      { status: 500 }
    )
  }
}