import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { notifyPayoutProcessed, notifyPayoutFailed } from '@/lib/notifications/notification-service'

const MAX_MANUAL_PAYOUT_AMOUNT = 2000
const FEE_PERCENTAGE = 0.035 // 3.5% Stripe fee

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

    // Parse request body
    const { userId, amount, description } = await req.json()

    // Validate inputs
    if (!userId || !amount || !description) {
      return NextResponse.json(
        { error: "userId, amount, and description are required" },
        { status: 400 }
      )
    }

    const amountNumber = parseFloat(amount)

    if (isNaN(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      )
    }

    if (amountNumber > MAX_MANUAL_PAYOUT_AMOUNT) {
      return NextResponse.json(
        { error: `Amount cannot exceed $${MAX_MANUAL_PAYOUT_AMOUNT.toLocaleString()}` },
        { status: 400 }
      )
    }

    if (typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Description is required for manual payouts" },
        { status: 400 }
      )
    }

    // Get recipient user details
    const { data: recipientUser, error: userError } = await supabase
      .from("users")
      .select("id, name, email, stripe_connect_account_id")
      .eq("id", userId)
      .single()

    if (userError || !recipientUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Validate user has Stripe Connect account
    if (!recipientUser.stripe_connect_account_id) {
      return NextResponse.json(
        { error: "User does not have a Stripe Connect account" },
        { status: 400 }
      )
    }

    const stripe = getStripe()

    // Verify the connected account is ready for payouts
    try {
      const account = await stripe.accounts.retrieve(recipientUser.stripe_connect_account_id)

      if (!account.payouts_enabled) {
        return NextResponse.json(
          { error: "User's bank account is not verified - payouts disabled" },
          { status: 400 }
        )
      }
    } catch (stripeError) {
      const errorMsg = stripeError instanceof Error ? stripeError.message : 'Unknown error'
      return NextResponse.json(
        { error: `Stripe account error: ${errorMsg}` },
        { status: 400 }
      )
    }

    // Calculate fees and net amount
    const grossAmount = amountNumber
    const feeAmount = grossAmount * FEE_PERCENTAGE
    const netAmount = grossAmount - feeAmount
    const amountInCents = Math.round(netAmount * 100)

    // First create the commission record
    const { data: newCommission, error: commissionError } = await supabase
      .from("commissions")
      .insert({
        referrer_id: userId,
        referred_id: userId, // For manual payouts, set same as referrer
        amount: grossAmount,
        commission_type: "manual_payout",
        status: "pending", // Will be updated to 'paid' after successful transfer
        description: description.trim(),
        created_by_admin_id: authUser.id,
      })
      .select("id")
      .single()

    if (commissionError || !newCommission) {
      console.error("Error creating commission record:", commissionError)
      return NextResponse.json(
        { error: "Failed to create commission record" },
        { status: 500 }
      )
    }

    const commissionId = newCommission.id

    // Create Stripe transfer
    try {
      const transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: "usd",
        destination: recipientUser.stripe_connect_account_id,
        transfer_group: `manual_payout_${commissionId}`,
        metadata: {
          userId: userId,
          commissionId: commissionId,
          type: "manual_payout",
          description: description.substring(0, 500), // Stripe metadata has limits
          createdByAdminId: authUser.id,
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
        })
        .eq("id", commissionId)

      if (updateError) {
        console.error("Error updating commission status:", updateError)
        return NextResponse.json({
          success: false,
          error: "Transfer completed but database update failed. Please check logs.",
          details: updateError.message,
          transferId: transfer.id,
          commissionId: commissionId,
        }, { status: 500 })
      }

      // Send success notification
      await notifyPayoutProcessed({
        userId: userId,
        amount: grossAmount,
        commissionType: 'manual_payout',
        payoutId: commissionId
      })

      return NextResponse.json({
        success: true,
        transferId: transfer.id,
        commissionId: commissionId,
        grossAmount: grossAmount,
        netAmount: netAmount,
        feeAmount: feeAmount,
        userName: recipientUser.name,
        userEmail: recipientUser.email,
        description: description.trim(),
      })
    } catch (stripeError) {
      const errorMsg = stripeError instanceof Error ? stripeError.message : 'Unknown error'

      // Update commission with error
      await supabase
        .from("commissions")
        .update({
          status: "cancelled",
          error_message: `Stripe transfer failed: ${errorMsg}`,
          processed_at: new Date().toISOString(),
        })
        .eq("id", commissionId)

      // Send failure notification
      await notifyPayoutFailed({
        userId: userId,
        amount: grossAmount,
        reason: errorMsg,
        dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tradinghub.com'}/payouts`,
        payoutId: commissionId
      })

      return NextResponse.json({
        success: false,
        error: `Stripe transfer failed: ${errorMsg}`,
        commissionId: commissionId,
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Error creating manual payout:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
