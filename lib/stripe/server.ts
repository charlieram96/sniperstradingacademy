import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    })
  }
  return stripeInstance
}

export const INITIAL_PAYMENT = 50000 // $500 in cents (one-time membership unlock)
export const MONTHLY_PRICE = 20000 // $200 in cents (monthly subscription)
export const COMMISSION_RATE = 0.10 // 10% commission from team pool
export const MAX_REFERRALS = 3 // Maximum direct referrals per member
export const MAX_LEVELS = 6 // Maximum depth of referral tree