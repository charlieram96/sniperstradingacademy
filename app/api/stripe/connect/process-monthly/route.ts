import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/server"
import { createClient } from "@/lib/supabase/server"

// This endpoint should be called by a cron job on the 1st of each month
// In production, secure this with a secret key or restrict to internal calls only
export async function POST(req: NextRequest) {
  try {
    // Verify this is an authorized request (implement your own auth mechanism)
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

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
      return NextResponse.json({
        message: "No eligible users found for payouts",
        processed: 0
      })
    }

    const results = []
    let successCount = 0
    let failureCount = 0

    for (const user of eligibleUsers) {
      try {
        // Calculate this user's team pool and commission
        const { data: poolData } = await supabase
          .rpc("calculate_team_pool", { user_id: user.id })
          .single() as { data: { total_pool: number, active_members: number, commission: number } | null }
        
        if (!poolData || poolData.commission <= 0) {
          results.push({
            userId: user.id,
            status: "skipped",
            reason: "No commission to pay"
          })
          continue
        }

        // Convert commission to cents for Stripe
        const amountInCents = Math.round(poolData.commission * 100)

        // Check if account is ready for payouts
        const account = await stripe.accounts.retrieve(user.stripe_connect_account_id)
        
        if (!account.payouts_enabled) {
          results.push({
            userId: user.id,
            status: "skipped",
            reason: "Payouts not enabled on connected account"
          })
          continue
        }

        // Create transfer to connected account
        const transfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: "usd",
          destination: user.stripe_connect_account_id,
          transfer_group: `monthly_commission_${new Date().toISOString().slice(0, 7)}`,
          description: `Monthly commission for team pool (${poolData.active_members} members)`,
          metadata: {
            userId: user.id,
            month: new Date().toISOString().slice(0, 7),
            type: "monthly_commission",
            team_pool: poolData.total_pool,
            active_members: poolData.active_members,
          },
        })

        // Record commission in database
        await supabase
          .from("commissions")
          .insert({
            referrer_id: user.id,
            referred_id: user.id, // Self for team pool commissions
            amount: poolData.commission,
            status: "paid",
            paid_at: new Date().toISOString(),
            payment_id: transfer.id, // Store Stripe transfer ID
          })

        // Update user's commission tracking
        await supabase
          .from("users")
          .update({
            total_team_pool: poolData.total_pool,
            monthly_commission: poolData.commission,
          })
          .eq("id", user.id)

        results.push({
          userId: user.id,
          status: "success",
          transferId: transfer.id,
          amount: amountInCents,
        })
        
        successCount++
      } catch (error) {
        console.error(`Failed to process payout for user ${user.id}:`, error)
        results.push({
          userId: user.id,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error"
        })
        failureCount++
      }
    }

    // Log the batch processing results
    console.log("Monthly payout processing complete:", {
      total: eligibleUsers.length,
      success: successCount,
      failures: failureCount,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      processed: eligibleUsers.length,
      successful: successCount,
      failed: failureCount,
      results: results,
    })
  } catch (error) {
    console.error("Monthly payout processing error:", error)
    return NextResponse.json(
      { error: "Failed to process monthly payouts" },
      { status: 500 }
    )
  }
}