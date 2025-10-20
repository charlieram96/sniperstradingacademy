import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/server"
import { createClient } from "@/lib/supabase/server"

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

    const body = await req.json()
    const { commissionIds } = body

    // Get commissions to process
    let query = supabase
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
      .eq("commission_type", "residual_monthly")

    // If specific IDs provided, filter by them
    if (commissionIds && Array.isArray(commissionIds) && commissionIds.length > 0) {
      query = query.in("id", commissionIds)
    } else {
      // Otherwise process all pending/failed
      query = query.in("status", ["pending", "failed"])
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

    const totalNeeded = commissions.reduce((sum, c) => sum + parseFloat(c.amount), 0)
    const totalFees = commissions.length * 0.25

    if (availableAmount < totalNeeded + totalFees) {
      return NextResponse.json({
        error: `Insufficient Stripe balance. Available: $${availableAmount.toFixed(2)}, Needed: $${(totalNeeded + totalFees).toFixed(2)}`,
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
      const amountInCents = Math.round(parseFloat(commission.amount) * 100)

      try {
        const transfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: "usd",
          destination: user.stripe_connect_account_id,
          transfer_group: `residual_${commission.id}`,
          metadata: {
            userId: commission.referrer_id,
            commissionId: commission.id,
            type: "residual_monthly",
          },
        })

        // Update commission as paid
        await supabase
          .from("commissions")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            stripe_transfer_id: transfer.id,
            error_message: null,
          })
          .eq("id", commission.id)

        successCount++
        results.push({
          commissionId: commission.id,
          userName: user.name || "Unknown",
          amount: parseFloat(commission.amount),
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
