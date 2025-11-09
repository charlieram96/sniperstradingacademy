/**
 * NOTIFICATION PREFERENCES API
 *
 * Allows users to update their notification preferences
 * (email/SMS toggles per event type, quiet hours)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NotificationPreferences } from '@/lib/notifications/notification-types'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's notification preferences
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('notification_preferences, phone_number, timezone')
      .eq('id', authUser.id)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get SMS consent status if phone number exists
    let smsConsent = null
    if (user.phone_number) {
      const { data: consent } = await supabase
        .from('sms_consent')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('phone_number', user.phone_number)
        .single()

      smsConsent = consent
    }

    // Get notification health data
    const { data: health } = await supabase
      .from('notification_health')
      .select('*')
      .eq('user_id', authUser.id)
      .single()

    return NextResponse.json({
      preferences: user.notification_preferences,
      phoneNumber: user.phone_number,
      timezone: user.timezone,
      smsConsent,
      health: health || {
        email_bounces: 0,
        email_complaints: 0,
        sms_failures: 0,
        email_disabled: false,
        sms_disabled: false
      }
    })
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { preferences, phoneNumber, timezone } = body as {
      preferences?: NotificationPreferences
      phoneNumber?: string
      timezone?: string
    }

    const updates: {
      notification_preferences?: NotificationPreferences
      phone_number?: string
      timezone?: string
    } = {}

    if (preferences) {
      updates.notification_preferences = preferences
    }

    if (phoneNumber !== undefined) {
      updates.phone_number = phoneNumber
    }

    if (timezone) {
      updates.timezone = timezone
    }

    // Update user preferences
    const { error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', authUser.id)

    if (updateError) {
      console.error('Error updating preferences:', updateError)
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
