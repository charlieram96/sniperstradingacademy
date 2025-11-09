import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

interface ProcessResult {
  commissionId: string
  userName: string
  amount: number
  success: boolean
  error?: string
  skipped?: boolean
  transferId?: string
}

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

    const body = await req.json()
    const { commissionIds } = body

    // Calculate date range for previous month's direct bonuses
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // Get commissions to process (both residual and previous month's direct bonuses)
    let query = supabase
      .from("commissions")
      .select(`
        id,
        referrer_id,
        amount,
        status,
        retry_count,
        commission_type,
        users!commissions_referrer_id_fkey (
          name,
          email,
          stripe_connect_account_id
        )
      `)

    // If specific IDs provided, filter by them
    if (commissionIds && Array.isArray(commissionIds) && commissionIds.length > 0) {
      query = query.in("id", commissionIds)
    } else {
      // Otherwise process all pending/failed residual commissions AND previous month's direct bonuses
      query = query
        .or(`commission_type.eq.residual_monthly,and(commission_type.eq.direct_bonus,created_at.gte.${previousMonthStart.toISOString()},created_at.lt.${currentMonthStart.toISOString()})`)
        .in("status", ["pending", "failed"])
    }

    const { data: commissions, error: commissionsError } = await query

    if (commissionsError) {
      return NextResponse.json(
        { error: "Failed to fetch commissions" },
        { status: 500 }
      )
    }

    if (!commissions || commissions.length === 0) {
      return NextResponse.json({
        successful: 0,
        failed: 0,
        skipped: 0,
        results: [],
        message: "No commissions to process"
      })
    }

    const stripe = getStripe()
    const results: ProcessResult[] = []
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    // Check Stripe balance before processing
    const balance = await stripe.balance.retrieve()
    const availableBalance = balance.available.find(b => b.currency === 'usd')
    const availableAmount = availableBalance ? availableBalance.amount / 100 : 0

    // Calculate total needed after 3.5% fee deduction
    const FEE_PERCENTAGE = 0.035
    const totalGross = commissions.reduce((sum, c) => sum + parseFloat(c.amount), 0)
    const totalNet = totalGross * (1 - FEE_PERCENTAGE)
    const stripeFees = commissions.length * 0.25 // Stripe's own processing fees

    if (availableAmount < totalNet + stripeFees) {
      return NextResponse.json({
        error: `Insufficient Stripe balance. Available: $${availableAmount.toFixed(2)}, Needed: $${(totalNet + stripeFees).toFixed(2)}`,
      }, { status: 400 })
    }

    // Process each commission sequentially
    for (const commission of commissions) {
      const user = Array.isArray(commission.users) ? commission.users[0] : commission.users

      // Skip if already paid
      if (commission.status === "paid") {
        skippedCount++
        results.push({
          commissionId: commission.id,
          userName: user?.name || "Unknown",
          amount: parseFloat(commission.amount),
          success: false,
          skipped: true,
          error: "Already paid"
        })
        continue
      }

      // Validate user has Stripe Connect account
      if (!user?.stripe_connect_account_id) {
        failedCount++
        const errorMsg = "No Stripe Connect account"

        await supabase
          .from("commissions")
          .update({
            error_message: errorMsg,
            processed_at: new Date().toISOString(),
            retry_count: (commission.retry_count || 0) + 1,
          })
          .eq("id", commission.id)

        // Send payout failure notification
        try {
          const { notifyPayoutFailed } = await import('@/lib/notifications/notification-service')
          await notifyPayoutFailed({
            userId: commission.referrer_id,
            amount: parseFloat(commission.amount),
            reason: errorMsg,
            dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tradinghub.com'}/settings`,
            payoutId: commission.id
          })
          console.log(`✅ Sent payout failed notification to user ${commission.referrer_id}`)
        } catch (notifError) {
          console.error('❌ Error sending payout failed notification:', notifError)
        }

        results.push({
          commissionId: commission.id,
          userName: user?.name || "Unknown",
          amount: parseFloat(commission.amount),
          success: false,
          error: errorMsg
        })
        continue
      }

      // Verify account is ready for payouts
      try {
        const account = await stripe.accounts.retrieve(user.stripe_connect_account_id)

        if (!account.payouts_enabled) {
          failedCount++
          const errorMsg = "Bank account not verified"

          await supabase
            .from("commissions")
            .update({
              error_message: errorMsg,
              processed_at: new Date().toISOString(),
              retry_count: (commission.retry_count || 0) + 1,
            })
            .eq("id", commission.id)

          // Send payout failure notification
          try {
            const { notifyPayoutFailed } = await import('@/lib/notifications/notification-service')
            await notifyPayoutFailed({
              userId: commission.referrer_id,
              amount: parseFloat(commission.amount),
              reason: errorMsg,
              dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tradinghub.com'}/settings`,
              payoutId: commission.id
            })
            console.log(`✅ Sent payout failed notification to user ${commission.referrer_id}`)
          } catch (notifError) {
            console.error('❌ Error sending payout failed notification:', notifError)
          }

          results.push({
            commissionId: commission.id,
            userName: user.name || "Unknown",
            amount: parseFloat(commission.amount),
            success: false,
            error: errorMsg
          })
          continue
        }
      } catch (stripeError) {
        failedCount++
        const errorMsg = `Stripe account error: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`

        await supabase
          .from("commissions")
          .update({
            error_message: errorMsg,
            processed_at: new Date().toISOString(),
            retry_count: (commission.retry_count || 0) + 1,
          })
          .eq("id", commission.id)

        // Send payout failure notification
        try {
          const { notifyPayoutFailed } = await import('@/lib/notifications/notification-service')
          await notifyPayoutFailed({
            userId: commission.referrer_id,
            amount: parseFloat(commission.amount),
            reason: errorMsg,
            dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tradinghub.com'}/settings`,
            payoutId: commission.id
          })
          console.log(`✅ Sent payout failed notification to user ${commission.referrer_id}`)
        } catch (notifError) {
          console.error('❌ Error sending payout failed notification:', notifError)
        }

        results.push({
          commissionId: commission.id,
          userName: user.name || "Unknown",
          amount: parseFloat(commission.amount),
          success: false,
          error: errorMsg
        })
        continue
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
          transfer_group: `monthly_payout_${commission.id}`,
          metadata: {
            userId: commission.referrer_id,
            payoutId: commission.id,
            type: commission.commission_type, // Can be "residual_monthly" or "direct_bonus"
            paymentMonth: now.toISOString().slice(0, 7), // e.g., "2025-11"
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
            error_message: null,
          })
          .eq("id", commission.id)

        if (updateError) {
          console.error(`Error updating commission ${commission.id}:`, updateError)
          failedCount++
          results.push({
            commissionId: commission.id,
            userName: user.name || "Unknown",
            amount: parseFloat(commission.amount),
            success: false,
            error: `Transfer succeeded but database update failed: ${updateError.message}`
          })
          continue
        }

        // Send payout success notification
        try {
          const { notifyPayoutProcessed } = await import('@/lib/notifications/notification-service')
          await notifyPayoutProcessed({
            userId: commission.referrer_id,
            amount: netAmount,
            commissionType: commission.commission_type,
            payoutId: commission.id
          })
          console.log(`✅ Sent payout processed notification to user ${commission.referrer_id}`)
        } catch (notifError) {
          console.error('❌ Error sending payout processed notification:', notifError)
        }

        successCount++
        results.push({
          commissionId: commission.id,
          userName: user.name || "Unknown",
          amount: netAmount, // Net amount after fee
          success: true,
          transferId: transfer.id
        })
      } catch (stripeError) {
        failedCount++
        const errorMsg = `Transfer failed: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`

        await supabase
          .from("commissions")
          .update({
            error_message: errorMsg,
            processed_at: new Date().toISOString(),
            retry_count: (commission.retry_count || 0) + 1,
          })
          .eq("id", commission.id)

        // Send payout failure notification
        try {
          const { notifyPayoutFailed } = await import('@/lib/notifications/notification-service')
          await notifyPayoutFailed({
            userId: commission.referrer_id,
            amount: parseFloat(commission.amount),
            reason: errorMsg,
            dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tradinghub.com'}/settings`,
            payoutId: commission.id
          })
          console.log(`✅ Sent payout failed notification to user ${commission.referrer_id}`)
        } catch (notifError) {
          console.error('❌ Error sending payout failed notification:', notifError)
        }

        results.push({
          commissionId: commission.id,
          userName: user.name || "Unknown",
          amount: parseFloat(commission.amount),
          success: false,
          error: errorMsg
        })
      }
    }

    return NextResponse.json({
      successful: successCount,
      failed: failedCount,
      skipped: skippedCount,
      total: commissions.length,
      results: results,
    })
  } catch (error) {
    console.error("Error processing bulk payouts:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
