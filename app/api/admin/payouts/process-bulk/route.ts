import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { coinbaseWalletService } from "@/lib/coinbase/wallet-service"

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for batch processing

interface ProcessResult {
  commissionId: string
  userName: string
  amount: number
  success: boolean
  error?: string
  skipped?: boolean
  txHash?: string
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

    if (userData?.role !== "superadmin" && userData?.role !== "superadmin+") {
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
        net_amount_usdc,
        status,
        retry_count,
        commission_type,
        users!commissions_referrer_id_fkey (
          name,
          email,
          payout_wallet_address,
          qualified
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

    const results: ProcessResult[] = []
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    // Check payout wallet balance before processing
    const payoutBalanceResult = await coinbaseWalletService.getPayoutWalletBalance()
    if (!payoutBalanceResult.success || !payoutBalanceResult.data) {
      return NextResponse.json({
        error: "Could not verify payout wallet balance",
      }, { status: 500 })
    }

    // Calculate total needed
    const totalAmount = commissions.reduce((sum, c) => {
      return sum + parseFloat(c.net_amount_usdc || c.amount)
    }, 0)
    const availableUSDC = parseFloat(payoutBalanceResult.data.usdc)

    if (availableUSDC < totalAmount) {
      return NextResponse.json({
        error: `Insufficient payout wallet balance. Available: $${availableUSDC.toFixed(2)} USDC, Needed: $${totalAmount.toFixed(2)} USDC`,
      }, { status: 400 })
    }

    // Process each commission sequentially
    for (const commission of commissions) {
      const user = Array.isArray(commission.users) ? commission.users[0] : commission.users
      const amount = parseFloat(commission.net_amount_usdc || commission.amount)

      // Skip if already paid
      if (commission.status === "paid") {
        skippedCount++
        results.push({
          commissionId: commission.id,
          userName: user?.name || "Unknown",
          amount: amount,
          success: false,
          skipped: true,
          error: "Already paid"
        })
        continue
      }

      // Skip if user is not qualified
      if (!user?.qualified) {
        skippedCount++
        results.push({
          commissionId: commission.id,
          userName: user?.name || "Unknown",
          amount: amount,
          success: false,
          skipped: true,
          error: "User is not qualified"
        })
        continue
      }

      // Validate user has payout wallet address
      if (!user?.payout_wallet_address) {
        failedCount++
        const errorMsg = "No payout wallet address"

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
            amount: amount,
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
          amount: amount,
          success: false,
          error: errorMsg
        })
        continue
      }

      // Execute USDC transfer
      try {
        const transferResult = await coinbaseWalletService.transferFromPayoutWallet(
          user.payout_wallet_address,
          amount.toFixed(6)
        )

        if (!transferResult.success || !transferResult.data) {
          failedCount++
          const errorMsg = transferResult.error?.message || 'USDC transfer failed'

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
              amount: amount,
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
            amount: amount,
            success: false,
            error: errorMsg
          })
          continue
        }

        // Create transaction record
        const { data: transaction } = await supabase
          .from('usdc_transactions')
          .insert({
            transaction_type: 'payout',
            from_address: coinbaseWalletService.getPayoutWalletAddress(),
            to_address: user.payout_wallet_address,
            amount: amount.toFixed(6),
            polygon_tx_hash: transferResult.data.transactionHash,
            block_number: transferResult.data.blockNumber || null,
            status: transferResult.data.status,
            gas_fee_matic: transferResult.data.gasUsed || null,
            user_id: commission.referrer_id,
            related_commission_id: commission.id,
            confirmed_at: transferResult.data.status === 'confirmed' ? new Date().toISOString() : null,
          })
          .select()
          .single()

        // Update commission as paid
        const { error: updateError } = await supabase
          .from("commissions")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            usdc_transaction_id: transaction?.id || null,
            error_message: null,
          })
          .eq("id", commission.id)

        if (updateError) {
          console.error(`Error updating commission ${commission.id}:`, updateError)
          failedCount++
          results.push({
            commissionId: commission.id,
            userName: user.name || "Unknown",
            amount: amount,
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
            amount: amount,
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
          amount: amount,
          success: true,
          txHash: transferResult.data.transactionHash
        })
      } catch (transferError) {
        failedCount++
        const errorMsg = `Transfer failed: ${transferError instanceof Error ? transferError.message : 'Unknown error'}`

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
            amount: amount,
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
          amount: amount,
          success: false,
          error: errorMsg
        })
      }
    }

    // Log audit event
    await supabase.from('crypto_audit_log').insert({
      event_type: 'bulk_payout_executed',
      user_id: null,
      admin_id: authUser.id,
      entity_type: 'commission',
      entity_id: null,
      details: {
        total_commissions: commissions.length,
        successful: successCount,
        failed: failedCount,
        skipped: skippedCount,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    })

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
