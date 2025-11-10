/**
 * NOTIFICATION WORKER
 *
 * Worker that processes notification jobs from the BullMQ queue.
 * Handles actual sending of emails and SMS with error handling.
 */

import { Worker, Job } from 'bullmq'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '../../twilio/email-service'
import { sendSMS } from '../../twilio/sms-service'
import type { SendNotificationParams, NotificationChannel } from '../../notification-types'
import { NOTIFICATION_QUEUE_NAME, moveToDeadLetterQueue, connection } from '../notification-queue'

// Import shared Redis connection from notification-queue (singleton pattern)
// This prevents creating multiple connections which cause EBUSY errors

/**
 * Process notification job
 *
 * This function is called for each job in the queue
 */
async function processNotification(
  job: Job<SendNotificationParams & { idempotencyKey: string }>
): Promise<{ success: boolean; channel: NotificationChannel; providerId?: string }> {
  const { userId, type, channel, data, idempotencyKey } = job.data

  console.log(`Processing notification: ${type} for user ${userId} via ${channel}`)

  const supabase = await createClient()

  try {
    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, phone_number, notification_preferences, timezone')
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
    const results: Array<{ success: boolean; channel: NotificationChannel; providerId?: string }> = []

    for (const ch of channels) {
      if (ch === 'email') {
        if (!preferences?.email?.enabled) {
          console.log(`Email notifications disabled for user ${userId}`)
          continue
        }

        if (!user.email) {
          console.log(`No email address for user ${userId}`)
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
          channel: 'email',
          providerId: emailResult.messageId
        })
      }

      if (ch === 'sms') {
        if (!preferences?.sms?.enabled) {
          console.log(`SMS notifications disabled for user ${userId}`)
          continue
        }

        if (!user.phone_number) {
          console.log(`No phone number for user ${userId}`)
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
          channel: 'sms',
          providerId: smsResult.messageSid
        })
      }
    }

    // Return success if at least one channel succeeded
    const anySuccess = results.some(r => r.success)
    if (anySuccess) {
      return results.find(r => r.success)!
    }

    throw new Error('All channels failed')
  } catch (error) {
    console.error(`Error processing notification for user ${userId}:`, error)

    // Log failure
    const supabase = await createClient()
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

    throw error
  }
}

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
 * Create and start the notification worker
 *
 * This should be run as a separate process or in a serverless function
 */
export function createNotificationWorker() {
  // If Redis connection is not available, don't create worker
  if (!connection) {
    console.warn('⚠️  Redis connection not available. Worker not created. Using direct send fallback.')
    return null
  }

  const worker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      return processNotification(job)
    },
    {
      connection,
      concurrency: 10,  // Process 10 jobs concurrently
      limiter: {
        max: 100,  // Max 100 jobs per interval
        duration: 60000  // 1 minute
      }
    }
  )

  // Event listeners
  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`)
  })

  worker.on('failed', async (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message)

    // If job has exhausted all retries, move to dead letter queue
    if (job && job.attemptsMade >= (job.opts.attempts || 5)) {
      await moveToDeadLetterQueue(
        job.id || '',
        `Exhausted all retries: ${err.message}`
      )
    }
  })

  worker.on('error', (err) => {
    console.error('Worker error:', err)
  })

  console.log('✨ Notification worker started')

  return worker
}

// Export singleton worker instance
let workerInstance: Worker | null = null

export function getNotificationWorker(): Worker | null {
  if (!workerInstance) {
    workerInstance = createNotificationWorker()
  }
  return workerInstance
}

export async function stopNotificationWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close()
    workerInstance = null
    console.log('Notification worker stopped')
  }
}
