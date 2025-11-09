/**
 * GLOBAL NOTIFICATION SETTINGS CACHE
 *
 * Redis caching for global notification toggles to prevent
 * database queries on every notification send.
 *
 * Cache Strategy:
 * - TTL: 5 minutes (300 seconds)
 * - Invalidation: On any toggle update
 * - Fail-open: If cache/db unavailable, allow notifications
 */

import type { Redis } from 'ioredis'
import type { SupabaseClient } from '@supabase/supabase-js'

const CACHE_KEY = 'global:notification:settings'
const CACHE_TTL = 300 // 5 minutes

export interface GlobalSettings {
  [notificationType: string]: boolean
}

/**
 * Get global notification settings (with caching)
 *
 * @param redis Redis connection
 * @param supabase Supabase client
 * @returns Map of notification types to enabled status
 */
export async function getGlobalSettings(
  redis: Redis | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<GlobalSettings> {
  // Try cache first (if Redis is available)
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      console.warn('Redis cache unavailable, querying database:', error)
    }
  }

  // Cache miss or Redis unavailable - query database
  try {
    const { data, error } = await supabase
      .from('notification_global_settings')
      .select('notification_type, enabled')

    if (error) {
      console.error('Error fetching global settings:', error)
      // Fail open - allow notifications if settings unavailable
      return {}
    }

    if (!data) {
      return {}
    }

    // Convert to map
    const settings: GlobalSettings = {}
    data.forEach((row: { notification_type: string; enabled: boolean }) => {
      settings[row.notification_type] = row.enabled
    })

    // Store in cache (if Redis is available)
    if (redis) {
      try {
        await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(settings))
      } catch (error) {
        console.warn('Failed to cache global settings:', error)
        // Continue even if cache write fails
      }
    }

    return settings
  } catch (error) {
    console.error('Error in getGlobalSettings:', error)
    // Fail open - allow notifications on error
    return {}
  }
}

/**
 * Invalidate global settings cache
 *
 * Call this whenever global settings are updated
 *
 * @param redis Redis connection (can be null)
 */
export async function invalidateGlobalSettingsCache(redis: Redis | null): Promise<void> {
  if (!redis) {
    console.warn('Redis not available, skipping cache invalidation')
    return
  }

  try {
    await redis.del(CACHE_KEY)
    console.log('Global settings cache invalidated')
  } catch (error) {
    console.error('Error invalidating global settings cache:', error)
    // Non-fatal - cache will expire naturally
  }
}

/**
 * Check if a notification type is enabled globally
 *
 * @param settings Global settings map
 * @param notificationType Notification type to check
 * @returns True if enabled (fail-open if type not found)
 */
export function isNotificationEnabled(
  settings: GlobalSettings,
  notificationType: string
): boolean {
  // If type not in settings, default to enabled (fail open)
  return settings[notificationType] ?? true
}
