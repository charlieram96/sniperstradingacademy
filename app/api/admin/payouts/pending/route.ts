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

    // Fetch all pending residual commissions with user details
    const { data: commissions, error: commissionsError } = await supabase
      .from("commissions")
      .select(`
        id,
        referrer_id,
        amount,
        status,
        commission_type,
        paid_at,
        created_at,
        stripe_transfer_id,
        error_message,
        processed_at,
        retry_count,
        users!commissions_referrer_id_fkey (
          name,
          email,
          stripe_connect_account_id
        )
      `)
      .eq("commission_type", "residual_monthly")
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
        status: commission.status,
        userName: user?.name || "Unknown",
        userEmail: user?.email || "No email",
        stripeConnectAccountId: user?.stripe_connect_account_id || null,
        stripeTransferId: commission.stripe_transfer_id,
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
