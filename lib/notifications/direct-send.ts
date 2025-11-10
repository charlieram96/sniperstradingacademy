/**
 * DIRECT NOTIFICATION SEND
 *
 * Shared logic for sending notifications directly (without queue).
 * Used by both the worker and as a fallback when Redis is unavailable.
 */

import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendEmail } from './twilio/email-service'
import { sendSMS } from './twilio/sms-service'
import type { SendNotificationParams, NotificationResult, NotificationChannel } from './notification-types'

/**
 * Format template with variables
 */
function formatTemplate(template: string, variables: Record<string, unknown>): string {
  let formatted = template

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    formatted = formatted.replace(new RegExp(placeholder, 'g'), String(value))
  })

  return formatted
}

/**
 * Send notification directly (bypassing queue)
 *
 * This function handles the actual sending of emails and SMS.
 * It's extracted from the worker to be reusable as a fallback.
 *
 * @param params Notification parameters
 * @param idempotencyKey Unique key for deduplication
 * @returns Array of notification results (one per channel)
 */
export async function sendNotificationDirectly(
  params: SendNotificationParams,
  idempotencyKey: string
): Promise<NotificationResult[]> {
  const { userId, type, channel, data } = params

  console.log(`📧 Sending notification directly: ${type} for user ${userId} via ${channel?.join(', ') || 'email'}`)

  const supabase = createServiceRoleClient()
  const results: NotificationResult[] = []

  try {
    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, phone_number, notification_preferences, timezone, name')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      throw new Error(`User not found: ${userId}`)
    }

    // Check if channel is enabled for this user
    const preferences = user.notification_preferences as {
      email?: { enabled?: boolean }
      sms?: { enabled?: boolean }
    } | null

    const channels = channel || ['email', 'sms']

    for (const ch of channels) {
      if (ch === 'email') {
        if (!preferences?.email?.enabled) {
          console.log(`Email notifications disabled for user ${userId}`)
          results.push({
            success: false,
            error: 'Email notifications disabled for user',
            status: 'failed',
            channel: 'email'
          })
          continue
        }

        if (!user.email) {
          console.log(`No email address for user ${userId}`)
          results.push({
            success: false,
            error: 'No email address',
            status: 'failed',
            channel: 'email'
          })
          continue
        }

        // Check email health
        const { data: emailHealth } = await supabase
          .from('notification_health')
          .select('channel_disabled')
          .eq('user_id', userId)
          .eq('channel', 'email')
          .single()

        if (emailHealth?.channel_disabled) {
          console.log(`Email channel disabled for user ${userId}`)
          results.push({
            success: false,
            error: 'Email channel disabled',
            status: 'failed',
            channel: 'email'
          })
          continue
        }

        // Get email template
        const { data: template } = await supabase
          .from('notification_templates')
          .select('*')
          .eq('template_key', `email_${type}`)
          .eq('channel', 'email')
          .eq('is_active', true)
          .single()

        if (!template) {
          console.warn(`No email template found for ${type}`)
          results.push({
            success: false,
            error: `No email template found for ${type}`,
            status: 'failed',
            channel: 'email'
          })
          continue
        }

        // Format subject and body with variables
        const subject = formatTemplate(template.subject_template || '', data)
        const body = template.html_template || formatTemplate(template.body_template, data)

        // Send email
        const emailResult = await sendEmail({
          to: user.email,
          subject,
          html: body
        })

        // Log result
        await supabase.from('notification_logs').insert({
          user_id: userId,
          notification_type: type,
          channel: 'email',
          status: emailResult.success ? 'sent' : 'failed',
          idempotency_key: idempotencyKey,
          subject,
          message: body,
          metadata: data,
          provider: 'sendgrid',
          provider_id: emailResult.messageId,
          error_message: emailResult.error,
          error_code: emailResult.errorCode,
          sent_at: emailResult.success ? new Date().toISOString() : null,
          failed_at: emailResult.success ? null : new Date().toISOString()
        })

        results.push({
          success: emailResult.success,
          status: emailResult.success ? 'sent' : 'failed',
          channel: 'email',
          notificationId: emailResult.messageId,
          error: emailResult.error
        })
      }

      if (ch === 'sms') {
        if (!preferences?.sms?.enabled) {
          console.log(`SMS notifications disabled for user ${userId}`)
          results.push({
            success: false,
            error: 'SMS notifications disabled for user',
            status: 'failed',
            channel: 'sms'
          })
          continue
        }

        if (!user.phone_number) {
          console.log(`No phone number for user ${userId}`)
          results.push({
            success: false,
            error: 'No phone number',
            status: 'failed',
            channel: 'sms'
          })
          continue
        }

        // Check SMS consent
        const { data: consent } = await supabase
          .from('sms_consent')
          .select('opted_in, is_verified')
          .eq('user_id', userId)
          .eq('phone_number', user.phone_number)
          .single()

        if (!consent?.opted_in || !consent?.is_verified) {
          console.log(`User ${userId} has not opted in to SMS or not verified`)
          results.push({
            success: false,
            error: 'User has not opted in to SMS or phone not verified',
            status: 'failed',
            channel: 'sms'
          })
          continue
        }

        // Check SMS health
        const { data: smsHealth } = await supabase
          .from('notification_health')
          .select('channel_disabled')
          .eq('user_id', userId)
          .eq('channel', 'sms')
          .single()

        if (smsHealth?.channel_disabled) {
          console.log(`SMS channel disabled for user ${userId}`)
          results.push({
            success: false,
            error: 'SMS channel disabled',
            status: 'failed',
            channel: 'sms'
          })
          continue
        }

        // Get SMS template
        const { data: template } = await supabase
          .from('notification_templates')
          .select('*')
          .eq('template_key', `sms_${type}`)
          .eq('channel', 'sms')
          .eq('is_active', true)
          .single()

        if (!template) {
          console.warn(`No SMS template found for ${type}`)
          results.push({
            success: false,
            error: `No SMS template found for ${type}`,
            status: 'failed',
            channel: 'sms'
          })
          continue
        }

        // Format message with variables
        const message = formatTemplate(template.body_template, data)

        // Send SMS
        const smsResult = await sendSMS({
          to: user.phone_number,
          message,
          statusCallback: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/twilio/sms-status`
        })

        // Log result
        await supabase.from('notification_logs').insert({
          user_id: userId,
          notification_type: type,
          channel: 'sms',
          status: smsResult.success ? 'sent' : 'failed',
          idempotency_key: idempotencyKey,
          message,
          metadata: data,
          provider: 'twilio',
          provider_id: smsResult.messageSid,
          error_message: smsResult.error,
          error_code: smsResult.errorCode,
          sent_at: smsResult.success ? new Date().toISOString() : null,
          failed_at: smsResult.success ? null : new Date().toISOString()
        })

        results.push({
          success: smsResult.success,
          status: smsResult.success ? 'sent' : 'failed',
          channel: 'sms',
          notificationId: smsResult.messageSid,
          error: smsResult.error
        })
      }
    }

    return results
  } catch (error) {
    console.error(`Error sending notification directly for user ${userId}:`, error)

    // Log failure
    await supabase.from('notification_logs').insert({
      user_id: userId,
      notification_type: type,
      channel: channel?.[0] || 'email',
      status: 'failed',
      idempotency_key: idempotencyKey,
      metadata: data,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      failed_at: new Date().toISOString()
    })

    return [{
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'failed',
      channel: channel?.[0] || 'email'
    }]
  }
}
