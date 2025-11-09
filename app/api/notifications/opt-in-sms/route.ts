/**
 * SMS OPT-IN API
 *
 * Initiates SMS opt-in process by sending verification code
 * TCPA compliance: requires explicit opt-in with verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSMS, formatPhoneNumber } from '@/lib/notifications/twilio/sms-service'

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
    const { phoneNumber } = body as { phoneNumber: string }

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Format phone number to E.164
    const formattedPhone = formatPhoneNumber(phoneNumber)

    if (!formattedPhone) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Please include country code (e.g., +1234567890)' },
        { status: 400 }
      )
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Get client IP and user agent for consent tracking
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Save or update SMS consent record
    const { error: consentError } = await supabase
      .from('sms_consent')
      .upsert({
        user_id: authUser.id,
        phone_number: formattedPhone,
        opted_in: false,  // Not opted in until verified
        verification_code: verificationCode,
        verification_sent_at: new Date().toISOString(),
        consent_source: 'web',
        consent_ip_address: ip,
        consent_user_agent: userAgent,
        is_verified: false
      }, {
        onConflict: 'user_id,phone_number'
      })

    if (consentError) {
      console.error('Error saving SMS consent:', consentError)
      return NextResponse.json(
        { error: 'Failed to initiate SMS verification' },
        { status: 500 }
      )
    }

    // Send verification code via SMS
    const smsResult = await sendSMS({
      to: formattedPhone,
      message: `Your Trading Hub verification code is: ${verificationCode}\n\nThis code expires in 10 minutes.\n\nReply STOP to opt out.`
    })

    if (!smsResult.success) {
      return NextResponse.json(
        { error: `Failed to send verification SMS: ${smsResult.error}` },
        { status: 500 }
      )
    }

    // Update user's phone number
    await supabase
      .from('users')
      .update({ phone_number: formattedPhone })
      .eq('id', authUser.id)

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your phone',
      phoneLast4: formattedPhone.slice(-4)
    })
  } catch (error) {
    console.error('Error in SMS opt-in:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
