import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { stripe, MONTHLY_PRICE } from "@/lib/stripe/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    
    // Get or create Stripe customer
    const { data: user } = await supabase
      .from("users")
      .select("stripe_customer_id, email")
      .eq("id", session.user.id)
      .single()

    let customerId = user?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email || session.user.email!,
        metadata: {
          userId: session.user.id,
        },
      })
      
      customerId = customer.id

      // Update user with Stripe customer ID
      await supabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", session.user.id)
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Trading Hub Monthly Subscription",
              description: "Access to trading network and earn commissions",
            },
            unit_amount: MONTHLY_PRICE,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.nextUrl.origin}/dashboard?success=true`,
      cancel_url: `${req.nextUrl.origin}/payments?canceled=true`,
      metadata: {
        userId: session.user.id,
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Stripe checkout error:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}