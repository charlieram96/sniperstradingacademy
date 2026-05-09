import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * POST /api/admin/users/skip-payment
 * Superadmin+ only. Comp a weekly/monthly payment for a user by overriding
 * next_payment_due_date. Treats the user as if they had just paid for the
 * current period: marks them active, sets paid_for_period, advances the
 * period boundary. Does NOT create payments/commissions/usdc_transactions
 * rows — accounting tables are untouched. Audit trail goes to crypto_audit_log.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: adminData } = await supabase
      .from("users")
      .select("role, name")
      .eq("id", user.id)
      .single()

    if (adminData?.role !== "superadmin+") {
      return NextResponse.json({ error: "Forbidden - superadmin+ required" }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as
      | { user_id?: string; next_payment_due_date?: string }
      | null

    if (!body?.user_id || !body?.next_payment_due_date) {
      return NextResponse.json(
        { error: "user_id and next_payment_due_date are required" },
        { status: 400 }
      )
    }

    const newDueDate = new Date(body.next_payment_due_date)
    if (Number.isNaN(newDueDate.getTime())) {
      return NextResponse.json(
        { error: "next_payment_due_date is not a valid date" },
        { status: 400 }
      )
    }

    if (newDueDate.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "next_payment_due_date must be in the future" },
        { status: 400 }
      )
    }

    const adminClient = createServiceRoleClient()

    const { data: targetUser, error: targetError } = await adminClient
      .from("users")
      .select("id, email, name, next_payment_due_date, is_active")
      .eq("id", body.user_id)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const oldNextDue = targetUser.next_payment_due_date
    const wasInactive = targetUser.is_active === false
    const nowIso = new Date().toISOString()

    const { data: updated, error: updateError } = await adminClient
      .from("users")
      .update({
        next_payment_due_date: newDueDate.toISOString(),
        previous_payment_due_date: oldNextDue ?? nowIso,
        paid_for_period: true,
        is_active: true,
        inactive_since: null,
        last_payment_date: nowIso,
      })
      .eq("id", body.user_id)
      .select("id, email, name, next_payment_due_date, previous_payment_due_date, paid_for_period, is_active, inactive_since, last_payment_date")
      .single()

    if (updateError || !updated) {
      console.error("[SkipPayment] update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update user payment dates" },
        { status: 500 }
      )
    }

    await supabase.from("crypto_audit_log").insert({
      event_type: "admin_action",
      admin_id: user.id,
      user_id: body.user_id,
      entity_type: "user",
      entity_id: body.user_id,
      details: {
        action: "skip_payment",
        old_next_due: oldNextDue,
        new_next_due: newDueDate.toISOString(),
        new_previous_due: oldNextDue ?? nowIso,
        was_inactive: wasInactive,
        triggered_by: adminData?.name || user.email || "Administrator",
      },
    })

    return NextResponse.json({
      success: true,
      user: updated,
      message: `Next payment due date updated to ${newDueDate.toLocaleDateString()}`,
    })
  } catch (error) {
    console.error("[SkipPayment] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
