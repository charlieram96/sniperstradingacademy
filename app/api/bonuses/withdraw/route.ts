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

    const { bonusId } = await req.json()

    if (!bonusId) {
      return NextResponse.json(
        { error: "Bonus ID is required" },
        { status: 400 }
      )
    }

    // Get the bonus details
    const { data: bonus, error: bonusError } = await supabase
      .from("commissions")
      .select("id, referrer_id, amount, status, available_at, commission_type")
      .eq("id", bonusId)
      .eq("referrer_id", authUser.id) // Ensure user owns this bonus
      .eq("commission_type", "direct_bonus")
      .single()

    if (bonusError || !bonus) {
      return NextResponse.json(
        { error: "Bonus not found" },
        { status: 404 }
      )
    }

    // Check if bonus is already paid
    if (bonus.status === "paid") {
      return NextResponse.json(
        { error: "Bonus already withdrawn" },
        { status: 400 }
      )
    }

    // Check if 3-day holding period has passed
    const now = new Date()
    const availableAt = new Date(bonus.available_at)

    if (now < availableAt) {
      const hoursRemaining = Math.ceil((availableAt.getTime() - now.getTime()) / (1000 * 60 * 60))
      return NextResponse.json(
        { error: `Bonus will be available in ${hoursRemaining} hours` },
        { status: 400 }
      )
    }

    // Check if user is active
    const { data: user } = await supabase
      .from("users")
      .select("is_active, stripe_connect_account_id")
      .eq("id", authUser.id)
      .single()

    if (!user?.is_active) {
      return NextResponse.json(
        { error: "You must be an active member to withdraw bonuses" },
        { status: 400 }
      )
    }

    if (!user?.stripe_connect_account_id) {
      return NextResponse.json(
        { error: "No connected account found. Please complete bank account onboarding first." },
        { status: 400 }
      )
    }

    const stripe = getStripe()

    // Verify the connected account is ready
    const account = await stripe.accounts.retrieve(user.stripe_connect_account_id)

    if (!account.payouts_enabled) {
      return NextResponse.json(
        { error: "Your bank account is not yet verified. Please complete onboarding." },
        { status: 400 }
      )
    }

    // Create a transfer to the connected account
    const amountInCents = Math.round(bonus.amount * 100)
    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: "usd",
      destination: user.stripe_connect_account_id,
      transfer_group: `direct_bonus_${bonusId}`,
      metadata: {
        userId: authUser.id,
        bonusId: bonusId,
        type: "direct_bonus",
      },
    })

    // Update bonus status to paid
    const { error: updateError } = await supabase
      .from("commissions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        withdrawn_at: new Date().toISOString(),
      })
      .eq("id", bonusId)

    if (updateError) {
      console.error("Error updating bonus status:", updateError)
      // Transfer was successful but DB update failed - log for manual review
      return NextResponse.json({
        success: true,
        warning: "Transfer completed but status update failed. Contact support.",
        transfer_id: transfer.id,
        amount: bonus.amount,
      })
    }

    return NextResponse.json({
      success: true,
      transfer_id: transfer.id,
      amount: bonus.amount,
      message: `$${bonus.amount} transferred to your bank account`,
    })
  } catch (error) {
    console.error("Bonus withdrawal error:", error)
    return NextResponse.json(
      { error: "Failed to process withdrawal" },
      { status: 500 }
    )
  }
}
