import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/server"
import { createClient } from "@/lib/supabase/server"

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

    // Check if user is superadmin
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single()

    if (userData?.role !== "superadmin") {
      return NextResponse.json(
        { error: "Access denied. Superadmin only." },
        { status: 403 }
      )
    }

    const stripe = getStripe()

    // Get Stripe balance
    const balance = await stripe.balance.retrieve()

    // Get available balance in USD (amount is in cents)
    const availableBalance = balance.available.find(b => b.currency === 'usd')
    const pendingBalance = balance.pending.find(b => b.currency === 'usd')

    return NextResponse.json({
      available: availableBalance ? availableBalance.amount / 100 : 0,
      pending: pendingBalance ? pendingBalance.amount / 100 : 0,
      currency: 'usd',
    })
  } catch (error) {
    console.error("Error fetching Stripe balance:", error)
    return NextResponse.json(
      { error: "Failed to fetch Stripe balance" },
      { status: 500 }
    )
  }
}
