/**
 * MARK COMMISSION AS COMPLETED (MANUAL)
 *
 * Allows superadmins to manually mark a commission as paid
 * without creating a Stripe transfer.
 *
 * Use case: Payments made outside the platform (check, cash, wire, etc.)
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { notifyPayoutProcessed } from "@/lib/notifications/notification-service"

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
    const { commissionId } = await req.json()

    if (!commissionId) {
      return NextResponse.json(
        { error: "Commission ID is required" },
        { status: 400 }
      )
    }

    // Fetch commission details
    const { data: commission, error: commissionError } = await supabase
      .from("commissions")
      .select("id, referrer_id, amount, status, commission_type")
      .eq("id", commissionId)
      .single()

    if (commissionError || !commission) {
      return NextResponse.json(
        { error: "Commission not found" },
        { status: 404 }
      )
    }

    // Check if already paid
    if (commission.status === "paid") {
      return NextResponse.json(
        { error: "Commission is already marked as paid" },
        { status: 400 }
      )
    }

    // Update commission to paid (manual completion - no Stripe transfer)
    const { error: updateError } = await supabase
      .from("commissions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        error_message: null, // Clear any previous error
        // Note: stripe_transfer_id remains null to indicate manual completion
      })
      .eq("id", commissionId)

    if (updateError) {
      console.error("Error updating commission:", updateError)
      return NextResponse.json(
        { error: "Failed to update commission" },
        { status: 500 }
      )
    }

    // Send success notification to user
    try {
      await notifyPayoutProcessed({
        userId: commission.referrer_id,
        amount: parseFloat(commission.amount),
        commissionType: commission.commission_type,
        payoutId: commission.id
      })
    } catch (notifError) {
      // Log but don't fail the request if notification fails
      console.error("Error sending notification:", notifError)
    }

    console.log({
      event: 'manual_payout_completed',
      commission_id: commissionId,
      amount: commission.amount,
      completed_by: authUser.id,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: "Commission marked as completed",
      commissionId: commissionId
    })
  } catch (error) {
    console.error("Error marking commission as completed:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
