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
          // Handle initial $500 payment
          console.log("Processing initial payment for user:", userId)

          // Get user's network position to check if we need to increment active count
          const { data: userBeforeUpdate } = await supabase
            .from("users")
            .select("network_position_id, is_active")
            .eq("id", userId)
            .single()

          const wasActiveBefore = userBeforeUpdate?.is_active || false

          // Update user status with 30-day grace period
          const { data: userData, error: userError} = await supabase
            .from("users")
            .update({
              membership_status: "unlocked",
              initial_payment_completed: true,
              initial_payment_date: new Date().toISOString(), // 30-day grace period calculated from this date
              is_active: true, // User becomes active immediately after $500 payment
              last_payment_date: new Date().toISOString()
            })
            .eq("id", userId)
            .select()

          if (userError) {
            console.error("❌ Error updating user:", userError)
          } else {
            console.log("✅ User updated successfully with 30-day grace period:", userData)
          }

          // Increment active network count for all ancestors (user just became active)
          if (userBeforeUpdate?.network_position_id && !wasActiveBefore) {
            try {
              const { data: ancestorsIncremented, error: incrementError } = await supabase
                .rpc('increment_upchain_active_count', {
                  p_user_id: userId
                })

              if (incrementError) {
                console.error('❌ Error incrementing active count:', incrementError)
              } else {
                console.log(`✅ User became active! Incremented active_network_count for ${ancestorsIncremented || 0} ancestors`)
              }
            } catch (err) {
              console.error('❌ Exception incrementing active count:', err)
            }
          }

          // Update referral status if user was referred
          const { error: referralError } = await supabase
            .from("referrals")
            .update({
              initial_payment_status: "completed",
              status: "active"
            })
            .eq("referred_id", userId)

          if (referralError) {
            console.error("❌ Error updating referral:", referralError)
          } else {
            console.log("✅ Referral updated successfully")
          }

          // Record payment
          const { error: paymentError } = await supabase
            .from("payments")
            .insert({
              user_id: userId,
              stripe_payment_intent_id: session.payment_intent as string,
              amount: 500,
              payment_type: "initial",
              status: "succeeded",
            })

          if (paymentError) {
            console.error("❌ Error recording payment:", paymentError)
          } else {
            console.log("✅ Payment recorded successfully")
          }

          console.log("Initial payment processed successfully for user:", userId)
        } else if (paymentType === "subscription" && session.subscription) {
          // Handle subscription creation
          const subscriptionId = session.subscription as string

          // Create subscription record without fetching details (they'll be updated via subscription events)
          await supabase
            .from("subscriptions")
            .insert({
              user_id: userId,
              stripe_subscription_id: subscriptionId,
              status: "active",
              monthly_amount: 199,
            })

          console.log("Subscription created for user:", userId)
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
          cancel_at_period_end: boolean | null
          updated_at: string
          current_period_start?: string
          current_period_end?: string
        } = {
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }

        // Add period dates if available
        if ('current_period_start' in subscription && subscription.current_period_start) {
          updateData.current_period_start = new Date((subscription.current_period_start as number) * 1000).toISOString()
        }
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
              .rpc('distribute_to_upline', {
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

      // Transfer events (for commission transfers to connected accounts)
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer
        const userId = transfer.metadata?.userId
        
        if (userId) {
          console.log(`Transfer created for user ${userId}: ${transfer.amount / 100} USD`)
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