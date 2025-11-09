/**
 * IDEMPOTENCY UTILITY
 *
 * Generates idempotency keys to prevent duplicate notifications.
 * Ensures users don't receive the same notification multiple times.
 */

import { createHash } from 'crypto'
import type { NotificationType, NotificationChannel } from '../notification-types'

/**
 * Generate an idempotency key for a notification
 *
 * Format: {event_type}:{user_id}:{event_id}:{channel}:{timestamp}
 *
 * @param params Notification parameters
 * @returns Unique idempotency key
 */
export function generateIdempotencyKey(params: {
  userId: string
  type: NotificationType
  channel: NotificationChannel
  eventId?: string  // Optional unique event ID (e.g., payout_id, commission_id)
  timestamp?: number  // Optional timestamp (defaults to current time rounded to minute)
}): string {
  const {
    userId,
    type,
    channel,
    eventId = 'default',
    timestamp = Date.now()
  } = params

  // Round timestamp to the nearest minute to allow retries within the same minute
  const roundedTimestamp = Math.floor(timestamp / 60000) * 60000

  // Create deterministic key
  const key = `${type}:${userId}:${eventId}:${channel}:${roundedTimestamp}`

  // Hash to keep key length manageable
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Generate a simple unique ID for event tracking
 *
 * @returns Unique event ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Check if a notification has already been sent using idempotency key
 *
 * This would query the notification_logs table to check for duplicate
 * idempotency keys. Should be called before queueing a notification.
 *
 * @param idempotencyKey The idempotency key to check
 * @param supabase Supabase client
 * @returns True if notification already exists
 */
export async function isNotificationDuplicate(
  idempotencyKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .single()

    if (error && error instanceof Object && 'code' in error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which means no duplicate
      console.error('Error checking idempotency:', error)
      return false
    }

    return data !== null
  } catch (error) {
    console.error('Error checking notification duplicate:', error)
    return false
  }
}

/**
 * Generate a deduplication key for batch operations
 *
 * Use this for campaign sends to avoid sending to the same user twice
 *
 * @param campaignId Campaign ID
 * @param userId User ID
 * @returns Deduplication key
 */
export function generateCampaignDeduplicationKey(
  campaignId: string,
  userId: string
): string {
  return createHash('sha256')
    .update(`campaign:${campaignId}:user:${userId}`)
    .digest('hex')
}
