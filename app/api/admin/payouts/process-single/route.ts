import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { coinbaseWalletService } from "@/lib/coinbase/wallet-service"
import { roleRank } from "@/lib/admin/permissions"

export const runtime = 'nodejs'
export const maxDuration = 120 // must exceed the 60s confirmation timeout so a stuck tx is recorded, not orphaned

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
      .select("role, permissions")
      .eq("id", authUser.id)
      .single()

    if (!(roleRank(userData?.role) >= roleRank('superadmin') || (userData?.permissions ?? []).includes('manage_payouts'))) {
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

    // Get commission details with user's payout wallet
    const { data: commission, error: commissionError } = await supabase
      .from("commissions")
      .select(`
        id,
        referrer_id,
        amount,
        net_amount_usdc,
        status,
        retry_count,
        commission_type,
        error_message,
        usdc_transaction_id,
        users!commissions_referrer_id_fkey (
          name,
          email,
          payout_wallet_address,
          qualified
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

    // Double-pay guard: a previous attempt may have broadcast a tx that never
    // confirmed before the function returned. Resolve that tx before sending again.
    const priorBroadcast = commission.error_message?.match(/broadcast, awaiting confirmation: (0x[0-9a-fA-F]{64})/)
    if (priorBroadcast) {
      const { polygonUSDCClient } = await import('@/lib/polygon/usdc-client')
      const priorTxStatus = await polygonUSDCClient.getTransactionStatus(priorBroadcast[1])

      if (priorTxStatus === 'confirmed') {
        // The earlier broadcast landed — mark paid, do not send again
        if (commission.usdc_transaction_id) {
          await supabase
            .from('usdc_transactions')
            .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
            .eq('id', commission.usdc_transaction_id)
        }
        await supabase
          .from("commissions")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", commissionId)

        return NextResponse.json({
          success: true,
          alreadyBroadcast: true,
          txHash: priorBroadcast[1],
          commissionId: commission.id,
          message: "A previously broadcast transfer for this commission confirmed on-chain. Marked as paid without sending again.",
        })
      }

      if (priorTxStatus === 'pending') {
        return NextResponse.json({
          success: false,
          error: `A transfer for this commission is still awaiting confirmation (${priorBroadcast[1]}). Verify it on Polygonscan before retrying.`,
          commissionId: commission.id,
        }, { status: 409 })
      }

      // 'not_found' (evicted from mempool without mining) or 'failed' (reverted):
      // mark the stale tx row and fall through to send a fresh transfer
      if (commission.usdc_transaction_id) {
        await supabase
          .from('usdc_transactions')
          .update({ status: 'failed', error_message: `superseded: prior broadcast ${priorTxStatus}` })
          .eq('id', commission.usdc_transaction_id)
      }
    }

    const user = Array.isArray(commission.users) ? commission.users[0] : commission.users

    // For direct bonuses, users only need a payout wallet (no qualification required)
    // For residual commissions, qualification is still required
    if (commission.commission_type !== 'direct_bonus' && !user?.qualified) {
      return NextResponse.json({
        success: false,
        error: "Cannot process payout: User is not qualified (required for residual commissions)",
        commissionId: commission.id,
      }, { status: 400 })
    }

    // Validate user has payout wallet address
    if (!user?.payout_wallet_address) {
      const errorMsg = "User does not have a payout wallet address configured"

      // Update commission with error
      await supabase
        .from("commissions")
        .update({
          error_message: errorMsg,
          processed_at: new Date().toISOString(),
          retry_count: (commission.retry_count || 0) + 1,
        })
        .eq("id", commissionId)

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

      return NextResponse.json({
        success: false,
        error: errorMsg,
        commissionId: commission.id,
      })
    }

    // Check payout wallet balance before processing
    const payoutBalanceResult = await coinbaseWalletService.getPayoutWalletBalance()
    if (!payoutBalanceResult.success || !payoutBalanceResult.data) {
      return NextResponse.json({
        success: false,
        error: 'Could not verify payout wallet balance',
        commissionId: commission.id,
      })
    }

    const amount = parseFloat(commission.net_amount_usdc || commission.amount)
    const availableUSDC = parseFloat(payoutBalanceResult.data.usdc)

    if (availableUSDC < amount) {
      return NextResponse.json({
        success: false,
        error: `Insufficient payout wallet balance. Have: ${availableUSDC.toFixed(2)} USDC, Need: ${amount.toFixed(2)} USDC`,
        commissionId: commission.id,
      })
    }

    // Execute USDC transfer from payout wallet
    try {
      const transferResult = await coinbaseWalletService.transferFromPayoutWallet(
        user.payout_wallet_address,
        amount.toFixed(6)
      )

      if (!transferResult.success || !transferResult.data) {
        const errorMsg = transferResult.error?.message || 'USDC transfer failed'

        await supabase
          .from("commissions")
          .update({
            error_message: errorMsg,
            processed_at: new Date().toISOString(),
            retry_count: (commission.retry_count || 0) + 1,
          })
          .eq("id", commissionId)

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

        return NextResponse.json({
          success: false,
          error: errorMsg,
          commissionId: commission.id,
        })
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
          related_commission_id: commissionId,
          confirmed_at: transferResult.data.status === 'confirmed' ? new Date().toISOString() : null,
        })
        .select()
        .single()

      // Broadcast but not yet mined (confirmation timeout): keep the commission
      // pending with the tx hash recorded so the send is never invisible.
      // Do NOT cancel — the tx may still mine, and cancel-then-retry double-pays.
      if (transferResult.data.status === 'pending') {
        await supabase
          .from("commissions")
          .update({
            error_message: `broadcast, awaiting confirmation: ${transferResult.data.transactionHash}`,
            usdc_transaction_id: transaction?.id || null,
          })
          .eq("id", commissionId)

        return NextResponse.json({
          success: true,
          pendingConfirmation: true,
          txHash: transferResult.data.transactionHash,
          commissionId: commission.id,
          amount: amount,
          userName: user.name,
          message: "Transfer broadcast but not yet confirmed on-chain. Check the transaction before retrying.",
        }, { status: 202 })
      }

      // Update commission as paid
      const { error: updateError } = await supabase
        .from("commissions")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          usdc_transaction_id: transaction?.id || null,
          error_message: null, // Clear any previous error
        })
        .eq("id", commissionId)

      if (updateError) {
        console.error("Error updating commission status:", updateError)
        return NextResponse.json({
          success: false,
          error: "Transfer completed but database update failed. Please check logs.",
          details: updateError.message,
          txHash: transferResult.data.transactionHash,
          commissionId: commission.id,
        }, { status: 500 })
      }

      // Log audit event
      await supabase.from('crypto_audit_log').insert({
        event_type: 'payout_executed',
        user_id: commission.referrer_id,
        admin_id: authUser.id,
        entity_type: 'commission',
        entity_id: commissionId,
        details: {
          amount: amount.toFixed(6),
          tx_hash: transferResult.data.transactionHash,
          wallet_address: user.payout_wallet_address,
          commission_type: commission.commission_type,
        },
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        user_agent: req.headers.get('user-agent'),
      })

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

      return NextResponse.json({
        success: true,
        txHash: transferResult.data.transactionHash,
        commissionId: commission.id,
        amount: amount,
        userName: user.name,
      })
    } catch (transferError) {
      const errorMsg = `USDC transfer failed: ${transferError instanceof Error ? transferError.message : 'Unknown error'}`

      await supabase
        .from("commissions")
        .update({
          error_message: errorMsg,
          processed_at: new Date().toISOString(),
          retry_count: (commission.retry_count || 0) + 1,
        })
        .eq("id", commissionId)

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
