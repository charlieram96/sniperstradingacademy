/**
 * TWILIO SMS STATUS WEBHOOK
 *
 * Receives delivery status updates from Twilio for sent SMS messages.
 * Updates notification logs and delivery health tracking.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await req.formData()

    const messageSid = formData.get('MessageSid') as string
    const messageStatus = formData.get('MessageStatus') as string
    const errorCode = formData.get('ErrorCode') as string | null
    const errorMessage = formData.get('ErrorMessage') as string | null

    const supabase = await createClient()

    // Find the notification log by provider_id (Message SID)
    const { data: log, error: logError } = await supabase
      .from('notification_logs')
      .select('*')
      .eq('provider_id', messageSid)
      .single()

    if (logError || !log) {
      console.warn(`Notification log not found for Message SID: ${messageSid}`)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Map Twilio status to our notification status
    let status = log.status
    const updates: {
      status?: string
      provider_status?: string
      error_code?: string | null
      error_message?: string | null
      delivered_at?: string | null
      failed_at?: string | null
    } = {
      provider_status: messageStatus
    }

    switch (messageStatus) {
      case 'delivered':
        status = 'delivered'
        updates.status = 'delivered'
        updates.delivered_at = new Date().toISOString()
        break

      case 'sent':
        status = 'sent'
        updates.status = 'sent'
        break

      case 'failed':
      case 'undelivered':
        status = 'failed'
        updates.status = 'failed'
        updates.failed_at = new Date().toISOString()
        updates.error_code = errorCode
        updates.error_message = errorMessage
        break

      case 'queued':
      case 'sending':
        // No status update needed
        break
    }

    // Update notification log
    await supabase
      .from('notification_logs')
      .update(updates)
      .eq('id', log.id)

    // Update delivery health if user_id exists
    if (log.user_id) {
      await updateDeliveryHealth(
        log.user_id,
        'sms',
        messageStatus,
        errorCode
      )
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Error processing SMS status webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Update delivery health metrics based on SMS status
 */
async function updateDeliveryHealth(
  userId: string,
  channel: 'sms',
  status: string,
  errorCode: string | null
) {
  const supabase = await createClient()

  // Get or create health record
  let { data: health } = await supabase
    .from('notification_health')
    .select('*')
    .eq('user_id', userId)
    .eq('channel', channel)
    .single()

  if (!health) {
    // Create new health record
    const { data: newHealth } = await supabase
      .from('notification_health')
      .insert({
        user_id: userId,
        channel: channel,
        total_sent: 0,
        total_delivered: 0
      })
      .select()
      .single()

    health = newHealth
  }

  if (!health) return

  // Update metrics based on status
  const updates: {
    total_sent?: number
    total_delivered?: number
    delivery_failure_count?: number
    carrier_error_count?: number
    last_delivery_failure?: string
    last_carrier_error?: string
  } = {}

  switch (status) {
    case 'delivered':
      updates.total_delivered = (health.total_delivered || 0) + 1
      break

    case 'failed':
    case 'undelivered':
      updates.delivery_failure_count = (health.delivery_failure_count || 0) + 1
      updates.last_delivery_failure = new Date().toISOString()

      // Check if it's a carrier error (error codes 30xxx)
      if (errorCode && errorCode.startsWith('30')) {
        updates.carrier_error_count = (health.carrier_error_count || 0) + 1
        updates.last_carrier_error = new Date().toISOString()
      }
      break
  }

  // Always increment total_sent if not already done
  if (status !== 'queued' && status !== 'sending') {
    updates.total_sent = (health.total_sent || 0) + 1
  }

  await supabase
    .from('notification_health')
    .update(updates)
    .eq('user_id', userId)
    .eq('channel', channel)
}
