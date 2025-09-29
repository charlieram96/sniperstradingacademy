import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing')
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Found' : 'Missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Test user email - change this to your test account email
const TEST_USER_EMAIL = 'test@example.com'

// Generate random names for test members
const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'Tom', 'Amy', 'Ryan', 'Kate', 'James', 'Anna', 'Robert', 'Maria', 'Daniel', 'Laura', 'Mark', 'Emily']
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'White', 'Harris']

function getRandomName() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
  return `${firstName} ${lastName}`
}

async function addTestMembers() {
  try {
    console.log('Starting to add test members...')
    
    // First, get the test user
    const { data: testUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', TEST_USER_EMAIL)
      .single()
    
    if (userError || !testUser) {
      console.error('Test user not found. Please make sure you have a user with email:', TEST_USER_EMAIL)
      console.error('Error:', userError)
      return
    }
    
    const testUserId = testUser.id
    console.log('Found test user:', testUserId)
    
    // Clear existing test members for this user (optional)
    console.log('Clearing existing test members...')
    await supabase
      .from('group_members')
      .delete()
      .eq('group_owner_id', testUserId)
    
    // Generate members for each level
    const membersToAdd = []
    let memberIdCounter = 1
    
    // Level 1: 3 members (direct referrals)
    for (let i = 0; i < 3; i++) {
      const name = getRandomName()
      const email = `member${memberIdCounter}@test.com`
      
      // First create the user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (createError) {
        console.log(`User with email ${email} might already exist, fetching...`)
        // Try to get existing user
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single()
        
        if (existingUser) {
          membersToAdd.push({
            group_owner_id: testUserId,
            member_id: existingUser.id,
            level: 1,
            is_direct_referral: true,
            position: i + 1,
            created_at: new Date().toISOString()
          })
        }
      } else if (newUser) {
        membersToAdd.push({
          group_owner_id: testUserId,
          member_id: newUser.id,
          level: 1,
          is_direct_referral: true,
          position: i + 1,
          created_at: new Date().toISOString()
        })
        
        // Add subscription for some members (70% active)
        if (Math.random() < 0.7) {
          await supabase
            .from('subscriptions')
            .insert({
              user_id: newUser.id,
              status: 'active',
              created_at: new Date().toISOString()
            })
        }
      }
      
      memberIdCounter++
    }
    
    // Level 2: 9 members (3 per level 1 member)
    for (let i = 0; i < 9; i++) {
      const name = getRandomName()
      const email = `member${memberIdCounter}@test.com`
      const parentPosition = Math.floor(i / 3) + 1
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (createError) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single()
        
        if (existingUser) {
          membersToAdd.push({
            group_owner_id: testUserId,
            member_id: existingUser.id,
            level: 2,
            is_direct_referral: false,
            spillover_from: testUserId,
            position: i + 1,
            created_at: new Date().toISOString()
          })
        }
      } else if (newUser) {
        membersToAdd.push({
          group_owner_id: testUserId,
          member_id: newUser.id,
          level: 2,
          is_direct_referral: false,
          spillover_from: testUserId,
          position: i + 1,
          created_at: new Date().toISOString()
        })
        
        if (Math.random() < 0.7) {
          await supabase
            .from('subscriptions')
            .insert({
              user_id: newUser.id,
              status: 'active',
              created_at: new Date().toISOString()
            })
        }
      }
      
      memberIdCounter++
    }
    
    // Level 3: 27 members (3 per level 2 member)
    for (let i = 0; i < 27; i++) {
      const name = getRandomName()
      const email = `member${memberIdCounter}@test.com`
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (createError) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single()
        
        if (existingUser) {
          membersToAdd.push({
            group_owner_id: testUserId,
            member_id: existingUser.id,
            level: 3,
            is_direct_referral: false,
            spillover_from: testUserId,
            position: i + 1,
            created_at: new Date().toISOString()
          })
        }
      } else if (newUser) {
        membersToAdd.push({
          group_owner_id: testUserId,
          member_id: newUser.id,
          level: 3,
          is_direct_referral: false,
          spillover_from: testUserId,
          position: i + 1,
          created_at: new Date().toISOString()
        })
        
        if (Math.random() < 0.6) {
          await supabase
            .from('subscriptions')
            .insert({
              user_id: newUser.id,
              status: 'active',
              created_at: new Date().toISOString()
            })
        }
      }
      
      memberIdCounter++
    }
    
    // Level 4: Add just a few members (15 instead of 81 for testing)
    for (let i = 0; i < 15; i++) {
      const name = getRandomName()
      const email = `member${memberIdCounter}@test.com`
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (createError) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single()
        
        if (existingUser) {
          membersToAdd.push({
            group_owner_id: testUserId,
            member_id: existingUser.id,
            level: 4,
            is_direct_referral: false,
            spillover_from: testUserId,
            position: i + 1,
            created_at: new Date().toISOString()
          })
        }
      } else if (newUser) {
        membersToAdd.push({
          group_owner_id: testUserId,
          member_id: newUser.id,
          level: 4,
          is_direct_referral: false,
          spillover_from: testUserId,
          position: i + 1,
          created_at: new Date().toISOString()
        })
        
        if (Math.random() < 0.5) {
          await supabase
            .from('subscriptions')
            .insert({
              user_id: newUser.id,
              status: 'active',
              created_at: new Date().toISOString()
            })
        }
      }
      
      memberIdCounter++
    }
    
    // Insert all group members
    if (membersToAdd.length > 0) {
      const { error: insertError } = await supabase
        .from('group_members')
        .insert(membersToAdd)
      
      if (insertError) {
        console.error('Error inserting group members:', insertError)
      } else {
        console.log(`Successfully added ${membersToAdd.length} test members!`)
      }
    }
    
    // Add some referrals for the direct members
    console.log('Adding referral records for direct members...')
    const directMembers = membersToAdd.filter(m => m.is_direct_referral).slice(0, 3)
    
    for (const member of directMembers) {
      await supabase
        .from('referrals')
        .insert({
          referrer_id: testUserId,
          referred_id: member.member_id,
          status: 'active',
          created_at: new Date().toISOString()
        })
    }
    
    console.log('Test data generation complete!')
    console.log(`Added ${membersToAdd.length} members across 4 levels`)
    
  } catch (error) {
    console.error('Error adding test members:', error)
  }
}

// Run the script
addTestMembers().then(() => {
  console.log('Script finished')
  process.exit(0)
})