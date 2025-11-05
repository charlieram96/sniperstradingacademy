/**
 * Identification Script for Missing Stripe Payments
 *
 * This script identifies users who have:
 * 1. A Stripe customer ID (indicating they attempted to pay)
 * 2. No payment record in the database
 * 3. Successful payment in Stripe
 *
 * Run: npx tsx scripts/identify-missing-payments.ts
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MissingPayment {
  userId: string
  email: string
  name: string
  stripeCustomerId: string
  isActive: boolean
  hasPaymentRecord: boolean
  stripePaymentId?: string
  stripePaymentAmount?: number
  stripePaymentDate?: Date
  membershipStatus?: string
}

async function identifyMissingPayments() {
  console.log('🔍 Starting identification of missing payments...\n')

  // Step 1: Get all users with Stripe customer IDs
  console.log('📊 Fetching users from database...')
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, name, stripe_customer_id, is_active, membership_status, initial_payment_completed, created_at')
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })

  if (usersError) {
    console.error('❌ Error fetching users:', usersError)
    return
  }

  console.log(`✅ Found ${users.length} users with Stripe customer IDs\n`)

  // Step 2: Check each user for missing payments
  const missingPayments: MissingPayment[] = []
  let checked = 0

  for (const user of users) {
    checked++
    process.stdout.write(`\rChecking ${checked}/${users.length} users...`)

    // Check if user has payment record in database
    const { data: payment } = await supabase
      .from('payments')
      .select('id, amount, payment_type, status')
      .eq('user_id', user.id)
      .eq('payment_type', 'initial')
      .single()

    // If no payment record or user not activated, check Stripe
    if (!payment || !user.initial_payment_completed) {
      try {
        // Get payment intents from Stripe for this customer
        const paymentIntents = await stripe.paymentIntents.list({
          customer: user.stripe_customer_id,
          limit: 10
        })

        // Look for successful $499 payment
        const successfulPayment = paymentIntents.data.find(
          pi => pi.status === 'succeeded' && pi.amount === 49900
        )

        if (successfulPayment) {
          missingPayments.push({
            userId: user.id,
            email: user.email,
            name: user.name || 'Unknown',
            stripeCustomerId: user.stripe_customer_id,
            isActive: user.is_active,
            hasPaymentRecord: !!payment,
            stripePaymentId: successfulPayment.id,
            stripePaymentAmount: successfulPayment.amount / 100,
            stripePaymentDate: new Date(successfulPayment.created * 1000),
            membershipStatus: user.membership_status
          })
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (stripeError) {
        console.error(`\n⚠️  Error checking Stripe for ${user.email}:`, stripeError)
      }
    }
  }

  console.log('\n\n' + '='.repeat(80))
  console.log('📋 IDENTIFICATION RESULTS')
  console.log('='.repeat(80) + '\n')

  if (missingPayments.length === 0) {
    console.log('✅ No missing payments found! All Stripe payments are synced.\n')
    return
  }

  console.log(`❌ Found ${missingPayments.length} users with missing/incomplete payments:\n`)

  // Display results in a table
  console.log('┌─────────────────────────────────────┬───────────────────────────────┬──────────┬─────────┬─────────────────┐')
  console.log('│ Email                               │ Name                          │ Active   │ Has DB  │ Stripe Amount   │')
  console.log('├─────────────────────────────────────┼───────────────────────────────┼──────────┼─────────┼─────────────────┤')

  for (const missing of missingPayments) {
    const email = missing.email.padEnd(35).substring(0, 35)
    const name = (missing.name || '').padEnd(29).substring(0, 29)
    const active = missing.isActive ? 'Yes ✓   ' : 'No ✗    '
    const hasDB = missing.hasPaymentRecord ? 'Yes ✓  ' : 'No ✗   '
    const amount = `$${missing.stripePaymentAmount}       `.substring(0, 15)

    console.log(`│ ${email} │ ${name} │ ${active} │ ${hasDB} │ ${amount} │`)
  }

  console.log('└─────────────────────────────────────┴───────────────────────────────┴──────────┴─────────┴─────────────────┘\n')

  // Export detailed JSON for recovery script
  const exportData = {
    generatedAt: new Date().toISOString(),
    totalAffected: missingPayments.length,
    users: missingPayments.map(m => ({
      userId: m.userId,
      email: m.email,
      name: m.name,
      stripeCustomerId: m.stripeCustomerId,
      stripePaymentId: m.stripePaymentId,
      stripePaymentDate: m.stripePaymentDate,
      currentStatus: {
        isActive: m.isActive,
        hasPaymentRecord: m.hasPaymentRecord,
        membershipStatus: m.membershipStatus
      }
    }))
  }

  // Write to JSON file
  const fs = await import('fs/promises')
  await fs.writeFile(
    'missing-payments-report.json',
    JSON.stringify(exportData, null, 2)
  )

  console.log('📄 Detailed report saved to: missing-payments-report.json\n')
  console.log('=' + '='.repeat(79) + '\n')
  console.log('🔧 NEXT STEPS:\n')
  console.log('1. Review the affected users above')
  console.log('2. Run the recovery script: npx tsx scripts/sync-missing-payments.ts')
  console.log('3. Verify each user after recovery\n')

  // Show SQL query for manual verification
  console.log('📊 SQL Query to verify these users in Supabase:\n')
  console.log('```sql')
  console.log('SELECT')
  console.log('  u.email,')
  console.log('  u.name,')
  console.log('  u.is_active,')
  console.log('  u.initial_payment_completed,')
  console.log('  u.membership_status,')
  console.log('  p.amount,')
  console.log('  p.created_at as payment_date')
  console.log('FROM users u')
  console.log('LEFT JOIN payments p ON p.user_id = u.id AND p.payment_type = \'initial\'')
  console.log('WHERE u.stripe_customer_id IN (')
  missingPayments.forEach((m, i) => {
    console.log(`  '${m.stripeCustomerId}'${i < missingPayments.length - 1 ? ',' : ''}`)
  })
  console.log(');')
  console.log('```\n')
}

// Run the identification
identifyMissingPayments()
  .then(() => {
    console.log('✅ Identification complete!\n')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
