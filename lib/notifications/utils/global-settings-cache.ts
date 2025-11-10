/**
 * GLOBAL NOTIFICATION SETTINGS
 *
 * Query global notification toggles from database.
 *
 * Strategy:
 * - Direct database query (no caching)
 * - Fail-open: If db unavailable, allow notifications
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface GlobalSettings {
  [notificationType: string]: boolean
}

/**
 * Get global notification settings
 *
 * @param supabase Supabase client
 * @returns Map of notification types to enabled status
 */
export async function getGlobalSettings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<GlobalSettings> {
  // Query database directly
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

    return settings
  } catch (error) {
    console.error('Error in getGlobalSettings:', error)
    // Fail open - allow notifications on error
    return {}
  }
}

/**
 * Invalidate global settings cache (no-op)
 *
 * Kept for backwards compatibility. Since we no longer use caching,
 * this function does nothing.
 *
 * @param _redis Unused parameter (kept for compatibility)
 */
export async function invalidateGlobalSettingsCache(_redis: unknown): Promise<void> {
  // No-op - no cache to invalidate
  return
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
