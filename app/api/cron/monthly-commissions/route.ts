import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/server"
import { createClient } from "@/lib/supabase/server"

// This endpoint is called by Vercel cron on the 1st of each month
export async function GET(req: NextRequest) {
  try {
    // Verify this request is from Vercel cron
    const authHeader = req.headers.get("authorization")
    
    // In production, Vercel automatically adds the CRON_SECRET as a bearer token
    if (process.env.NODE_ENV === "production") {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.error("Unauthorized cron request attempted")
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        )
      }
    }

    console.log(`[CRON] Starting monthly commission processing at ${new Date().toISOString()}`)

    const stripe = getStripe()
    const supabase = await createClient()
    
    // Get all users with active subscriptions and connected accounts
    const { data: eligibleUsers } = await supabase
      .from("users")
      .select(`
        id,
        email,
        name,
        stripe_connect_account_id,
        subscriptions!inner(
          status
        )
      `)
      .not("stripe_connect_account_id", "is", null)
      .eq("subscriptions.status", "active")

    if (!eligibleUsers || eligibleUsers.length === 0) {
      console.log("[CRON] No eligible users found for payouts")
      return NextResponse.json({
        success: true,
        message: "No eligible users found for payouts",
        processed: 0,
        timestamp: new Date().toISOString()
      })
    }

    console.log(`[CRON] Found ${eligibleUsers.length} eligible users for payouts`)

    const results = []
    let successCount = 0
    let failureCount = 0
    let totalCommissionsPaid = 0

    for (const user of eligibleUsers) {
      try {
        // Calculate this user's monthly earnings based on network position
        const { data: earningsData } = await supabase
          .rpc("calculate_user_monthly_earnings", { p_user_id: user.id })
          .single() as { data: {
            total_network_size: number,
            active_network_size: number,
            direct_referrals: number,
            completed_structures: number,
            total_contribution: number,
            commission_rate: number,
            gross_earnings: number,
            can_withdraw: boolean,
            required_referrals: number
          } | null }

        if (!earningsData || earningsData.gross_earnings <= 0) {
          results.push({
            userId: user.id,
            email: user.email,
            status: "skipped",
            reason: "No earnings to pay"
          })
          continue
        }

        // Check if user can withdraw (has enough direct referrals)
        if (!earningsData.can_withdraw) {
          results.push({
            userId: user.id,
            email: user.email,
            status: "skipped",
            reason: `Need ${earningsData.required_referrals - earningsData.direct_referrals} more direct referrals to withdraw`
          })
          continue
        }

        // Convert commission to cents for Stripe
        const amountInCents = Math.round(earningsData.gross_earnings * 100)

        // Check if account is ready for payouts
        const account = await stripe.accounts.retrieve(user.stripe_connect_account_id)
        
        if (!account.payouts_enabled) {
          results.push({
            userId: user.id,
            email: user.email,
            status: "skipped",
            reason: "Payouts not enabled on connected account"
          })
          console.log(`[CRON] User ${user.email} skipped - payouts not enabled`)
          continue
        }

        // Create transfer to connected account
        const transfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: "usd",
          destination: user.stripe_connect_account_id,
          transfer_group: `monthly_commission_${new Date().toISOString().slice(0, 7)}`,
          description: `Monthly commission for network (${earningsData.active_network_size} active members, ${earningsData.completed_structures} structures)`,
          metadata: {
            userId: user.id,
            month: new Date().toISOString().slice(0, 7),
            type: "monthly_commission",
            total_contribution: earningsData.total_contribution.toString(),
            active_members: earningsData.active_network_size.toString(),
            commission_rate: earningsData.commission_rate.toString(),
            completed_structures: earningsData.completed_structures.toString(),
          },
        })

        // Record commission in database
        await supabase
          .from("commissions")
          .insert({
            referrer_id: user.id,
            referred_id: user.id, // Self for network commissions
            amount: earningsData.gross_earnings,
            status: "paid",
            paid_at: new Date().toISOString(),
            payment_id: transfer.id, // Store Stripe transfer ID
          })

        // Update user's commission tracking
        await supabase
          .from("users")
          .update({
            total_team_pool: earningsData.total_contribution,
            monthly_commission: earningsData.gross_earnings,
          })
          .eq("id", user.id)

        results.push({
          userId: user.id,
          email: user.email,
          status: "success",
          transferId: transfer.id,
          amount: amountInCents,
          networkSize: earningsData.total_network_size,
          activeMembers: earningsData.active_network_size,
          structures: earningsData.completed_structures,
        })

        totalCommissionsPaid += earningsData.gross_earnings
        successCount++

        console.log(`[CRON] Successfully paid $${earningsData.gross_earnings} to ${user.email} (${earningsData.active_network_size} active members, ${earningsData.completed_structures} structures)`)
      } catch (error) {
        console.error(`[CRON] Failed to process payout for user ${user.email}:`, error)
        results.push({
          userId: user.id,
          email: user.email,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error"
        })
        failureCount++
      }
    }

    // Log summary to console (will appear in Vercel logs)
    const summary = {
      timestamp: new Date().toISOString(),
      total: eligibleUsers.length,
      successful: successCount,
      failed: failureCount,
      totalCommissionsPaid: totalCommissionsPaid,
      results: results
    }

    console.log("[CRON] Monthly payout processing complete:", JSON.stringify(summary, null, 2))

    // Optional: Send notification email to admin
    if (process.env.ADMIN_EMAIL) {
      // You could integrate with SendGrid, Resend, or any email service here
      console.log(`[CRON] Admin notification would be sent to ${process.env.ADMIN_EMAIL}`)
    }

    return NextResponse.json({
      success: true,
      processed: eligibleUsers.length,
      successful: successCount,
      failed: failureCount,
      totalCommissionsPaid: totalCommissionsPaid,
      timestamp: new Date().toISOString(),
      // In production, you might not want to expose all details
      ...(process.env.NODE_ENV !== "production" && { results })
    })
  } catch (error) {
    console.error("[CRON] Critical error in monthly payout processing:", error)
    
    // In production, you might want to send an alert to admin
    return NextResponse.json(
      { 
        error: "Failed to process monthly payouts",
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV !== "production" && { 
          details: error instanceof Error ? error.message : "Unknown error" 
        })
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering (with proper auth)
export async function POST(req: NextRequest) {
  // For manual triggering, require a different auth mechanism
  const authHeader = req.headers.get("authorization")
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }
  
  // Call the same logic as GET
  return GET(req)
}