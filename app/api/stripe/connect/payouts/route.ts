import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getStripe } from "@/lib/stripe/server"
import { createClient } from "@/lib/supabase/server"

// Create a manual payout (for testing or manual trigger)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { amount } = await req.json()
    
    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: "Invalid amount (minimum $1.00)" },
        { status: 400 }
      )
    }

    const stripe = getStripe()
    const supabase = await createClient()
    
    // Get user's connected account ID
    const { data: user } = await supabase
      .from("users")
      .select("stripe_connect_account_id")
      .eq("id", session.user.id)
      .single()

    if (!user?.stripe_connect_account_id) {
      return NextResponse.json(
        { error: "No connected account found. Please complete onboarding first." },
        { status: 400 }
      )
    }

    // Create a transfer to the connected account
    const transfer = await stripe.transfers.create({
      amount: amount, // Amount in cents
      currency: "usd",
      destination: user.stripe_connect_account_id,
      transfer_group: `commission_${session.user.id}_${Date.now()}`,
      metadata: {
        userId: session.user.id,
        type: "commission",
      },
    })

    // Record the payout in database
    await supabase
      .from("commissions")
      .insert({
        referrer_id: session.user.id,
        referred_id: session.user.id, // Self for manual payouts
        amount: amount / 100, // Convert to dollars for DB
        status: "paid",
        paid_at: new Date().toISOString(),
      })

    return NextResponse.json({
      success: true,
      transfer_id: transfer.id,
      amount: transfer.amount,
      destination: transfer.destination,
    })
  } catch (error) {
    console.error("Payout error:", error)
    return NextResponse.json(
      { error: "Failed to process payout" },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve payout history
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    
    // Get user's connected account ID
    const { data: user } = await supabase
      .from("users")
      .select("stripe_connect_account_id")
      .eq("id", session.user.id)
      .single()

    if (!user?.stripe_connect_account_id) {
      return NextResponse.json({ payouts: [] })
    }

    const stripe = getStripe()
    
    // Get payouts from Stripe
    const payouts = await stripe.payouts.list(
      {
        limit: 10,
      },
      {
        stripeAccount: user.stripe_connect_account_id,
      }
    )

    return NextResponse.json({
      payouts: payouts.data.map(payout => ({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        arrival_date: payout.arrival_date,
        status: payout.status,
        type: payout.type,
        created: payout.created,
      }))
    })
  } catch (error) {
    console.error("Error fetching payouts:", error)
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    )
  }
}