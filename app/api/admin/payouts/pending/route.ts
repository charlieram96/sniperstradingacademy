import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
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

    // Calculate date range for previous month's direct bonuses
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // Fetch ALL pending/failed residual commissions AND previous month's direct bonuses
    const { data: commissions, error: commissionsError } = await supabase
      .from("commissions")
      .select(`
        id,
        referrer_id,
        amount,
        net_amount_usdc,
        status,
        commission_type,
        paid_at,
        created_at,
        usdc_transaction_id,
        payout_batch_id,
        error_message,
        processed_at,
        retry_count,
        users!commissions_referrer_id_fkey (
          name,
          email,
          payout_wallet_address,
          qualified
        )
      `)
      .or(`commission_type.eq.residual_monthly,and(commission_type.eq.direct_bonus,created_at.gte.${previousMonthStart.toISOString()},created_at.lt.${currentMonthStart.toISOString()})`)
      .in("status", ["pending", "failed"])
      .order("created_at", { ascending: false })

    if (commissionsError) {
      console.error("Error fetching commissions:", commissionsError)
      return NextResponse.json(
        { error: "Failed to fetch commissions" },
        { status: 500 }
      )
    }

    // Format the response
    const formattedCommissions = commissions.map(commission => {
      const user = Array.isArray(commission.users) ? commission.users[0] : commission.users
      return {
        id: commission.id,
        referrerId: commission.referrer_id,
        amount: parseFloat(commission.amount),
        netAmountUsdc: commission.net_amount_usdc ? parseFloat(commission.net_amount_usdc) : null,
        status: commission.status,
        commissionType: commission.commission_type,
        userName: user?.name || "Unknown",
        userEmail: user?.email || "No email",
        payoutWalletAddress: user?.payout_wallet_address || null,
        qualified: user?.qualified || false,
        usdcTransactionId: commission.usdc_transaction_id,
        payoutBatchId: commission.payout_batch_id,
        errorMessage: commission.error_message,
        processedAt: commission.processed_at,
        retryCount: commission.retry_count || 0,
        createdAt: commission.created_at,
      }
    })

    // Calculate totals
    const totalAmount = formattedCommissions.reduce((sum, c) => sum + c.amount, 0)
    const pendingCount = formattedCommissions.filter(c => c.status === 'pending').length
    const failedCount = formattedCommissions.filter(c => c.status === 'failed').length

    return NextResponse.json({
      commissions: formattedCommissions,
      summary: {
        total: formattedCommissions.length,
        pending: pendingCount,
        failed: failedCount,
        totalAmount: totalAmount,
      }
    })
  } catch (error) {
    console.error("Error in pending payouts API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
