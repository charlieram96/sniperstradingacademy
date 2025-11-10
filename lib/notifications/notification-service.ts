/**
 * NOTIFICATION SERVICE (Main Orchestrator)
 *
 * Central service for sending all types of notifications.
 * Handles:
 * - User preference checking
 * - Quiet hours enforcement
 * - Idempotency (preventing duplicates)
 * - Channel health checking
 * - Queueing with retry logic
 */

import { createClient } from '@/lib/supabase/server'
import type {
  SendNotificationParams,
  NotificationResult,
  NotificationChannel,
  NotificationPreferences
} from './notification-types'
import { generateIdempotencyKey, isNotificationDuplicate } from './utils/idempotency'
import { isInQuietHours } from './utils/quiet-hours'
import { getGlobalSettings, isNotificationEnabled } from './utils/global-settings-cache'

/**
 * Main function to send a notification
 *
 * This is the primary entry point for sending notifications throughout the app.
 * It handles all business logic before queueing the notification.
 *
 * @param params Notification parameters
 * @returns Notification result with status
 */
export async function sendNotification(
  params: SendNotificationParams
): Promise<NotificationResult[]> {
  const supabase = await createClient()

  try {
    // Get user details and preferences
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, phone_number, notification_preferences, timezone')
      .eq('id', params.userId)
      .single()

    if (userError || !user) {
      return [{
        success: false,
        error: `User not found: ${params.userId}`,
        status: 'failed',
        channel: 'email'
      }]
    }

    const preferences = user.notification_preferences as NotificationPreferences | null
    if (!preferences) {
      return [{
        success: false,
        error: 'User has no notification preferences',
        status: 'failed',
        channel: 'email'
      }]
    }

    // Check global notification toggle (master kill switch)
    // Allows superadmins to disable notification types system-wide
    try {
      const globalSettings = await getGlobalSettings(supabase)
      const globallyEnabled = isNotificationEnabled(globalSettings, params.type)

      if (!globallyEnabled) {
        // Log the blocked notification for audit trail
        await supabase.from('notification_logs').insert({
          user_id: params.userId,
          notification_type: params.type,
          status: 'blocked_globally',
          channel: 'email',
          message: `Notification type "${params.type}" is globally disabled`,
          idempotency_key: generateIdempotencyKey({
            userId: params.userId,
            type: params.type,
            channel: 'email',
            eventId: params.data.eventId as string | undefined
          })
        })

        return [{
          success: false,
          error: `Notification type "${params.type}" is globally disabled by administrator`,
          status: 'failed',
          channel: 'email'
        }]
      }
    } catch (error) {
      // Log error but continue (fail open - allow notifications if global settings check fails)
      console.error('Error checking global notification settings:', error)
    }

    // Determine which channels to use
    const channels = params.channel || (['email', 'sms'] as NotificationChannel[])
    const results: NotificationResult[] = []

    for (const channel of channels) {
      // Check if channel is enabled globally
      if (channel === 'email' && !preferences.email?.enabled) {
        results.push({
          success: false,
          error: 'Email notifications disabled for user',
          status: 'failed',
          channel: 'email'
        })
        continue
      }

      if (channel === 'sms' && !preferences.sms?.enabled) {
        results.push({
          success: false,
          error: 'SMS notifications disabled for user',
          status: 'failed',
          channel: 'sms'
        })
        continue
      }

      // Check if this specific notification type is enabled
      const notificationTypeKey = params.type.replace(/_/g, '_') as keyof typeof preferences.email
      if (channel === 'email' && preferences.email?.[notificationTypeKey] === false) {
        results.push({
          success: false,
          error: `Email notifications disabled for ${params.type}`,
          status: 'failed',
          channel: 'email'
        })
        continue
      }

      if (channel === 'sms' && preferences.sms?.[notificationTypeKey] === false) {
        results.push({
          success: false,
          error: `SMS notifications disabled for ${params.type}`,
          status: 'failed',
          channel: 'sms'
        })
        continue
      }

      // Check channel health
      const { data: channelHealth } = await supabase
        .from('notification_health')
        .select('channel_disabled, disabled_reason')
        .eq('user_id', params.userId)
        .eq('channel', channel)
        .single()

      if (channelHealth?.channel_disabled) {
        results.push({
          success: false,
          error: `${channel} channel disabled: ${channelHealth.disabled_reason}`,
          status: 'failed',
          channel
        })
        continue
      }

      // Generate idempotency key
      const eventId = params.data.eventId as string | undefined
      const idempotencyKey = generateIdempotencyKey({
        userId: params.userId,
        type: params.type,
        channel,
        eventId
      })

      // Check for duplicates
      const isDuplicate = await isNotificationDuplicate(idempotencyKey, supabase)
      if (isDuplicate) {
        results.push({
          success: false,
          error: 'Duplicate notification (already sent)',
          status: 'failed',
          channel
        })
        continue
      }

      // Check quiet hours (unless force skip)
      let delay: number | undefined
      if (!params.forceSkipQuietHours) {
        const quietHoursCheck = isInQuietHours(
          user.timezone || 'America/New_York',
          preferences.quiet_hours
        )

        if (quietHoursCheck.inQuietHours && quietHoursCheck.deferUntil) {
          delay = quietHoursCheck.deferUntil.getTime() - Date.now()
          results.push({
            success: true,
            status: 'deferred',
            channel,
            deferredUntil: quietHoursCheck.deferUntil.toISOString()
          })
        }
      }

      // Insert notification into outbox (DB-based queue)
      try {
        // Calculate scheduled_at time (for quiet hours / deferred sending)
        const scheduledAt = delay ? new Date(Date.now() + delay) : null

        // Insert into notification_outbox table
        const { error: outboxError } = await supabase
          .from('notification_outbox')
          .insert({
            user_id: params.userId,
            notification_type: params.type,
            channel,
            data: params.data,
            idempotency_key: idempotencyKey,
            scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
            max_retries: 5
          })

        if (outboxError) {
          throw new Error(`Failed to queue notification: ${outboxError.message}`)
        }

        results.push({
          success: true,
          notificationId: idempotencyKey, // Use idempotency key as ID
          status: delay ? 'deferred' : 'queued',
          channel,
          deferredUntil: scheduledAt ? scheduledAt.toISOString() : undefined
        })
      } catch (outboxError) {
        // Outbox insert failed - log error
        console.error(`❌ Failed to queue notification:`, outboxError)
        results.push({
          success: false,
          error: outboxError instanceof Error ? outboxError.message : 'Failed to queue notification',
          status: 'failed',
          channel
        })
      }
    }

    return results
  } catch (error) {
    console.error('Error in sendNotification:', error)
    return [{
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'failed',
      channel: 'email'
    }]
  }
}

