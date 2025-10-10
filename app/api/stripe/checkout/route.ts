import { NextRequest, NextResponse } from "next/server"
import { getStripe, MONTHLY_PRICE, WEEKLY_PRICE, INITIAL_PAYMENT } from "@/lib/stripe/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { paymentType = "subscription", paymentSchedule = "monthly" } = await req.json()

    // Get or create Stripe customer
    const { data: userData } = await supabase
      .from("users")
      .select("stripe_customer_id, email, membership_status, initial_payment_completed")
      .eq("id", user.id)
      .single()

    const stripe = getStripe()
    let customerId = userData?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData?.email || user.email!,
        metadata: {
          userId: user.id,
        },
      })

      customerId = customer.id

      // Update user with Stripe customer ID
      await supabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id)
    }

    let checkoutSession

    if (paymentType === "initial") {
      // Check if user already paid initial payment
      if (userData?.initial_payment_completed) {
        return NextResponse.json(
          { error: "Initial payment already completed" },
          { status: 400 }
        )
      }

      // Create one-time payment session for $500 initial payment
      checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Snipers Trading Academy Membership",
                description: "One-time membership fee to unlock your 3 referral slots and start earning",
              },
              unit_amount: INITIAL_PAYMENT,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.nextUrl.origin}/dashboard?initial_payment=success`,
        cancel_url: `${req.nextUrl.origin}/payments?canceled=true`,
        metadata: {
          userId: user.id,
          paymentType: "initial",
        },
      })
    } else {
      // Check if user has completed initial payment
      if (!userData?.initial_payment_completed) {
        return NextResponse.json(
          { error: "Please complete initial payment first" },
          { status: 400 }
        )
      }

      // Determine pricing and interval based on payment schedule
      const priceAmount = paymentSchedule === 'weekly' ? WEEKLY_PRICE : MONTHLY_PRICE
      const recurringInterval = paymentSchedule === 'weekly' ? 'week' : 'month'
      const scheduleLabel = paymentSchedule === 'weekly' ? 'Weekly' : 'Monthly'
      const priceDisplay = paymentSchedule === 'weekly' ? '$49.75/week' : '$199/month'

      // Update user's payment schedule preference
      await supabase
        .from("users")
        .update({ payment_schedule: paymentSchedule })
        .eq("id", user.id)

      // Create subscription checkout session
      checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Snipers Trading Academy ${scheduleLabel} Subscription`,
                description: `${scheduleLabel} subscription (${priceDisplay}) - Earn commission from your team volume`,
              },
              unit_amount: priceAmount,
              recurring: {
                interval: recurringInterval,
              },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${req.nextUrl.origin}/dashboard?subscription=success&schedule=${paymentSchedule}`,
        cancel_url: `${req.nextUrl.origin}/payments?canceled=true`,
        metadata: {
          userId: user.id,
          paymentType: "subscription",
          paymentSchedule: paymentSchedule,
        },
      })
    }

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Stripe checkout error:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}