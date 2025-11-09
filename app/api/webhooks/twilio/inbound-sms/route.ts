/**
 * TWILIO INBOUND SMS WEBHOOK
 *
 * Handles incoming SMS messages from users.
 * Primary use: STOP/UNSTOP/HELP commands (TCPA compliance)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import twilio from 'twilio'
import { STOP_RESPONSE, START_RESPONSE, HELP_RESPONSE } from '@/lib/notifications/twilio/sms-service'

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null

export async function POST(req: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await req.formData()

    const messageSid = formData.get('MessageSid') as string
    const fromNumber = formData.get('From') as string
    const toNumber = formData.get('To') as string
    const body = (formData.get('Body') as string)?.trim().toUpperCase()
    const numMedia = parseInt(formData.get('NumMedia') as string || '0')

    const supabase = await createClient()

    // Detect command
    let command: 'STOP' | 'START' | 'UNSTOP' | 'HELP' | null = null
    let response = ''

    if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(body)) {
      command = 'STOP'
      response = STOP_RESPONSE
    } else if (['START', 'UNSTOP', 'YES', 'SUBSCRIBE'].includes(body)) {
      command = 'START'
      response = START_RESPONSE
    } else if (body === 'HELP' || body === 'INFO') {
      command = 'HELP'
      response = HELP_RESPONSE
    }

    // Find user by phone number
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('phone_number', fromNumber)
      .single()

    // Log inbound message
    const { data: inboundMessage, error: logError } = await supabase
      .from('inbound_sms_messages')
      .insert({
        message_sid: messageSid,
        from_number: fromNumber,
        to_number: toNumber,
        body: formData.get('Body') as string,
        user_id: user?.id || null,
        command_detected: command,
        num_media: numMedia
      })
      .select()
      .single()

    if (logError) {
      console.error('Error logging inbound SMS:', logError)
    }

    // Process command if detected
    if (command && user) {
      try {
        if (command === 'STOP') {
          // Unsubscribe user from SMS
          // Update notification preferences
          const { data: currentUser } = await supabase
            .from('users')
            .select('notification_preferences')
            .eq('id', user.id)
            .single()

          const preferences = currentUser?.notification_preferences as { sms?: { enabled?: boolean } } || {}

          await supabase
            .from('users')
            .update({
              notification_preferences: {
                ...preferences,
                sms: {
                  ...preferences.sms,
                  enabled: false
                }
              }
            })
            .eq('id', user.id)

          // Update SMS consent
          await supabase
            .from('sms_consent')
            .update({
              opted_in: false,
              opt_out_timestamp: new Date().toISOString(),
              opt_out_source: 'stop_command'
            })
            .eq('user_id', user.id)
            .eq('phone_number', fromNumber)

          console.log(`User ${user.id} opted out via STOP command`)
        } else if (command === 'START') {
          // Re-subscribe user to SMS
          const { data: currentUser } = await supabase
            .from('users')
            .select('notification_preferences')
            .eq('id', user.id)
            .single()

          const preferences = currentUser?.notification_preferences as { sms?: { enabled?: boolean } } || {}

          await supabase
            .from('users')
            .update({
              notification_preferences: {
                ...preferences,
                sms: {
                  ...preferences.sms,
                  enabled: true
                }
              }
            })
            .eq('id', user.id)

          // Update SMS consent
          await supabase
            .from('sms_consent')
            .upsert({
              user_id: user.id,
              phone_number: fromNumber,
              opted_in: true,
              consent_timestamp: new Date().toISOString(),
              consent_source: 'stop_command',
              is_verified: true,
              verified_at: new Date().toISOString()
            })

          console.log(`User ${user.id} re-opted in via START command`)
        }

        // Mark as processed
        await supabase
          .from('inbound_sms_messages')
          .update({
            processed: true,
            processed_at: new Date().toISOString()
          })
          .eq('id', inboundMessage?.id)
      } catch (error) {
        console.error('Error processing SMS command:', error)

        // Log processing error
        await supabase
          .from('inbound_sms_messages')
          .update({
            processing_error: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', inboundMessage?.id)
      }
    }

    // Send response if command was detected
    if (command && response && twilioClient) {
      try {
        const responseMessage = await twilioClient.messages.create({
          to: fromNumber,
          from: toNumber,
          body: response
        })

        // Log response
        await supabase
          .from('inbound_sms_messages')
          .update({
            response_sent: true,
            response_message: response,
            response_sid: responseMessage.sid
          })
          .eq('id', inboundMessage?.id)

        console.log(`Sent ${command} response to ${fromNumber}`)
      } catch (error) {
        console.error('Error sending SMS response:', error)
      }
    }

    // Return TwiML response (Twilio expects XML)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      }
    )
  } catch (error) {
    console.error('Error processing inbound SMS:', error)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      }
    )
  }
}
