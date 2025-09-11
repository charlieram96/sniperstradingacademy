import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})

export const MONTHLY_PRICE = 20000 // $200 in cents
export const COMMISSION_RATE = 0.10 // 10% commission