/**
 * SMS VERIFICATION API
 *
 * Verifies the SMS code and completes opt-in process
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
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
    const { code } = body as { code: string }

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      )
    }

    // Get SMS consent record
    const { data: consent, error: consentError } = await supabase
      .from('sms_consent')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (consentError || !consent) {
      return NextResponse.json(
        { error: 'No verification request found. Please request a new code.' },
        { status: 404 }
      )
    }

    // Check if code matches
    if (consent.verification_code !== code) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Check if code is expired (10 minutes)
    const sentAt = new Date(consent.verification_sent_at || 0)
    const now = new Date()
    const minutesSinceSent = (now.getTime() - sentAt.getTime()) / 1000 / 60

    if (minutesSinceSent > 10) {
      return NextResponse.json(
        { error: 'Verification code expired. Please request a new code.' },
        { status: 400 }
      )
    }

    // Mark as verified and opted in
    const { error: updateError } = await supabase
      .from('sms_consent')
      .update({
        opted_in: true,
        is_verified: true,
        verified_at: new Date().toISOString(),
        consent_timestamp: new Date().toISOString()
      })
      .eq('id', consent.id)

    if (updateError) {
      console.error('Error updating SMS consent:', updateError)
      return NextResponse.json(
        { error: 'Failed to verify SMS' },
        { status: 500 }
      )
    }

    // Enable SMS notifications in user preferences
    const { data: currentUser } = await supabase
      .from('users')
      .select('notification_preferences')
      .eq('id', authUser.id)
      .single()

    const preferences = currentUser?.notification_preferences as { sms?: { enabled?: boolean } } || {}

    await supabase
      .from('users')
      .update({
        notification_preferences: {
          ...preferences,
          sms: {
            ...preferences.sms,
            enabled: true  // Enable SMS notifications
          }
        }
      })
      .eq('id', authUser.id)

    return NextResponse.json({
      success: true,
      message: 'Phone number verified! SMS notifications are now enabled.'
    })
  } catch (error) {
    console.error('Error verifying SMS:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