/**
 * Send a notification immediately (bypass queue)
 *
 * Only use for critical notifications that must be sent immediately.
 * Skips quiet hours and preference checks.
 *
 * @param params Notification parameters
 * @returns Notification result
 */
export async function sendNotificationImmediate(
  params: Omit<SendNotificationParams, 'forceSkipQuietHours'>
): Promise<NotificationResult[]> {
  return sendNotification({
    ...params,
    forceSkipQuietHours: true,
    priority: 'urgent'
  })
}

/**
 * Shorthand functions for common notification types
 */

export async function notifyReferralSignup(params: {
  referrerId: string
  referredName: string
  referredEmail: string
  referralCode: string
}) {
  return sendNotification({
    userId: params.referrerId,
    type: 'referral_signup',
    data: {
      referredName: params.referredName,
      referredEmail: params.referredEmail,
      referralCode: params.referralCode,
      eventId: `referral_${params.referredEmail}_${Date.now()}`
    }
  })
}

export async function notifyDirectBonus(params: {
  referrerId: string
  referredName: string
  amount: number
  commissionId: string
}) {
  return sendNotification({
    userId: params.referrerId,
    type: 'direct_bonus',
    data: {
      referredName: params.referredName,
      amount: params.amount,
      eventId: params.commissionId
    }
  })
}

export async function notifyMonthlyCommission(params: {
  userId: string
  month: string
  amount: number
  memberCount: number
  totalVolume: number
  commissionRate: number
}) {
  return sendNotification({
    userId: params.userId,
    type: 'monthly_commission',
    data: {
      month: params.month,
      amount: params.amount,
      memberCount: params.memberCount,
      totalVolume: params.totalVolume,
      commissionRate: params.commissionRate,
      eventId: `commission_${params.userId}_${params.month}`
    }
  })
}

export async function notifyPayoutProcessed(params: {
  userId: string
  amount: number
  commissionType: string
  payoutId: string
}) {
  return sendNotification({
    userId: params.userId,
    type: 'payout_processed',
    channel: ['email'],  // Email only by default; SMS sent if user has opted in via preferences
    data: {
      amount: params.amount,
      commissionType: params.commissionType,
      eventId: params.payoutId
    },
    priority: 'high'
  })
}

export async function notifyPayoutFailed(params: {
  userId: string
  amount: number
  reason: string
  dashboardUrl: string
  payoutId: string
}) {
  return sendNotification({
    userId: params.userId,
    type: 'payout_failed',
    channel: ['email'],  // Critical financial notifications via email (more reliable for records)
    data: {
      amount: params.amount,
      reason: params.reason,
      dashboardUrl: params.dashboardUrl,
      eventId: params.payoutId
    },
    priority: 'urgent',
    forceSkipQuietHours: true  // Don't wait for quiet hours
  })
}

export async function notifyPaymentFailed(params: {
  userId: string
  amount: number
  paymentUrl: string
}) {
  return sendNotification({
    userId: params.userId,
    type: 'payment_failed',
    channel: ['email'],  // Critical payment failures via email (provides payment link & records)
    data: {
      amount: params.amount,
      paymentUrl: params.paymentUrl,
      eventId: `payment_failed_${params.userId}_${Date.now()}`
    },
    priority: 'urgent',
    forceSkipQuietHours: true
  })
}

export async function notifyStructureMilestone(params: {
  userId: string
  structureNumber: number
  activeMembers: number
  newRate: number
  maxCommission: number
}) {
  return sendNotification({
    userId: params.userId,
    type: 'structure_milestone',
    data: {
      structureNumber: params.structureNumber,
      activeMembers: params.activeMembers,
      newRate: params.newRate,
      maxCommission: params.maxCommission,
      eventId: `structure_${params.userId}_${params.structureNumber}`
    },
    priority: 'high'
  })
}
