/**
 * QUIET HOURS UTILITY
 *
 * Handles quiet hours enforcement to avoid sending notifications
 * during user's sleep hours in their local timezone.
 */

import { QuietHoursCheckResult, NotificationPreferences } from '../notification-types'

/**
 * Check if current time is within user's quiet hours
 *
 * @param timezone User's timezone (e.g., 'America/New_York')
 * @param quietHours User's quiet hours preferences
 * @returns QuietHoursCheckResult with defer time if in quiet hours
 */
export function isInQuietHours(
  timezone: string,
  quietHours: NotificationPreferences['quiet_hours']
): QuietHoursCheckResult {
  if (!quietHours.enabled) {
    return {
      inQuietHours: false,
      deferUntil: null,
      userTimezone: timezone,
      currentUserTime: new Date()
    }
  }

  try {
    // Get current time in user's timezone
    const currentUserTime = new Date(
      new Date().toLocaleString('en-US', { timeZone: timezone })
    )

    const currentHour = currentUserTime.getHours()
    const currentMinute = currentUserTime.getMinutes()
    const currentTimeInMinutes = currentHour * 60 + currentMinute

    // Parse quiet hours (e.g., "22:00" and "08:00")
    const [startHour, startMinute] = quietHours.start.split(':').map(Number)
    const [endHour, endMinute] = quietHours.end.split(':').map(Number)

    const startTimeInMinutes = startHour * 60 + startMinute
    const endTimeInMinutes = endHour * 60 + endMinute

    let inQuietHours: boolean

    // Check if quiet hours span midnight (e.g., 22:00 to 08:00)
    if (startTimeInMinutes > endTimeInMinutes) {
      // Quiet hours span midnight
      inQuietHours =
        currentTimeInMinutes >= startTimeInMinutes ||
        currentTimeInMinutes < endTimeInMinutes
    } else {
      // Quiet hours within same day
      inQuietHours =
        currentTimeInMinutes >= startTimeInMinutes &&
        currentTimeInMinutes < endTimeInMinutes
    }

    let deferUntil: Date | null = null

    if (inQuietHours) {
      // Calculate when quiet hours end
      const endDate = new Date(currentUserTime)
      endDate.setHours(endHour, endMinute, 0, 0)

      // If end time is before current time, it means end is tomorrow
      if (endDate <= currentUserTime) {
        endDate.setDate(endDate.getDate() + 1)
      }

      deferUntil = endDate
    }

    return {
      inQuietHours,
      deferUntil,
      userTimezone: timezone,
      currentUserTime
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error)
    // If timezone is invalid, default to not in quiet hours
    return {
      inQuietHours: false,
      deferUntil: null,
      userTimezone: timezone,
      currentUserTime: new Date()
    }
  }
}

/**
 * Format defer time as human-readable string
 *
 * @param deferUntil Date to defer until
 * @returns Human-readable string like "in 6 hours"
 */
export function formatDeferTime(deferUntil: Date): string {
  const now = new Date()
  const diffMs = deferUntil.getTime() - now.getTime()
  const diffMinutes = Math.floor(diffMs / 1000 / 60)

  if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`
}

/**
 * Get list of common timezones for UI selection
 *
 * @returns Array of timezone objects with label and value
 */
export function getCommonTimezones() {
  return [
    { label: 'Eastern Time (ET)', value: 'America/New_York' },
    { label: 'Central Time (CT)', value: 'America/Chicago' },
    { label: 'Mountain Time (MT)', value: 'America/Denver' },
    { label: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
    { label: 'Alaska Time (AKT)', value: 'America/Anchorage' },
    { label: 'Hawaii Time (HT)', value: 'Pacific/Honolulu' },
    { label: 'London (GMT/BST)', value: 'Europe/London' },
    { label: 'Paris (CET/CEST)', value: 'Europe/Paris' },
    { label: 'Berlin (CET/CEST)', value: 'Europe/Berlin' },
    { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
    { label: 'Sydney (AEDT)', value: 'Australia/Sydney' },
    { label: 'Dubai (GST)', value: 'Asia/Dubai' },
    { label: 'Singapore (SGT)', value: 'Asia/Singapore' },
    { label: 'Hong Kong (HKT)', value: 'Asia/Hong_Kong' },
    { label: 'Mumbai (IST)', value: 'Asia/Kolkata' },
    { label: 'Toronto (ET)', value: 'America/Toronto' },
    { label: 'Vancouver (PT)', value: 'America/Vancouver' },
    { label: 'Mexico City (CST)', value: 'America/Mexico_City' }
  ]
}
