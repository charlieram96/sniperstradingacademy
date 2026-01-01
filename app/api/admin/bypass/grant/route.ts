import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    // Verify admin/superadmin authentication
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is admin or superadmin
    const { data: adminCheck } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single()

    if (!adminCheck || !["admin", "superadmin", "superadmin+"].includes(adminCheck.role)) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const {
      userId,
      bypassInitialPayment = false,
      bypassSubscription = false,
      bypassDirectReferralsCount = 0
    } = body

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    // Validate direct referrals count
    if (typeof bypassDirectReferralsCount !== 'number' || bypassDirectReferralsCount < 0 || bypassDirectReferralsCount > 18) {
      return NextResponse.json(
        { error: "bypassDirectReferralsCount must be a number between 0 and 18" },
        { status: 400 }
      )
    }

    // Use service role client for privileged operations
    const serviceSupabase = createServiceRoleClient()

    const processLog: string[] = []

    // Process bypass_initial_payment
    if (bypassInitialPayment) {
      processLog.push("Processing initial payment bypass...")

      // Get user data
      const { data: userBeforeUpdate } = await serviceSupabase
        .from("users")
        .select("network_position_id, is_active, referred_by, bypass_initial_payment, initial_payment_completed")
        .eq("id", userId)
        .single()

      // Only run activation if not already completed
      if (!userBeforeUpdate?.initial_payment_completed) {
        const wasActiveBefore = userBeforeUpdate?.is_active || false

        // STEP 1: Assign network position if missing
        if (!userBeforeUpdate?.network_position_id) {
          processLog.push("Assigning network position...")

          const { data: positionId, error: positionError } = await serviceSupabase
            .rpc('assign_network_position', {
              p_user_id: userId,
              p_referrer_id: userBeforeUpdate?.referred_by || null
            })

          if (positionError) {
            processLog.push(`⚠️  Error assigning position: ${positionError.message}`)
          } else {
            processLog.push(`✅ Network position assigned: ${positionId}`)
          }
        } else {
          processLog.push(`✅ User already has network position: ${userBeforeUpdate.network_position_id}`)
        }

        // STEP 2: Update user status (unlock membership + activate)
        processLog.push("Unlocking membership and activating user...")

        await serviceSupabase
          .from("users")
          .update({
            membership_status: "unlocked",
            initial_payment_completed: true,
            initial_payment_date: new Date().toISOString(),
            is_active: true,
            last_payment_date: new Date().toISOString(),
            bypass_initial_payment: true
          })
          .eq("id", userId)

        processLog.push("✅ User unlocked and activated")

        // STEP 3: Increment active network count for upchain
        const { data: userAfterUpdate } = await serviceSupabase
          .from("users")
          .select("network_position_id")
          .eq("id", userId)
          .single()

        if (userAfterUpdate?.network_position_id && !wasActiveBefore) {
          processLog.push("Incrementing active count for upchain...")

          const { data: ancestorsIncremented, error: incrementError } = await serviceSupabase
            .rpc('increment_upchain_active_count', {
              p_user_id: userId
            })

          if (incrementError) {
            processLog.push(`⚠️  Error incrementing active count: ${incrementError.message}`)
          } else {
            processLog.push(`✅ Incremented active_network_count for ${ancestorsIncremented || 0} ancestors`)
          }
        }

        // STEP 4: Update referral status
        processLog.push("Updating referral status...")

        const { data: existingReferral } = await serviceSupabase
          .from("referrals")
          .select("id, referrer_id")
          .eq("referred_id", userId)
          .single()

        let referrerData: { referrer_id: string } | null = null

        if (!existingReferral && userBeforeUpdate?.referred_by) {
          // Create missing referral record
          const { data: createdReferral, error: createError } = await serviceSupabase
            .from("referrals")
            .insert({
              referrer_id: userBeforeUpdate.referred_by,
              referred_id: userId,
              status: "active",
              initial_payment_status: "completed"
            })
            .select("referrer_id")
            .single()

          if (createError) {
            processLog.push(`⚠️  Error creating referral: ${createError.message}`)
          } else {
            referrerData = createdReferral
            processLog.push("✅ Referral created with 'active' status")
          }
        } else if (existingReferral) {
          // Update existing referral
          const { error: updateError } = await serviceSupabase
            .from("referrals")
            .update({
              initial_payment_status: "completed",
              status: "active"
            })
            .eq("referred_id", userId)

          if (updateError) {
            processLog.push(`⚠️  Error updating referral: ${updateError.message}`)
          } else {
            referrerData = { referrer_id: existingReferral.referrer_id }
            processLog.push("✅ Referral updated to 'active' status")
          }
        }

        // STEP 5: Create audit payment record
        processLog.push("Creating audit payment record...")

        const { error: paymentError } = await serviceSupabase
          .from("payments")
          .insert({
            user_id: userId,
            stripe_payment_intent_id: null,
            amount: 0, // Shows it was free
            payment_type: "initial",
            status: "bypassed", // New status for audit trail
          })

        if (paymentError) {
          processLog.push(`⚠️  Error creating payment record: ${paymentError.message}`)
        } else {
          processLog.push("✅ Audit payment record created (amount: $0, status: bypassed)")
        }

        processLog.push("✅ Initial payment bypass complete")
      } else {
        processLog.push("⚠️  User already has initial payment completed, only setting flag")
        await serviceSupabase
          .from("users")
          .update({ bypass_initial_payment: true })
          .eq("id", userId)
      }
    }

    // Process bypass_subscription (can grant or remove)
    processLog.push("Processing subscription bypass...")

    await serviceSupabase
      .from("users")
      .update({
        bypass_subscription: bypassSubscription,
        ...(bypassSubscription ? { is_active: true } : {}) // Only set active if granting bypass
      })
      .eq("id", userId)

    if (bypassSubscription) {
      processLog.push("✅ Subscription bypass granted, user set to active")
    } else {
      processLog.push("✅ Subscription bypass removed (user status unchanged, will be handled by cron)")
    }

    // Process bypass_direct_referrals (set count 0-18)
    processLog.push("Processing direct referrals bypass count...")

    await serviceSupabase
      .from("users")
      .update({ bypass_direct_referrals: bypassDirectReferralsCount })
      .eq("id", userId)

    if (bypassDirectReferralsCount > 0) {
      processLog.push(`✅ Direct referrals bypass count set to ${bypassDirectReferralsCount}`)
    } else {
      processLog.push("✅ Direct referrals bypass removed (count set to 0)")
    }

    return NextResponse.json({
      success: true,
      message: "Bypass access granted successfully",
      processLog
    })

  } catch (error) {
    console.error("Bypass grant error:", error)
    return NextResponse.json(
      {
        error: "Failed to grant bypass access",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
