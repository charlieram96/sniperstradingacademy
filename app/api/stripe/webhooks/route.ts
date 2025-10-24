import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { getStripe } from "@/lib/stripe/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import Stripe from "stripe"

const stripe = getStripe()
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get("stripe-signature")

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS (webhooks have no user session)
    const supabase = createServiceRoleClient()

    // Handle different event types
    switch (event.type) {
      // Connect account events
      case "account.updated": {
        const account = event.data.object as Stripe.Account
        console.log("Connect account updated:", account.id)
        
        // Update user's Connect account status in database if needed
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("stripe_connect_account_id", account.id)
          .single()
        
        if (user) {
          console.log(`Account ${account.id} for user ${user.id} updated`)
          // You can store additional account details if needed
        }
        break
      }

      case "account.application.deauthorized": {
        // Handle Connect account deauthorization
        console.log("Connect application deauthorized:", event.data.object)
        
        // In production, you might want to store the application ID 
        // or handle this through metadata
        break
      }

      // Payment and subscription events
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const paymentType = session.metadata?.paymentType
        
        if (!userId) {
          console.error("No userId in checkout session metadata")
          break
        }

        if (paymentType === "initial") {
          // Handle initial $499 payment
          console.log("Processing initial payment for user:", userId)

          // Get user data to check position assignment and active status
          const { data: userBeforeUpdate } = await supabase
            .from("users")
            .select("network_position_id, is_active, referred_by")
            .eq("id", userId)
            .single()

          const wasActiveBefore = userBeforeUpdate?.is_active || false

          // STEP 1: Assign network position if user doesn't have one yet
          if (!userBeforeUpdate?.network_position_id) {
            console.log("🎯 User has no network position yet, assigning now...")

            const { data: positionId, error: positionError } = await supabase
              .rpc('assign_network_position', {
                p_user_id: userId,
                p_referrer_id: userBeforeUpdate?.referred_by || null
              })

            if (positionError) {
              console.error('❌ Error assigning network position:', positionError)
              // Continue with payment processing even if position assignment fails
            } else {
              console.log(`✅ Network position assigned: ${positionId}`)

              // The assign_network_position function already increments total_network_count
              // Log upchain for visibility
              try {
                const { data: upchain, error: upchainError } = await supabase
                  .rpc('get_upline_chain', { start_position_id: positionId })

                if (!upchainError && upchain && upchain.length > 0) {
                  const ancestorIds = (upchain as Array<{ user_id: string }>).filter((a) => a.user_id !== userId).map((a) => a.user_id)
                  console.log(`✅ Incremented total_network_count for ${ancestorIds.length} ancestors`)

                  if (ancestorIds.length > 0) {
                    const preview = ancestorIds.slice(0, 3)
                    console.log(`   Affected ancestor IDs: [${preview.join(', ')}${ancestorIds.length > 3 ? `, ... +${ancestorIds.length - 3} more` : ''}]`)
                  }
                }
              } catch (upchainErr) {
                console.error('Error fetching upchain for logging:', upchainErr)
              }
            }
          } else {
            console.log(`ℹ️  User already has network position: ${userBeforeUpdate.network_position_id}`)
          }

          // Update user status with 30-day grace period
          const { data: userData, error: userError} = await supabase
            .from("users")
            .update({
              membership_status: "unlocked",
              initial_payment_completed: true,
              initial_payment_date: new Date().toISOString(), // 30-day grace period calculated from this date
              is_active: true, // User becomes active immediately after $499 payment
              last_payment_date: new Date().toISOString()
            })
            .eq("id", userId)
            .select()

          if (userError) {
            console.error("❌ Error updating user:", userError)
          } else {
            console.log("✅ User updated successfully with 30-day grace period:", userData)
          }

          // STEP 2: Increment active network count for all ancestors (user just became active)
          // Re-fetch user to get the potentially newly assigned network_position_id
          const { data: userAfterPositionAssignment } = await supabase
            .from("users")
            .select("network_position_id")
            .eq("id", userId)
            .single()

          if (userAfterPositionAssignment?.network_position_id && !wasActiveBefore) {
            try {
              const { data: ancestorsIncremented, error: incrementError } = await supabase
                .rpc('increment_upchain_active_count', {
                  p_user_id: userId
                })

              if (incrementError) {
                console.error('❌ Error incrementing active count:', incrementError)
              } else {
                console.log(`✅ User ${userId} became ACTIVE after $499 payment!`)
                console.log(`✅ Incremented active_network_count for ${ancestorsIncremented || 0} ancestors in upchain`)

                // Log which ancestors were affected
                try {
                  const { data: upchain, error: upchainError } = await supabase
                    .rpc('get_upline_chain', { start_position_id: userAfterPositionAssignment.network_position_id })

                  if (!upchainError && upchain && upchain.length > 0) {
                    const ancestorIds = (upchain as Array<{ user_id: string }>).filter((a) => a.user_id !== userId).map((a) => a.user_id)
                    if (ancestorIds.length > 0) {
                      const preview = ancestorIds.slice(0, 3)
                      console.log(`   Affected ancestor IDs: [${preview.join(', ')}${ancestorIds.length > 3 ? `, ... +${ancestorIds.length - 3} more` : ''}]`)
                    }
                  }
                } catch (upchainErr) {
                  console.error('Error fetching upchain for logging:', upchainErr)
                }
              }
            } catch (err) {
              console.error('❌ Exception incrementing active count:', err)
            }
          } else if (!userAfterPositionAssignment?.network_position_id) {
            console.warn('⚠️  Cannot increment active count: User has no network position')
          }

          // Update referral status if user was referred
          // Check if referral record exists, create if missing (defensive)
          const { data: existingReferral } = await supabase
            .from("referrals")
            .select("id, referrer_id")
            .eq("referred_id", userId)
            .single()

          let referralData: { referrer_id: string } | null = null
          let referralError: unknown = null

          if (!existingReferral && userBeforeUpdate?.referred_by) {
            // Create missing referral record (defensive - should have been created at signup)
            console.log("⚠️  Creating missing referral record for user:", userId)
            const { data: createdReferral, error: createError } = await supabase
              .from("referrals")
              .insert({
                referrer_id: userBeforeUpdate.referred_by,
                referred_id: userId,
                status: "active",
                initial_payment_status: "completed"
              })
              .select("referrer_id")
              .single()

            referralData = createdReferral
            referralError = createError

            if (createError) {
              console.error("❌ Error creating referral:", createError)
            } else {
              console.log("✅ Referral created with 'active' status")
            }
          } else if (existingReferral) {
            // Update existing referral (normal path)
            const { error: updateError } = await supabase
              .from("referrals")
              .update({
                initial_payment_status: "completed",
                status: "active"
              })
              .eq("referred_id", userId)

            referralData = { referrer_id: existingReferral.referrer_id }
            referralError = updateError

            if (updateError) {
              console.error("❌ Error updating referral:", updateError)
            } else {
              console.log("✅ Referral updated to 'active' status")
            }
          } else {
            console.log("ℹ️  No referral to update (user not referred)")
          }

          // Log the direct referrals count update (triggered by database trigger)
          if (!referralError && referralData?.referrer_id) {
            try {
              // Query referrer's updated count
              const { data: referrerData, error: countError } = await supabase
                .from("users")
                .select("name, direct_referrals_count")
                .eq("id", referralData.referrer_id)
                .single()

              if (countError) {
                // Column might not exist if schema not deployed
                console.warn("⚠️  Could not fetch direct_referrals_count - column may not exist")
                console.warn("   Deploy supabase-activation-schema.sql to enable referral counting")
              } else if (referrerData) {
                console.log(`✅ Referrer's direct_referrals_count updated via trigger`)
                console.log(`   Referrer: ${referrerData.name} (${referralData.referrer_id})`)
                console.log(`   New direct_referrals_count: ${referrerData.direct_referrals_count}`)
              }
            } catch (err) {
              console.warn("⚠️  Error fetching direct_referrals_count:", err)
              console.warn("   This is non-critical - referral status was updated successfully")
            }
          }

          // Record payment
          const { error: paymentError } = await supabase
            .from("payments")
            .insert({
              user_id: userId,
              stripe_payment_intent_id: session.payment_intent as string,
              amount: 499,
              payment_type: "initial",
              status: "succeeded",
            })

          if (paymentError) {
            console.error("❌ Error recording payment:", paymentError)
          } else {
            console.log("✅ Payment recorded successfully")
          }

          // Create $249.50 direct bonus for referrer (50% of $499)
          if (referralData?.referrer_id) {
            const bonusAmount = 249.50
            const availableAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now

            const { error: bonusError } = await supabase
              .from("commissions")
              .insert({
                referrer_id: referralData.referrer_id,
                referred_id: userId,
                amount: bonusAmount,
                commission_type: 'direct_bonus',
                status: 'pending',
                available_at: availableAt.toISOString(),
              })

            if (bonusError) {
              console.error("❌ Error creating direct bonus:", bonusError)
            } else {
              console.log(`✅ Created $${bonusAmount} direct bonus for referrer ${referralData.referrer_id}`)
              console.log(`   Available for withdrawal after: ${availableAt.toISOString()}`)
            }
          }

          console.log("Initial payment processed successfully for user:", userId)
        } else if (paymentType === "subscription" && session.subscription) {
          // Handle subscription creation
          const subscriptionId = session.subscription as string

          // Fetch subscription details from Stripe to get period dates
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)

          // Extract period end date
          const periodEnd = 'current_period_end' in stripeSubscription && stripeSubscription.current_period_end
            ? new Date((stripeSubscription.current_period_end as number) * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

          // Create subscription record with period end date
          await supabase
            .from("subscriptions")
            .insert({
              user_id: userId,
              stripe_subscription_id: subscriptionId,
              status: stripeSubscription.status,
              monthly_amount: 199,
              current_period_end: periodEnd,
            })

          console.log("Subscription created for user:", userId)
        }
        break
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        console.log(`📝 Subscription created: ${subscription.id}`)
        console.log(`   Customer: ${customerId}`)
        console.log(`   Status: ${subscription.status}`)
        console.log(`   Amount: $${(subscription.items.data[0]?.price?.unit_amount || 0) / 100}`)

        // Get user from customer ID
        const { data: user } = await supabase
          .from("users")
          .select("id, email, name")
          .eq("stripe_customer_id", customerId)
          .single()

        if (user) {
          console.log(`   User: ${user.name} (${user.email})`)

          // Check if subscription record already exists (created via checkout.session.completed)
          const { data: existingSub } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("stripe_subscription_id", subscription.id)
            .single()

          if (!existingSub) {
            // Create subscription record if not already created
            const periodEnd = 'current_period_end' in subscription && subscription.current_period_end
              ? new Date((subscription.current_period_end as number) * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

            await supabase
              .from("subscriptions")
              .insert({
                user_id: user.id,
                stripe_subscription_id: subscription.id,
                status: subscription.status,
                monthly_amount: (subscription.items.data[0]?.price?.unit_amount || 19900) / 100,
                current_period_end: periodEnd,
              })

            console.log(`✅ Subscription record created for user ${user.id}`)
          } else {
            console.log(`ℹ️  Subscription record already exists (created via checkout)`)
          }
        }
        break
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription

        // Get user's current active status BEFORE updating
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single()

        if (!subData) {
          console.error(`No subscription found for ${subscription.id}`)
          break
        }

        const { data: userData } = await supabase
          .from("users")
          .select("is_active, network_position_id")
          .eq("id", subData.user_id)
          .single()

        const wasActiveBefore = userData?.is_active || false

        const updateData: {
          status: string
          updated_at: string
          current_period_end?: string
        } = {
          status: subscription.status,
          updated_at: new Date().toISOString(),
        }

        // Add period end date if available
        if ('current_period_end' in subscription && subscription.current_period_end) {
          updateData.current_period_end = new Date((subscription.current_period_end as number) * 1000).toISOString()
        }

        // Update subscription record
        await supabase
          .from("subscriptions")
          .update(updateData)
          .eq("stripe_subscription_id", subscription.id)

        // Determine if user should be active based on Stripe subscription status
        const shouldBeActive = subscription.status === 'active'

        // Update user's is_active flag to match Stripe subscription status
        await supabase
          .from("users")
          .update({ is_active: shouldBeActive })
          .eq("id", subData.user_id)

        console.log(`Subscription ${subscription.id} updated to status: ${subscription.status} (was_active: ${wasActiveBefore}, now_active: ${shouldBeActive})`)

        // Handle active count changes based on subscription status change
        if (userData?.network_position_id) {
          // Case 1: Became INACTIVE (subscription no longer active)
          if (wasActiveBefore && !shouldBeActive) {
            try {
              const { data: ancestorsDecremented, error: decrementError } = await supabase
                .rpc('decrement_upchain_active_count', {
                  p_user_id: subData.user_id
                })

              if (decrementError) {
                console.error('❌ Error decrementing active count:', decrementError)
              } else {
                console.log(`✅ Subscription became inactive! Decremented active_network_count for ${ancestorsDecremented || 0} ancestors`)
              }
            } catch (err) {
              console.error('❌ Exception decrementing active count:', err)
            }
          }

          // Case 2: Became ACTIVE (subscription reactivated)
          else if (!wasActiveBefore && shouldBeActive) {
            try {
              const { data: ancestorsIncremented, error: incrementError } = await supabase
                .rpc('increment_upchain_active_count', {
                  p_user_id: subData.user_id
                })

              if (incrementError) {
                console.error('❌ Error incrementing active count:', incrementError)
              } else {
                console.log(`✅ Subscription became active! Incremented active_network_count for ${ancestorsIncremented || 0} ancestors`)
              }
            } catch (err) {
              console.error('❌ Exception incrementing active count:', err)
            }
          }
        }

        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Get user from customer ID
        const { data: user } = await supabase
          .from("users")
          .select("id, payment_schedule, network_position_id")
          .eq("stripe_customer_id", customerId)
          .single()

        // Handle weekly ($49.75), monthly ($199), or legacy monthly ($200)
        const validAmounts = [4975, 19900, 20000] // $49.75, $199, $200 in cents

        if (user && validAmounts.includes(invoice.amount_paid)) {
          const actualAmount = invoice.amount_paid / 100 // Convert to dollars
          const isWeekly = invoice.amount_paid === 4975
          const paymentType = isWeekly ? "weekly" : "monthly"

          // Determine distribution amount
          const distributionAmount = isWeekly ? 49.75 : 199.00

          console.log(`💰 Processing ${paymentType} payment of $${actualAmount} for user ${user.id}`)

          // 1. Record payment
          await supabase
            .from("payments")
            .insert({
              user_id: user.id,
              stripe_payment_intent_id: invoice.id,
              amount: actualAmount,
              payment_type: paymentType,
              status: "succeeded",
            })

          console.log(`✅ ${paymentType.charAt(0).toUpperCase() + paymentType.slice(1)} payment ($${actualAmount}) recorded for user ${user.id}`)

          // 2. Update last_payment_date
          // NOTE: is_active is managed by subscription status, not payment dates
          await supabase
            .from("users")
            .update({
              last_payment_date: new Date().toISOString()
            })
            .eq("id", user.id)

          // 3. Distribute to ENTIRE upline chain (unlimited depth, all the way to root)
          try {
            const { data: ancestorCount, error: distError } = await supabase
              .rpc('distribute_to_upline_batch', {
                p_user_id: user.id,
                p_amount: distributionAmount
              })

            if (distError) {
              console.error('❌ Error distributing to upline:', distError)
            } else {
              console.log(`✅ Distributed $${distributionAmount} to ${ancestorCount || 0} ancestors (all the way to root)`)
            }
          } catch (err) {
            console.error('❌ Exception distributing to upline:', err)
            // Don't block payment processing if distribution fails
          }

          // 4. Update commission rate and structure number based on current counts
          // Note: active_network_count is maintained by subscription status changes
          try {
            const { data: updatedUser } = await supabase
              .from("users")
              .select("active_network_count")
              .eq("id", user.id)
              .single()

            if (updatedUser) {
              // Calculate commission rate and structure number
              const { data: commissionRate } = await supabase
                .rpc('calculate_commission_rate', {
                  active_count: updatedUser.active_network_count
                })

              const { data: structureNumber } = await supabase
                .rpc('calculate_structure_number', {
                  active_count: updatedUser.active_network_count
                })

              // Update the rates
              await supabase
                .from("users")
                .update({
                  current_commission_rate: commissionRate,
                  current_structure_number: structureNumber
                })
                .eq("id", user.id)

              console.log(`✅ Updated commission rate (${commissionRate}) and structure (${structureNumber}) for user ${user.id}`)
            }
          } catch (err) {
            console.error('❌ Error updating commission rate:', err)
          }
        }
        break
      }

      // Payout events (for tracking commission payouts)
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout
        console.log("Payout completed:", payout.id)
        
        // You can track successful payouts here
        // The payout metadata should contain user information
        break
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout
        console.error("Payout failed:", payout.id, payout.failure_message)

        // Handle failed payouts - maybe notify the user
        break
      }

      case "payout.canceled": {
        const payout = event.data.object as Stripe.Payout
        console.warn("Payout canceled:", payout.id)
        console.warn(`   Amount: $${payout.amount / 100}`)
        console.warn(`   Status: ${payout.status}`)

        // Track which user's payout was cancelled
        const { data: user } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("stripe_connect_account_id", payout.destination)
          .single()

        if (user) {
          console.warn(`   User: ${user.name} (${user.email})`)
          // TODO: Consider notifying user about cancelled payout
        }
        break
      }

      // Transfer events (for commission transfers to connected accounts)
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer
        const userId = transfer.metadata?.userId

        if (userId) {
          console.log(`Transfer created for user ${userId}: ${transfer.amount / 100} USD`)
        }
        break
      }

      // Failed invoice payment (recurring payment failure)
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const attemptCount = invoice.attempt_count || 0
        const nextPaymentAttempt = invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toISOString()
          : null

        console.error(`❌ Invoice payment failed for customer ${customerId}`)
        console.error(`   Attempt count: ${attemptCount}`)
        console.error(`   Amount due: $${invoice.amount_due / 100}`)
        console.error(`   Next retry: ${nextPaymentAttempt || 'No retry scheduled'}`)

        // Get user from customer ID
        const { data: user } = await supabase
          .from("users")
          .select("id, email, name")
          .eq("stripe_customer_id", customerId)
          .single()

        if (user) {
          // Record failed payment
          const paymentIntentId = ('payment_intent' in invoice && typeof invoice.payment_intent === 'string')
            ? invoice.payment_intent
            : invoice.id

          await supabase
            .from("payments")
            .insert({
              user_id: user.id,
              stripe_payment_intent_id: paymentIntentId,
              amount: invoice.amount_due / 100,
              payment_type: "monthly",
              status: "failed",
            })

          console.log(`📝 Recorded failed payment for user ${user.id} (${user.email})`)
          console.log(`⚠️  Stripe will retry automatically. If all retries fail, subscription will be cancelled.`)

          // TODO: Send notification to user to update payment method
          // await sendPaymentFailureEmail(user.email, attemptCount, nextPaymentAttempt)
        }
        break
      }

      // Failed payment intent (initial payment failure)
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const customerId = paymentIntent.customer as string
        const failureMessage = paymentIntent.last_payment_error?.message || "Unknown error"

        console.error(`❌ Payment Intent failed: ${paymentIntent.id}`)
        console.error(`   Customer: ${customerId}`)
        console.error(`   Amount: $${paymentIntent.amount / 100}`)
        console.error(`   Failure reason: ${failureMessage}`)

        // Get user from customer ID
        const { data: user } = await supabase
          .from("users")
          .select("id, email, name")
          .eq("stripe_customer_id", customerId)
          .single()

        if (user) {
          // Record failed payment attempt
          await supabase
            .from("payments")
            .insert({
              user_id: user.id,
              stripe_payment_intent_id: paymentIntent.id,
              amount: paymentIntent.amount / 100,
              payment_type: paymentIntent.amount === 49900 ? "initial" : "monthly",
              status: "failed",
            })

          console.log(`📝 Recorded failed payment intent for user ${user.id} (${user.email})`)
          console.log(`   User can retry payment through checkout`)

          // TODO: Send notification to user about failed payment
          // await sendPaymentFailedNotification(user.email, failureMessage)
        }
        break
      }

      // Dispute created (chargeback initiated)
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute
        const chargeId = dispute.charge as string
        const amount = dispute.amount / 100
        const reason = dispute.reason
        const evidenceDeadline = dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
          : null

        console.error(`⚠️  DISPUTE CREATED: ${dispute.id}`)
        console.error(`   Charge: ${chargeId}`)
        console.error(`   Amount: $${amount}`)
        console.error(`   Reason: ${reason}`)
        console.error(`   Evidence due by: ${evidenceDeadline}`)

        // Find the payment record
        const { data: payment } = await supabase
          .from("payments")
          .select("id, user_id, payment_type, amount")
          .eq("stripe_payment_intent_id", chargeId)
          .single()

        if (payment) {
          // Update payment to mark as disputed
          await supabase
            .from("payments")
            .update({ status: "disputed" })
            .eq("id", payment.id)

          console.log(`📝 Marked payment ${payment.id} as disputed`)

          // If initial payment, flag the direct bonus as disputed
          if (payment.payment_type === "initial") {
            const { data: commission } = await supabase
              .from("commissions")
              .update({ status: "cancelled" })
              .eq("referred_id", payment.user_id)
              .eq("commission_type", "direct_bonus")
              .eq("status", "pending")
              .select()

            if (commission && commission.length > 0) {
              console.log(`⚠️  Cancelled ${commission.length} pending direct bonus(es) due to dispute`)
            }
          }

          // If recurring payment, flag upline commissions as disputed
          if (payment.payment_type === "monthly" || payment.payment_type === "weekly") {
            const { data: commissions } = await supabase
              .from("commissions")
              .update({ status: "cancelled" })
              .eq("referred_id", payment.user_id)
              .eq("commission_type", "residual")
              .eq("status", "pending")
              .select()

            if (commissions && commissions.length > 0) {
              console.log(`⚠️  Cancelled ${commissions.length} pending residual commission(s) due to dispute`)
            }
          }

          console.log(`🚨 ADMIN ALERT: Dispute created for user ${payment.user_id}`)
          console.log(`   Evidence deadline: ${evidenceDeadline}`)

          // TODO: Send admin notification about dispute
          // await sendAdminDisputeAlert(payment.user_id, dispute.id, amount, reason, evidenceDeadline)
        }
        break
      }

      // Charge refunded
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        const refundAmount = charge.amount_refunded / 100
        const chargeId = charge.id

        console.log(`💸 REFUND PROCESSED: ${chargeId}`)
        console.log(`   Amount refunded: $${refundAmount}`)

        // Find the payment record
        const { data: payment } = await supabase
          .from("payments")
          .select("id, user_id, payment_type, amount")
          .eq("stripe_payment_intent_id", chargeId)
          .single()

        if (payment) {
          // Update payment to mark as refunded
          await supabase
            .from("payments")
            .update({ status: "refunded" })
            .eq("id", payment.id)

          console.log(`📝 Marked payment ${payment.id} as refunded`)

          // Handle initial payment refund ($499)
          if (payment.payment_type === "initial" && payment.amount >= 499) {
            console.log(`⚠️  Initial payment refunded for user ${payment.user_id}`)

            // Get user details
            const { data: user } = await supabase
              .from("users")
              .select("referred_by, is_active, network_position_id")
              .eq("id", payment.user_id)
              .single()

            // Cancel the $249.50 direct bonus if not already withdrawn
            const { data: cancelledBonus } = await supabase
              .from("commissions")
              .update({ status: "cancelled" })
              .eq("referred_id", payment.user_id)
              .eq("commission_type", "direct_bonus")
              .in("status", ["pending"])
              .select()

            if (cancelledBonus && cancelledBonus.length > 0) {
              console.log(`✅ Cancelled direct bonus of $249.50 for refunded initial payment`)
            }

            // Decrement referrer's direct_referrals_count
            if (user?.referred_by) {
              // Get current count first
              const { data: referrer } = await supabase
                .from("users")
                .select("direct_referrals_count")
                .eq("id", user.referred_by)
                .single()

              if (referrer) {
                await supabase
                  .from("users")
                  .update({
                    direct_referrals_count: Math.max((referrer.direct_referrals_count || 0) - 1, 0)
                  })
                  .eq("id", user.referred_by)

                console.log(`✅ Decremented referrer's direct_referrals_count`)
              }
            }

            // Deactivate user and decrement upchain counts
            if (user?.is_active && user?.network_position_id) {
              await supabase
                .from("users")
                .update({
                  is_active: false,
                  membership_status: "locked"
                })
                .eq("id", payment.user_id)

              // Decrement upchain active count
              await supabase
                .rpc('decrement_upchain_active_count', {
                  p_user_id: payment.user_id
                })

              console.log(`✅ Deactivated user and decremented upchain counts`)
            }

            // Update referral status
            await supabase
              .from("referrals")
              .update({
                status: "inactive",
                initial_payment_status: "failed"
              })
              .eq("referred_id", payment.user_id)

            console.log(`📝 User ${payment.user_id} access revoked due to refunded initial payment`)
          }

          // Handle recurring payment refund
          else if (payment.payment_type === "monthly" || payment.payment_type === "weekly") {
            console.log(`⚠️  Recurring payment refunded for user ${payment.user_id}`)

            // Cancel any pending residual commissions from this payment
            const { data: cancelledCommissions } = await supabase
              .from("commissions")
              .update({ status: "cancelled" })
              .eq("referred_id", payment.user_id)
              .eq("commission_type", "residual")
              .eq("status", "pending")
              .select()

            if (cancelledCommissions && cancelledCommissions.length > 0) {
              console.log(`✅ Cancelled ${cancelledCommissions.length} pending residual commission(s)`)
            }
          }

          console.log(`✅ Refund processed for payment ${payment.id}`)
        }
        break
      }

      // Subscription paused
      case "customer.subscription.paused": {
        const subscription = event.data.object as Stripe.Subscription

        console.log(`⏸️  Subscription paused: ${subscription.id}`)

        // Get user's current active status BEFORE updating
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single()

        if (!subData) {
          console.error(`No subscription found for ${subscription.id}`)
          break
        }

        const { data: userData } = await supabase
          .from("users")
          .select("is_active, network_position_id")
          .eq("id", subData.user_id)
          .single()

        const wasActiveBefore = userData?.is_active || false

        // Update subscription status
        await supabase
          .from("subscriptions")
          .update({
            status: "paused",
            updated_at: new Date().toISOString()
          })
          .eq("stripe_subscription_id", subscription.id)

        // Temporarily deactivate user
        await supabase
          .from("users")
          .update({ is_active: false })
          .eq("id", subData.user_id)

        console.log(`📝 Subscription ${subscription.id} paused, user ${subData.user_id} deactivated`)

        // Decrement upchain active count if user was active
        if (wasActiveBefore && userData?.network_position_id) {
          const { data: ancestorsDecremented } = await supabase
            .rpc('decrement_upchain_active_count', {
              p_user_id: subData.user_id
            })

          console.log(`✅ Decremented active_network_count for ${ancestorsDecremented || 0} ancestors`)
        }
        break
      }

      // Dispute closed (resolved)
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute
        const chargeId = dispute.charge as string
        const status = dispute.status // 'won', 'lost', 'warning_closed'
        const amount = dispute.amount / 100

        console.log(`🏁 DISPUTE CLOSED: ${dispute.id}`)
        console.log(`   Status: ${status}`)
        console.log(`   Charge: ${chargeId}`)
        console.log(`   Amount: $${amount}`)

        // Find the payment record
        const { data: payment } = await supabase
          .from("payments")
          .select("id, user_id, payment_type")
          .eq("stripe_payment_intent_id", chargeId)
          .single()

        if (payment) {
          if (status === "won") {
            // Dispute won - restore payment status
            await supabase
              .from("payments")
              .update({ status: "succeeded" })
              .eq("id", payment.id)

            console.log(`✅ Dispute WON! Payment ${payment.id} restored to succeeded status`)
            console.log(`   Note: Previously cancelled commissions were not restored`)

            // TODO: Consider restoring commissions if they were cancelled
            // This requires more complex logic to check if commissions are still valid
          }
          else if (status === "lost") {
            // Dispute lost - ensure payment is marked as refunded
            await supabase
              .from("payments")
              .update({ status: "refunded" })
              .eq("id", payment.id)

            console.log(`❌ Dispute LOST. Payment ${payment.id} marked as refunded`)

            // Ensure commissions are cancelled (should already be done)
            if (payment.payment_type === "initial") {
              await supabase
                .from("commissions")
                .update({ status: "cancelled" })
                .eq("referred_id", payment.user_id)
                .eq("commission_type", "direct_bonus")
                .in("status", ["pending"])
            }
          }
          else if (status === "warning_closed") {
            // Warning closed without escalation
            await supabase
              .from("payments")
              .update({ status: "succeeded" })
              .eq("id", payment.id)

            console.log(`ℹ️  Dispute warning closed without escalation. Payment ${payment.id} remains valid`)
          }

          console.log(`📝 Dispute ${dispute.id} closed with status: ${status}`)
        }
        break
      }

      // External account events (bank account changes)
      case "account.external_account.created": {
        const externalAccount = event.data.object as Stripe.BankAccount | Stripe.Card
        const accountId = event.account as string

        console.log(`🏦 External account CREATED for Connect account: ${accountId}`)
        console.log(`   Account type: ${externalAccount.object}`)

        if (externalAccount.object === "bank_account") {
          const bankAccount = externalAccount as Stripe.BankAccount
          console.log(`   Bank: ${bankAccount.bank_name || 'Unknown'}`)
          console.log(`   Last 4: ${bankAccount.last4}`)
          console.log(`   Status: ${bankAccount.status}`)
        }

        // Find user with this Connect account
        const { data: user } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("stripe_connect_account_id", accountId)
          .single()

        if (user) {
          console.log(`📝 External account added for user ${user.id} (${user.email})`)
          // Store audit trail if needed
        }
        break
      }

      case "account.external_account.updated": {
        const externalAccount = event.data.object as Stripe.BankAccount | Stripe.Card
        const accountId = event.account as string

        console.log(`🏦 External account UPDATED for Connect account: ${accountId}`)
        console.log(`   Account type: ${externalAccount.object}`)

        if (externalAccount.object === "bank_account") {
          const bankAccount = externalAccount as Stripe.BankAccount
          console.log(`   Bank: ${bankAccount.bank_name || 'Unknown'}`)
          console.log(`   Last 4: ${bankAccount.last4}`)
          console.log(`   Status: ${bankAccount.status}`)
        }

        // Find user with this Connect account
        const { data: user } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("stripe_connect_account_id", accountId)
          .single()

        if (user) {
          console.log(`📝 External account updated for user ${user.id} (${user.email})`)
          // Store audit trail if needed
        }
        break
      }

      case "account.external_account.deleted": {
        const externalAccount = event.data.object as Stripe.BankAccount | Stripe.Card
        const accountId = event.account as string

        console.warn(`🚨 External account DELETED for Connect account: ${accountId}`)
        console.warn(`   Account type: ${externalAccount.object}`)

        if (externalAccount.object === "bank_account") {
          const bankAccount = externalAccount as Stripe.BankAccount
          console.warn(`   Bank: ${bankAccount.bank_name || 'Unknown'}`)
          console.warn(`   Last 4: ${bankAccount.last4}`)
        }

        // Find user with this Connect account
        const { data: user } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("stripe_connect_account_id", accountId)
          .single()

        if (user) {
          console.warn(`⚠️  Bank account removed by user ${user.id} (${user.email})`)
          console.warn(`   This may be a red flag - consider reviewing user account`)
          // TODO: Send admin notification if suspicious
          // Store audit trail for security review
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook handler error:", error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }
}