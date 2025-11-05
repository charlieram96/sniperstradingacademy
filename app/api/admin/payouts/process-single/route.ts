import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    // Use regular client for authentication
    const authSupabase = await createClient()
    const { data: { user: authUser }, error: authError } = await authSupabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is superadmin
    const { data: userData } = await authSupabase
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

    // Use service role client for database operations (bypasses RLS)
    const supabase = createServiceRoleClient()

    const { commissionId } = await req.json()

    if (!commissionId) {
      return NextResponse.json(
        { error: "Commission ID is required" },
        { status: 400 }
      )
    }

    // Get commission details
    const { data: commission, error: commissionError } = await supabase
      .from("commissions")
      .select(`
        id,
        referrer_id,
        amount,
        status,
        retry_count,
        users!commissions_referrer_id_fkey (
          name,
          email,
          stripe_connect_account_id
        )
      `)
      .eq("id", commissionId)
      .single()

    if (commissionError || !commission) {
      return NextResponse.json(
        { error: "Commission not found" },
        { status: 404 }
      )
    }

    // Check if already paid (prevent double payout)
    if (commission.status === "paid") {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: "This commission has already been paid",
        commissionId: commission.id,
      })
    }

    const user = Array.isArray(commission.users) ? commission.users[0] : commission.users

    // Validate user has Stripe Connect account
    if (!user?.stripe_connect_account_id) {
      const errorMsg = "User does not have a Stripe Connect account"

      // Update commission with error
      await supabase
        .from("commissions")
        .update({
          error_message: errorMsg,
          processed_at: new Date().toISOString(),
          retry_count: (commission.retry_count || 0) + 1,
        })
        .eq("id", commissionId)

      return NextResponse.json({
        success: false,
        error: errorMsg,
        commissionId: commission.id,
      })
    }

    const stripe = getStripe()

    // Verify the connected account is ready
    try {
      const account = await stripe.accounts.retrieve(user.stripe_connect_account_id)

      if (!account.payouts_enabled) {
        const errorMsg = "User's bank account is not verified - payouts disabled"

        await supabase
          .from("commissions")
          .update({
            error_message: errorMsg,
            processed_at: new Date().toISOString(),
            retry_count: (commission.retry_count || 0) + 1,
          })
          .eq("id", commissionId)

        return NextResponse.json({
          success: false,
          error: errorMsg,
          commissionId: commission.id,
        })
      }
    } catch (stripeError) {
      const errorMsg = `Stripe account error: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`

      await supabase
        .from("commissions")
        .update({
          error_message: errorMsg,
          processed_at: new Date().toISOString(),
          retry_count: (commission.retry_count || 0) + 1,
        })
        .eq("id", commissionId)

      return NextResponse.json({
        success: false,
        error: errorMsg,
        commissionId: commission.id,
      })
    }

    // Create Stripe transfer
    // Apply 3.5% Stripe transaction fee (pass-through cost, not markup)
    const FEE_PERCENTAGE = 0.035
    const grossAmount = parseFloat(commission.amount)
    const feeAmount = grossAmount * FEE_PERCENTAGE
    const netAmount = grossAmount - feeAmount
    const amountInCents = Math.round(netAmount * 100)

    try {
      const transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: "usd",
        destination: user.stripe_connect_account_id,
        transfer_group: `residual_${commissionId}`,
        metadata: {
          userId: commission.referrer_id,
          commissionId: commissionId,
          type: "residual_monthly",
        },
      })

      // Update commission as paid
      const { error: updateError } = await supabase
        .from("commissions")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          stripe_transfer_id: transfer.id,
          error_message: null, // Clear any previous error
        })
        .eq("id", commissionId)

      if (updateError) {
        console.error("Error updating commission status:", updateError)
        return NextResponse.json({
          success: false,
          error: "Transfer completed but database update failed. Please check logs.",
          details: updateError.message,
          transferId: transfer.id,
          commissionId: commission.id,
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        transferId: transfer.id,
        commissionId: commission.id,
        grossAmount: grossAmount,
        netAmount: netAmount,
        feeAmount: feeAmount,
        amount: netAmount, // For backward compatibility
        userName: user.name,
      })
    } catch (stripeError) {
      const errorMsg = `Stripe transfer failed: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`

      await supabase
        .from("commissions")
        .update({
          error_message: errorMsg,
          processed_at: new Date().toISOString(),
          retry_count: (commission.retry_count || 0) + 1,
        })
        .eq("id", commissionId)

      return NextResponse.json({
        success: false,
        error: errorMsg,
        commissionId: commission.id,
      })
    }
  } catch (error) {
    console.error("Error processing payout:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
