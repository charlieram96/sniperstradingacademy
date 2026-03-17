/**
 * Recovery Script for Missing Stripe Payments
 *
 * This script syncs missing payments from Stripe to the database by:
 * 1. Reading the missing-payments-report.json file
 * 2. For each affected user, performing all webhook operations manually
 * 3. Logging all operations and results
 *
 * IMPORTANT: Review the missing-payments-report.json before running!
 *
 * Run: npx tsx scripts/sync-missing-payments.ts
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs/promises'

// Load environment variables
dotenv.config({ path: '.env.local' })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RecoveryResult {
  userId: string
  email: string
  success: boolean
  steps: {
    networkPosition?: { success: boolean; positionId?: string; error?: string }
    userActivation?: { success: boolean; error?: string }
    ancestorCounts?: { success: boolean; count?: number; error?: string }
    referralUpdate?: { success: boolean; error?: string }
    paymentRecord?: { success: boolean; error?: string }
    directBonus?: { success: boolean; amount?: number; error?: string }
  }
  errors: string[]
}

async function syncMissingPayment(
  userId: string,
  email: string,
  stripePaymentId: string
): Promise<RecoveryResult> {

  const result: RecoveryResult = {
    userId,
    email,
    success: false,
    steps: {},
    errors: []
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`🔧 SYNCING: ${email}`)
  console.log(`${'='.repeat(80)}\n`)

  try {
    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      result.errors.push('User not found in database')
      console.log('❌ User not found\n')
      return result
    }

    // Get payment from Stripe
    const payment = await stripe.paymentIntents.retrieve(stripePaymentId)

    if (payment.status !== 'succeeded') {
      result.errors.push(`Payment status is ${payment.status}, not succeeded`)
      console.log(`❌ Payment status: ${payment.status}\n`)
      return result
    }

    console.log(`💰 Stripe Payment: $${payment.amount / 100} (${payment.status})`)
    console.log(`📅 Payment Date: ${new Date(payment.created * 1000).toLocaleString()}\n`)

    // STEP 1: Assign network position if missing
    if (!user.network_position_id) {
      console.log('📍 Step 1: Assigning network position...')

      const { data: positionId, error: positionError } = await supabase
        .rpc('assign_network_position', {
          p_user_id: user.id,
          p_referrer_id: user.referred_by || null
        })

      if (positionError) {
        result.steps.networkPosition = { success: false, error: positionError.message }
        result.errors.push(`Network position assignment failed: ${positionError.message}`)
        console.log(`   ❌ Failed: ${positionError.message}`)
      } else {
        result.steps.networkPosition = { success: true, positionId }
        console.log(`   ✅ Position assigned: ${positionId}`)
      }
    } else {
      result.steps.networkPosition = { success: true, positionId: user.network_position_id }
      console.log(`📍 Step 1: ✅ Already has network position: ${user.network_position_id}`)
    }

    // STEP 2: Update user status
    console.log('\n👤 Step 2: Activating user account...')

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        membership_status: 'unlocked',
        initial_payment_completed: true,
        initial_payment_date: new Date(payment.created * 1000).toISOString(),
        is_active: true,
        last_payment_date: new Date(payment.created * 1000).toISOString()
      })
      .eq('id', user.id)

    if (userUpdateError) {
      result.steps.userActivation = { success: false, error: userUpdateError.message }
      result.errors.push(`User activation failed: ${userUpdateError.message}`)
      console.log(`   ❌ Failed: ${userUpdateError.message}`)
      // This is critical - don't continue if user activation fails
      return result
    } else {
      result.steps.userActivation = { success: true }
      console.log('   ✅ User activated (membership unlocked, is_active = true)')
    }

    // STEP 3: Increment active count for ancestors
    console.log('\n📊 Step 3: Updating ancestor active counts...')

    const { data: ancestorCount, error: countError } = await supabase
      .rpc('increment_upchain_active_count', {
        p_user_id: user.id
      })

    if (countError) {
      result.steps.ancestorCounts = { success: false, error: countError.message }
      result.errors.push(`Ancestor count update failed: ${countError.message}`)
      console.log(`   ❌ Failed: ${countError.message}`)
    } else {
      result.steps.ancestorCounts = { success: true, count: ancestorCount }
      console.log(`   ✅ Updated active_network_count for ${ancestorCount || 0} ancestors`)
    }

    // STEP 4: Update referral status
    if (user.referred_by) {
      console.log('\n🤝 Step 4: Updating referral status...')

      const { error: refError } = await supabase
        .from('referrals')
        .update({
          status: 'active',
          initial_payment_status: 'completed'
        })
        .eq('referred_id', user.id)

      if (refError) {
        result.steps.referralUpdate = { success: false, error: refError.message }
        result.errors.push(`Referral update failed: ${refError.message}`)
        console.log(`   ❌ Failed: ${refError.message}`)
      } else {
        result.steps.referralUpdate = { success: true }
        console.log('   ✅ Referral status updated to active')

        // Also increment referrer's direct_referrals_count
        const { error: countIncError } = await supabase
          .rpc('sql', {
            query: `UPDATE users SET direct_referrals_count = direct_referrals_count + 1 WHERE id = '${user.referred_by}'`
          })

        if (!countIncError) {
          console.log('   ✅ Referrer direct_referrals_count incremented')
        }
      }
    } else {
      console.log('\n🤝 Step 4: ⏭️  No referrer (skipping referral update)')
      result.steps.referralUpdate = { success: true }
    }

    // STEP 5: Record payment
    console.log('\n💳 Step 5: Recording payment in database...')

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        stripe_payment_intent_id: payment.id,
        amount: 499,
        payment_type: 'initial',
        status: 'succeeded',
        created_at: new Date(payment.created * 1000).toISOString()
      })

    if (paymentError) {
      // Check if it's a duplicate key error (payment already exists)
      if (paymentError.message?.includes('duplicate') || paymentError.code === '23505') {
        result.steps.paymentRecord = { success: true }
        console.log('   ⚠️  Payment record already exists (skipping)')
      } else {
        result.steps.paymentRecord = { success: false, error: paymentError.message }
        result.errors.push(`Payment record creation failed: ${paymentError.message}`)
        console.log(`   ❌ Failed: ${paymentError.message}`)
      }
    } else {
      result.steps.paymentRecord = { success: true }
      console.log('   ✅ Payment record created ($499)')
    }

    // STEP 6: Create direct bonus for referrer
    if (user.referred_by) {
      console.log('\n🎁 Step 6: Creating direct bonus commission...')

      const bonusAmount = 249.50
      const availableAt = new Date(payment.created * 1000 + 3 * 24 * 60 * 60 * 1000)

      const { error: bonusError } = await supabase
        .from('commissions')
        .insert({
          referrer_id: user.referred_by,
          referred_id: user.id,
          amount: bonusAmount,
          commission_type: 'direct_bonus',
          status: 'pending',
          available_at: availableAt.toISOString(),
          created_at: new Date(payment.created * 1000).toISOString()
        })

      if (bonusError) {
        // Check if it's a duplicate
        if (bonusError.message?.includes('duplicate')) {
          result.steps.directBonus = { success: true, amount: bonusAmount }
          console.log('   ⚠️  Direct bonus already exists (skipping)')
        } else {
          result.steps.directBonus = { success: false, error: bonusError.message }
          result.errors.push(`Direct bonus creation failed: ${bonusError.message}`)
          console.log(`   ❌ Failed: ${bonusError.message}`)
        }
      } else {
        result.steps.directBonus = { success: true, amount: bonusAmount }
        console.log(`   ✅ Direct bonus created: $${bonusAmount}`)
        console.log(`   ⏰ Available after: ${availableAt.toLocaleDateString()}`)
      }
    } else {
      console.log('\n🎁 Step 6: ⏭️  No referrer (skipping direct bonus)')
      result.steps.directBonus = { success: true }
    }

    // Final status
    const allStepsSuccessful = Object.values(result.steps).every(step => step.success)
    result.success = allStepsSuccessful

    console.log(`\n${'='.repeat(80)}`)
    if (result.success) {
      console.log(`✅✅✅ SYNC COMPLETE: ${email}`)
    } else {
      console.log(`⚠️⚠️⚠️ SYNC PARTIAL: ${email} (${result.errors.length} errors)`)
    }
    console.log(`${'='.repeat(80)}\n`)

  } catch (error) {
    result.errors.push(`Fatal error: ${error instanceof Error ? error.message : String(error)}`)
    console.log(`\n❌❌❌ SYNC FAILED: ${email}`)
    console.log(`Error: ${error}\n`)
  }

  return result
}

async function main() {
  console.log('\n' + '='.repeat(80))
  console.log('🔄 STRIPE PAYMENT RECOVERY SCRIPT')
  console.log('='.repeat(80) + '\n')

  // Read the missing payments report
  let reportData
  try {
    const reportFile = await fs.readFile('missing-payments-report.json', 'utf-8')
    reportData = JSON.parse(reportFile)
  } catch (error) {
    console.error('❌ Could not read missing-payments-report.json')
    console.error('   Please run identify-missing-payments.ts first!\n')
    process.exit(1)
  }

  console.log(`📊 Found ${reportData.totalAffected} users to sync`)
  console.log(`📅 Report generated: ${new Date(reportData.generatedAt).toLocaleString()}\n`)

  // Confirm before proceeding
  console.log('⚠️  WARNING: This script will modify the database!')
  console.log('   Review the report carefully before continuing.\n')

  // Process each user
  const results: RecoveryResult[] = []

  for (let i = 0; i < reportData.users.length; i++) {
    const user = reportData.users[i]

    console.log(`\n[${i + 1}/${reportData.users.length}] Processing ${user.email}...`)

    const result = await syncMissingPayment(
      user.userId,
      user.email,
      user.stripePaymentId
    )

    results.push(result)

    // Small delay between users
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('📊 RECOVERY SUMMARY')
  console.log('='.repeat(80) + '\n')

  const successful = results.filter(r => r.success).length
  const partial = results.filter(r => !r.success && r.errors.length > 0).length

  console.log(`✅ Fully synced: ${successful}/${results.length}`)
  console.log(`⚠️  Partial sync:  ${partial}/${results.length}`)
  console.log(`❌ Failed:       ${results.length - successful - partial}/${results.length}\n`)

  // Show users with errors
  const failedUsers = results.filter(r => !r.success)
  if (failedUsers.length > 0) {
    console.log('⚠️  Users with errors:\n')
    for (const user of failedUsers) {
      console.log(`   ${user.email}:`)
      for (const error of user.errors) {
        console.log(`     - ${error}`)
      }
      console.log()
    }
  }

  // Save detailed results
  const resultsFile = {
    generatedAt: new Date().toISOString(),
    totalProcessed: results.length,
    successful,
    partial,
    failed: results.length - successful - partial,
    results
  }

  await fs.writeFile(
    'payment-recovery-results.json',
    JSON.stringify(resultsFile, null, 2)
  )

  console.log('📄 Detailed results saved to: payment-recovery-results.json\n')
  console.log('=' + '='.repeat(79) + '\n')
  console.log('🔍 VERIFICATION:\n')
  console.log('Run this SQL query in Supabase to verify the recovered users:\n')
  console.log('```sql')
  console.log('SELECT')
  console.log('  u.email,')
  console.log('  u.is_active,')
  console.log('  u.membership_status,')
  console.log('  u.initial_payment_completed,')
  console.log('  p.amount as payment_amount,')
  console.log('  c.amount as bonus_amount')
  console.log('FROM users u')
  console.log('LEFT JOIN payments p ON p.user_id = u.id AND p.payment_type = \'initial\'')
  console.log('LEFT JOIN commissions c ON c.referred_id = u.id AND c.commission_type = \'direct_bonus\'')
  console.log('WHERE u.id IN (')
  results.forEach((r, i) => {
    console.log(`  '${r.userId}'${i < results.length - 1 ? ',' : ''}`)
  })
  console.log(');')
  console.log('```\n')
}

// Run the recovery
main()
  .then(() => {
    console.log('✅ Recovery script complete!\n')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
