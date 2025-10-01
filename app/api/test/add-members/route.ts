import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Generate random names for test members
const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'Tom', 'Amy', 'Ryan', 'Kate', 'James', 'Anna', 'Robert', 'Maria', 'Daniel', 'Laura', 'Mark', 'Emily']
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'White', 'Harris']

function getRandomName() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
  return `${firstName} ${lastName}`
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    
    console.log('Adding test members for user:', userId)
    
    // Clear existing test members (optional)
    await supabase
      .from('group_members')
      .delete()
      .eq('group_owner_id', userId)
    
    const membersAdded = []
    let memberIdCounter = 1
    
    // Level 1: 3 direct referrals
    for (let i = 0; i < 3; i++) {
      const name = getRandomName()
      const email = `test.member${memberIdCounter}@tradinghub.com`
      
      // Create user
      let memberId
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (userError) {
        // User might exist, try to fetch
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single()
        
        if (existingUser) {
          memberId = existingUser.id
        }
      } else {
        memberId = newUser.id
        
        // Add subscription (70% active)
        if (Math.random() < 0.7) {
          await supabase
            .from('subscriptions')
            .insert({
              user_id: memberId,
              status: 'active',
              created_at: new Date().toISOString()
            })
        }
      }
      
      if (memberId) {
        await supabase
          .from('group_members')
          .insert({
            group_owner_id: userId,
            member_id: memberId,
            level: 1,
            is_direct_referral: true,
            position: i + 1,
            created_at: new Date().toISOString()
          })
        
        // Add referral record
        await supabase
          .from('referrals')
          .insert({
            referrer_id: userId,
            referred_id: memberId,
            status: 'active',
            created_at: new Date().toISOString()
          })
        
        membersAdded.push({ level: 1, name, email })
      }
      
      memberIdCounter++
    }
    
    // Level 2: 9 members
    for (let i = 0; i < 9; i++) {
      const name = getRandomName()
      const email = `test.member${memberIdCounter}@tradinghub.com`
      
      let memberId
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (userError) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single()
        
        if (existingUser) {
          memberId = existingUser.id
        }
      } else {
        memberId = newUser.id
        
        if (Math.random() < 0.7) {
          await supabase
            .from('subscriptions')
            .insert({
              user_id: memberId,
              status: 'active',
              created_at: new Date().toISOString()
            })
        }
      }
      
      if (memberId) {
        await supabase
          .from('group_members')
          .insert({
            group_owner_id: userId,
            member_id: memberId,
            level: 2,
            is_direct_referral: false,
            spillover_from: userId,
            position: i + 1,
            created_at: new Date().toISOString()
          })
        
        membersAdded.push({ level: 2, name, email })
      }
      
      memberIdCounter++
    }
    
    // Level 3: 27 members
    for (let i = 0; i < 27; i++) {
      const name = getRandomName()
      const email = `test.member${memberIdCounter}@tradinghub.com`
      
      let memberId
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (userError) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single()
        
        if (existingUser) {
          memberId = existingUser.id
        }
      } else {
        memberId = newUser.id
        
        if (Math.random() < 0.6) {
          await supabase
            .from('subscriptions')
            .insert({
              user_id: memberId,
              status: 'active',
              created_at: new Date().toISOString()
            })
        }
      }
      
      if (memberId) {
        await supabase
          .from('group_members')
          .insert({
            group_owner_id: userId,
            member_id: memberId,
            level: 3,
            is_direct_referral: false,
            spillover_from: userId,
            position: i + 1,
            created_at: new Date().toISOString()
          })
        
        membersAdded.push({ level: 3, name, email })
      }
      
      memberIdCounter++
    }
    
    // Level 4: 15 members (partial for testing)
    for (let i = 0; i < 15; i++) {
      const name = getRandomName()
      const email = `test.member${memberIdCounter}@tradinghub.com`
      
      let memberId
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (userError) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single()
        
        if (existingUser) {
          memberId = existingUser.id
        }
      } else {
        memberId = newUser.id
        
        if (Math.random() < 0.5) {
          await supabase
            .from('subscriptions')
            .insert({
              user_id: memberId,
              status: 'active',
              created_at: new Date().toISOString()
            })
        }
      }
      
      if (memberId) {
        await supabase
          .from('group_members')
          .insert({
            group_owner_id: userId,
            member_id: memberId,
            level: 4,
            is_direct_referral: false,
            spillover_from: userId,
            position: i + 1,
            created_at: new Date().toISOString()
          })
        
        membersAdded.push({ level: 4, name, email })
      }
      
      memberIdCounter++
    }
    
    return NextResponse.json({
      success: true,
      message: `Added ${membersAdded.length} test members`,
      summary: {
        level1: membersAdded.filter(m => m.level === 1).length,
        level2: membersAdded.filter(m => m.level === 2).length,
        level3: membersAdded.filter(m => m.level === 3).length,
        level4: membersAdded.filter(m => m.level === 4).length,
        total: membersAdded.length
      }
    })
    
  } catch (error) {
    console.error('Error adding test members:', error)
    return NextResponse.json(
      { error: 'Failed to add test members' },
      { status: 500 }
    )
  }
}