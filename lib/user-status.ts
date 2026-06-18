// Single source of truth for whether a user is "active" (has access to gated
// features). Mirrors the activation gate in middleware.ts: a user is active when
// they've completed the initial payment (or have the bypass) AND their subscription
// is active (or has the bypass). `is_active !== false` treats null/undefined as
// active, matching the middleware.
export interface UserActivationFlags {
  initial_payment_completed?: boolean | null
  bypass_initial_payment?: boolean | null
  is_active?: boolean | null
  bypass_subscription?: boolean | null
}

export function computeIsActive(u: UserActivationFlags | null | undefined): boolean {
  if (!u) return false
  const hasInitialAccess = !!(u.initial_payment_completed || u.bypass_initial_payment)
  const hasSubscriptionAccess = u.is_active !== false || !!u.bypass_subscription
  return hasInitialAccess && hasSubscriptionAccess
}
