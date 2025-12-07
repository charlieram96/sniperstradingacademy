import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { coinbaseWalletService } from "@/lib/coinbase/wallet-service"

export const runtime = 'nodejs'

const MAX_MANUAL_PAYOUT_AMOUNT = 2000

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
      .select("id, name, email, payout_wallet_address, qualified")
      .eq("id", userId)
      .single()

    if (userError || !recipientUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Manual payouts only require a wallet - they're an admin override
    // so qualification is not enforced here

    // Validate user has payout wallet address
    if (!recipientUser.payout_wallet_address) {
      return NextResponse.json(
        { error: "User does not have a payout wallet address configured" },
        { status: 400 }
      )
    }

    // Check payout wallet balance
    const payoutBalanceResult = await coinbaseWalletService.getPayoutWalletBalance()
    if (!payoutBalanceResult.success || !payoutBalanceResult.data) {
      return NextResponse.json(
        { error: "Could not verify payout wallet balance" },
        { status: 500 }
      )
    }

    const availableUSDC = parseFloat(payoutBalanceResult.data.usdc)
    if (availableUSDC < amountNumber) {
      return NextResponse.json(
        { error: `Insufficient payout wallet balance. Have: $${availableUSDC.toFixed(2)} USDC, Need: $${amountNumber.toFixed(2)} USDC` },
        { status: 400 }
      )
    }

    // First create the commission record
    const { data: newCommission, error: commissionError } = await supabase
      .from("commissions")
      .insert({
        referrer_id: userId,
        referred_id: userId, // For manual payouts, set same as referrer
        amount: amountNumber,
        net_amount_usdc: amountNumber, // No fee deduction for crypto
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

    // Execute USDC transfer
    try {
      const transferResult = await coinbaseWalletService.transferFromPayoutWallet(
        recipientUser.payout_wallet_address,
        amountNumber.toFixed(6)
      )

      if (!transferResult.success || !transferResult.data) {
        const errorMsg = transferResult.error?.message || 'USDC transfer failed'

        // Update commission with error
        await supabase
          .from("commissions")
          .update({
            status: "cancelled",
            error_message: errorMsg,
            processed_at: new Date().toISOString(),
          })
          .eq("id", commissionId)

        // Send failure notification
        try {
          const { notifyPayoutFailed } = await import('@/lib/notifications/notification-service')
          await notifyPayoutFailed({
            userId: userId,
            amount: amountNumber,
            reason: errorMsg,
            dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tradinghub.com'}/finance`,
            payoutId: commissionId
          })
        } catch (notifError) {
          console.error('❌ Error sending payout failed notification:', notifError)
        }

        return NextResponse.json({
          success: false,
          error: errorMsg,
          commissionId: commissionId,
        }, { status: 500 })
      }

      // Create transaction record
      const { data: transaction } = await supabase
        .from('usdc_transactions')
        .insert({
          transaction_type: 'payout',
          from_address: coinbaseWalletService.getPayoutWalletAddress(),
          to_address: recipientUser.payout_wallet_address,
          amount: amountNumber.toFixed(6),
          polygon_tx_hash: transferResult.data.transactionHash,
          block_number: transferResult.data.blockNumber || null,
          status: transferResult.data.status,
          gas_fee_matic: transferResult.data.gasUsed || null,
          user_id: userId,
          related_commission_id: commissionId,
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
        })
        .eq("id", commissionId)

      if (updateError) {
        console.error("Error updating commission status:", updateError)
        return NextResponse.json({
          success: false,
          error: "Transfer completed but database update failed. Please check logs.",
          details: updateError.message,
          txHash: transferResult.data.transactionHash,
          commissionId: commissionId,
        }, { status: 500 })
      }

      // Log audit event
      await supabase.from('crypto_audit_log').insert({
        event_type: 'manual_payout_executed',
        user_id: userId,
        admin_id: authUser.id,
        entity_type: 'commission',
        entity_id: commissionId,
        details: {
          amount: amountNumber.toFixed(6),
          tx_hash: transferResult.data.transactionHash,
          wallet_address: recipientUser.payout_wallet_address,
          description: description.trim(),
        },
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        user_agent: req.headers.get('user-agent'),
      })

      // Send success notification
      try {
        const { notifyPayoutProcessed } = await import('@/lib/notifications/notification-service')
        await notifyPayoutProcessed({
          userId: userId,
          amount: amountNumber,
          commissionType: 'manual_payout',
          payoutId: commissionId
        })
      } catch (notifError) {
        console.error('❌ Error sending payout processed notification:', notifError)
      }

      return NextResponse.json({
        success: true,
        txHash: transferResult.data.transactionHash,
        commissionId: commissionId,
        amount: amountNumber,
        userName: recipientUser.name,
        userEmail: recipientUser.email,
        walletAddress: recipientUser.payout_wallet_address,
        description: description.trim(),
      })
    } catch (transferError) {
      const errorMsg = transferError instanceof Error ? transferError.message : 'Unknown error'

      // Update commission with error
      await supabase
        .from("commissions")
        .update({
          status: "cancelled",
          error_message: `USDC transfer failed: ${errorMsg}`,
          processed_at: new Date().toISOString(),
        })
        .eq("id", commissionId)

      // Send failure notification
      try {
        const { notifyPayoutFailed } = await import('@/lib/notifications/notification-service')
        await notifyPayoutFailed({
          userId: userId,
          amount: amountNumber,
          reason: errorMsg,
          dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tradinghub.com'}/finance`,
          payoutId: commissionId
        })
      } catch (notifError) {
        console.error('❌ Error sending payout failed notification:', notifError)
      }

      return NextResponse.json({
        success: false,
        error: `USDC transfer failed: ${errorMsg}`,
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
