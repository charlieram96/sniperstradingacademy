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

// The initial unlock payment covers the user's first ~30-day cycle; subscription
// liability (and therefore expected weekly coverage) only begins after it.
export const INITIAL_GRACE_DAYS = 30

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Whole weeks elapsed since tracking start (never negative). */
export function elapsedWeeksSinceTrackingStart(now: Date): number {
  const days = (now.getTime() - REVIEW_TRACKING_START_DATE.getTime()) / MS_PER_DAY
  return Math.max(0, Math.floor(days / 7))
}

/**
 * Global ceiling on expected coverage: elapsed weeks since tracking start, capped
 * at the full 26-week window. Used only as a coarse "is flagging even possible
 * yet" gate — the actual per-user flag decision must use
 * {@link userExpectedCoverageWeeks}, which accounts for when the user joined.
 */
export function expectedCoverageWeeks(now: Date): number {
  return Math.min(FULL_WINDOW_WEEKS, elapsedWeeksSinceTrackingStart(now))
}

/**
 * The date from which a user is expected to have subscription coverage: the later
 * of the global tracking start and the user's own liability start (initial unlock
 * + the 30-day cycle the initial payment covers). Falls back to the tracking start
 * when no initial payment date is known.
 */
export function userLiabilityStart(initialPaymentDate: Date | null): Date {
  if (!initialPaymentDate) return REVIEW_TRACKING_START_DATE
  const liabilityStart = new Date(initialPaymentDate.getTime() + INITIAL_GRACE_DAYS * MS_PER_DAY)
  return liabilityStart > REVIEW_TRACKING_START_DATE ? liabilityStart : REVIEW_TRACKING_START_DATE
}

/**
 * Weeks a SPECIFIC user is expected to have covered by `now`: whole weeks elapsed
 * since their liability start, capped at the 26-week window. A user who joined
 * recently (or whose liability hasn't started yet) expects ~0 weeks, so they
 * can't be flagged for payments they were never due to make.
 */
export function userExpectedCoverageWeeks(now: Date, initialPaymentDate: Date | null): number {
  const start = userLiabilityStart(initialPaymentDate)
  const days = (now.getTime() - start.getTime()) / MS_PER_DAY
  return Math.min(FULL_WINDOW_WEEKS, Math.max(0, Math.floor(days / 7)))
}

/**
 * Missed weeks = expected coverage − actual coverage (never negative).
 * `coverageWeeks` = weekly payments + monthly payments × 4 within the window.
 *
 * Pass the user's `initialPaymentDate` so expectation is anchored to when THEY
 * became liable. Omitting it falls back to the global tracking-start baseline,
 * which over-counts for recently-joined members and must not be used for flagging.
 */
export function computeMissedWeeks(
  coverageWeeks: number,
  now: Date,
  initialPaymentDate: Date | null = null
): number {
  const expected = initialPaymentDate !== null
    ? userExpectedCoverageWeeks(now, initialPaymentDate)
    : expectedCoverageWeeks(now)
  return Math.max(0, expected - coverageWeeks)
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
