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

          // Update user status
          const { data: userData, error: userError } = await supabase
            .from("users")
            .update({
              membership_status: "unlocked",
              initial_payment_completed: true,
              initial_payment_date: new Date().toISOString(),
            })
            .eq("id", userId)
            .select()

          if (userError) {
            console.error("❌ Error updating user:", userError)
          } else {
            console.log("✅ User updated successfully:", userData)
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
        
        await supabase
          .from("subscriptions")
          .update(updateData)
          .eq("stripe_subscription_id", subscription.id)
        
        console.log(`Subscription ${subscription.id} updated to status: ${subscription.status}`)
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Get user from customer ID
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single()

        if (user && invoice.amount_paid === 19900) { // $199.00 in cents
          // 1. Record monthly payment
          await supabase
            .from("payments")
            .insert({
              user_id: user.id,
              stripe_payment_intent_id: invoice.id, // Use invoice ID as reference
              amount: 199.00,
              payment_type: "monthly",
              status: "succeeded",
            })

          console.log(`✅ Monthly payment ($199) recorded for user ${user.id}`)

          // 2. Update last_payment_date
          await supabase
            .from("users")
            .update({ last_payment_date: new Date().toISOString() })
            .eq("id", user.id)

          // 3. Distribute $199 to ENTIRE upline chain (unlimited depth, all the way to root)
          try {
            const { data: ancestorCount, error: distError } = await supabase
              .rpc('distribute_to_upline', {
                p_user_id: user.id,
                p_amount: 199.00
              })

            if (distError) {
              console.error('❌ Error distributing to upline:', distError)
            } else {
              console.log(`✅ Distributed $199 to ${ancestorCount || 0} ancestors (all the way to root)`)
            }
          } catch (err) {
            console.error('❌ Exception distributing to upline:', err)
            // Don't block payment processing if distribution fails
          }

          // 4. Update network counts for the user (updates structure completion)
          try {
            await supabase.rpc('update_network_counts', {
              p_user_id: user.id
            })
            console.log(`✅ Updated network counts for user ${user.id}`)
          } catch (err) {
            console.error('❌ Error updating network counts:', err)
          }

          // 5. Update active status
          try {
            await supabase.rpc('update_active_status', {
              p_user_id: user.id
            })
            console.log(`✅ Updated active status for user ${user.id}`)
          } catch (err) {
            console.error('❌ Error updating active status:', err)
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