import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})

export const INITIAL_PAYMENT = 50000 // $500 in cents (one-time membership unlock)
export const MONTHLY_PRICE = 20000 // $200 in cents (monthly subscription)
export const COMMISSION_RATE = 0.10 // 10% commission from team pool
export const MAX_REFERRALS = 3 // Maximum direct referrals per member
export const MAX_LEVELS = 6 // Maximum depth of referral tree