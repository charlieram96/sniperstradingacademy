import { NextRequest, NextResponse } from "next/server"
import { stripe, COMMISSION_RATE, MONTHLY_PRICE } from "@/lib/stripe/server"
import { createClient } from "@/lib/supabase/server"
import Stripe from "stripe"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get("stripe-signature")!

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

  const supabase = await createClient()

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const subscriptionId = session.subscription as string

        if (userId && subscriptionId) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription

          // Save subscription to database
          const periodStart = 'current_period_start' in subscription ? subscription.current_period_start as number : Date.now() / 1000
          const periodEnd = 'current_period_end' in subscription ? subscription.current_period_end as number : (Date.now() / 1000) + 30 * 24 * 60 * 60
          
          await supabase
            .from("subscriptions")
            .insert({
              user_id: userId,
              stripe_subscription_id: subscriptionId,
              stripe_price_id: subscription.items.data[0].price.id,
              status: subscription.status,
              current_period_start: new Date(periodStart * 1000).toISOString(),
              current_period_end: new Date(periodEnd * 1000).toISOString(),
            })

          // Update referral status to active
          await supabase
            .from("referrals")
            .update({ status: "active" })
            .eq("referred_id", userId)
        }
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = ('subscription' in invoice ? invoice.subscription : null) as string | null
        const customerId = invoice.customer as string

        // Get user by Stripe customer ID
        const { data: user } = await supabase
          .from("users")
          .select("id, referred_by")
          .eq("stripe_customer_id", customerId)
          .single()

        if (user) {
          // Create payment record
          const { data: payment } = await supabase
            .from("payments")
            .insert({
              user_id: user.id,
              stripe_payment_intent_id: ('payment_intent' in invoice ? invoice.payment_intent : '') as string,
              amount: ('amount_paid' in invoice ? invoice.amount_paid as number : 0) / 100, // Convert from cents
              currency: ('currency' in invoice ? invoice.currency : 'usd') as string,
              status: "succeeded",
            })
            .select()
            .single()

          // If user was referred, create commission
          if (user.referred_by && payment) {
            const commissionAmount = (MONTHLY_PRICE / 100) * COMMISSION_RATE
            
            await supabase
              .from("commissions")
              .insert({
                referrer_id: user.referred_by,
                referred_id: user.id,
                payment_id: payment.id,
                amount: commissionAmount,
                status: "pending",
              })
          }

          // Update subscription if we have a subscription ID
          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription
            const periodStart = 'current_period_start' in subscription ? subscription.current_period_start as number : Date.now() / 1000
            const periodEnd = 'current_period_end' in subscription ? subscription.current_period_end as number : (Date.now() / 1000) + 30 * 24 * 60 * 60
            
            await supabase
              .from("subscriptions")
              .update({
                status: subscription.status,
                current_period_start: new Date(periodStart * 1000).toISOString(),
                current_period_end: new Date(periodEnd * 1000).toISOString(),
              })
              .eq("stripe_subscription_id", subscriptionId)
          }
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        
        // Update subscription status
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id)

        // Update referral status
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single()

        if (sub) {
          await supabase
            .from("referrals")
            .update({ status: "inactive" })
            .eq("referred_id", sub.user_id)
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const periodStart = 'current_period_start' in subscription ? subscription.current_period_start as number : Date.now() / 1000
        const periodEnd = 'current_period_end' in subscription ? subscription.current_period_end as number : (Date.now() / 1000) + 30 * 24 * 60 * 60
        
        await supabase
          .from("subscriptions")
          .update({
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: new Date(periodStart * 1000).toISOString(),
            current_period_end: new Date(periodEnd * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook processing error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}