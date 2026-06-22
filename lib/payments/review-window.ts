/**
 * Payment-review window math.
 *
 * Users are flagged for compliance review when they miss 12+ weeks of payments
 * within a rolling 26-week window. To avoid false positives, "missed weeks" is
 * measured against how many weeks have actually ELAPSED since tracking started
 * (capped at the full 26-week window) — not a fixed 26. This means a brand-new
 * cohort can't be flagged until at least 12 weeks have elapsed, but once they
 * have, a user who simply never paid is flagged immediately rather than waiting
 * for the entire 26-week window to pass.
 *
 * Shared by the daily cron (sets the flag) and the admin API (displays it) so
 * the displayed "missed weeks" always matches the reason a user was flagged.
 */

// Date from which we start tracking — no retroactive flagging before this.
export const REVIEW_TRACKING_START_DATE = new Date('2026-03-08T00:00:00Z')

// Full rolling window: 26 weeks.
export const WINDOW_DAYS = 182
export const FULL_WINDOW_WEEKS = 26

// Threshold: this many missed weeks (or more) triggers a flag.
export const MISSED_WEEKS_THRESHOLD = 12

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Whole weeks elapsed since tracking start (never negative). */
export function elapsedWeeksSinceTrackingStart(now: Date): number {
  const days = (now.getTime() - REVIEW_TRACKING_START_DATE.getTime()) / MS_PER_DAY
  return Math.max(0, Math.floor(days / 7))
}

/**
 * Weeks a user is expected to have covered by `now`: elapsed weeks, capped at
 * the full 26-week window. This is the baseline that coverage is compared to.
 */
export function expectedCoverageWeeks(now: Date): number {
  return Math.min(FULL_WINDOW_WEEKS, elapsedWeeksSinceTrackingStart(now))
}

/**
 * Missed weeks = expected coverage − actual coverage (never negative).
 * `coverageWeeks` = weekly payments + monthly payments × 4 within the window.
 */
export function computeMissedWeeks(coverageWeeks: number, now: Date): number {
  return Math.max(0, expectedCoverageWeeks(now) - coverageWeeks)
}

/** True once enough time has elapsed that the threshold is reachable. */
export function isFlaggingActive(now: Date): boolean {
  return expectedCoverageWeeks(now) >= MISSED_WEEKS_THRESHOLD
}

/** Start of the payment-counting window: max(now − 182d, tracking start). */
export function getWindowStart(now: Date): Date {
  const fromNow = new Date(now)
  fromNow.setDate(fromNow.getDate() - WINDOW_DAYS)
  return fromNow > REVIEW_TRACKING_START_DATE ? fromNow : REVIEW_TRACKING_START_DATE
}
