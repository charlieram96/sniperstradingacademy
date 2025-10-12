# Active Status Fix - Using Stripe Subscription Status

## What Was Wrong

The original implementation incorrectly tracked "active status" as:
```sql
last_payment_date >= NOW() - INTERVAL '33 days'
```

**Problem:** This doesn't work with Stripe subscriptions because:
- Stripe automatically charges on the user's payment anniversary (e.g., every 10th of month)
- Each user has their own payment day based on when they initially subscribed
- Stripe handles retry logic and grace periods automatically
- The 33-day window doesn't account for monthly anniversaries

## The Correct Approach

Since you're using **Stripe Subscriptions** (automatic billing), active status should mirror Stripe's subscription status:

```
Active = subscription.status === 'active'
```

Stripe manages:
- ✅ Automatic billing on monthly anniversary
- ✅ Payment retries on failed charges
- ✅ Grace periods (configurable in Stripe)
- ✅ Subscription status updates (`active`, `past_due`, `canceled`, etc.)

We just listen to webhooks and update our `is_active` flag accordingly.

## What Was Fixed

### 1. Subscription Webhook (`app/api/stripe/webhooks/route.ts`)

**Now handles:**
- When Stripe subscription status changes → update `users.is_active`
- If became inactive → call `decrement_upchain_active_count()`
- If became active → call `increment_upchain_active_count()`

**Webhook event:** `customer.subscription.updated`

```typescript
// New logic
const shouldBeActive = subscription.status === 'active'

// Update user's is_active to match Stripe
await supabase
  .from("users")
  .update({ is_active: shouldBeActive })
  .eq("id", userId)

// Handle count changes
if (wasActive && !shouldBeActive) {
  // Decrement active count
} else if (!wasActive && shouldBeActive) {
  // Increment active count
}
```

### 2. Payment Webhook (`app/api/stripe/webhooks/route.ts`)

**Removed:**
- ❌ Logic that checked "did user become active?"
- ❌ Incrementing active count on payment
- ❌ Setting `is_active = true` on payment

**Kept:**
- ✅ Recording payment in database
- ✅ Distributing sniper volume to upchain
- ✅ Updating commission rates

**Reason:** Active status is managed by subscription status, not individual payments.

### 3. Daily Cron Job (`supabase-daily-subscription-sync.sql`)

**Old logic:**
```sql
-- Checked payment dates
is_active = last_payment_date >= NOW() - 33 days
```

**New logic:**
```sql
-- Checks subscription status
is_active = (subscription.status = 'active')
```

**What it does:**
- Queries all users with subscriptions
- Compares `users.is_active` with `subscriptions.status`
- If mismatch → update `is_active` and adjust active counts

### 4. Payout Eligibility (`supabase-can-withdraw-with-connect.sql`)

**Added third requirement:** Stripe Connect account

**Requirements to withdraw:**
1. ✅ Active account (has active subscription)
2. ✅ 3+ direct referrals (for structure 1)
3. ✅ Stripe Connect account set up (new!)

**Updated function:**
```sql
CREATE OR REPLACE FUNCTION public.can_withdraw(p_user_id UUID)
RETURNS TABLE(
    can_withdraw BOOLEAN,
    reason TEXT,
    has_active_account BOOLEAN,
    has_enough_referrals BOOLEAN,
    has_connect_account BOOLEAN,
    ...
)
```

## Migration Steps

### Step 1: Run New SQL Files (IN ORDER!)

```sql
-- 1. Update daily cron to check subscription status
\i supabase-daily-subscription-sync.sql

-- 2. Update can_withdraw to require Stripe Connect
\i supabase-can-withdraw-with-connect.sql
```

### Step 2: Sync Existing Users

Run this to align is_active with subscription status:

```sql
-- Preview changes
SELECT * FROM public.preview_active_status_changes()
WHERE status_change != 'No change';

-- Apply changes
SELECT * FROM public.update_all_active_statuses();
```

### Step 3: Deploy Webhook Changes

```bash
git add app/api/stripe/webhooks/route.ts
git commit -m "Fix active status to use Stripe subscription status"
git push
```

### Step 4: Verify Cron Job

The daily cron is already scheduled, but verify it's using the new function:

```sql
SELECT * FROM cron.job WHERE jobname = 'daily-active-status-update';
```

Should run: `SELECT public.update_all_active_statuses()`

## How It Works Now

### User Journey

1. **User pays $500 initial**
   - `initial_payment_completed = true`
   - No subscription yet → `is_active = false`

2. **User subscribes (monthly or weekly)**
   - Stripe creates subscription
   - `subscription.status = 'active'`
   - Webhook: `customer.subscription.updated`
   - We set: `users.is_active = true`
   - We increment: `active_network_count` for all ancestors

3. **User pays monthly (automatically via Stripe)**
   - Stripe charges on anniversary (e.g., every 10th)
   - Webhook: `invoice.payment_succeeded`
   - We record payment and distribute sniper volume
   - NO change to `is_active` (already active via subscription)

4. **User's payment fails (e.g., card expired)**
   - Stripe retries payment (configurable)
   - If all retries fail → `subscription.status = 'past_due'` or `'canceled'`
   - Webhook: `customer.subscription.updated`
   - We set: `users.is_active = false`
   - We decrement: `active_network_count` for all ancestors

5. **User reactivates (updates card and pays)**
   - Stripe restores subscription
   - `subscription.status = 'active'` again
   - Webhook: `customer.subscription.updated`
   - We set: `users.is_active = true`
   - We increment: `active_network_count` for all ancestors

### Active Count Management

```
Incremented when:
- Subscription becomes active (new subscription or reactivation)

Decremented when:
- Subscription becomes inactive (payment failed, canceled, etc.)

NOT affected by:
- Individual payments (handled by subscription status)
- Payment dates (Stripe manages billing)
```

## Active vs. Payout Eligibility

### Active Status
**Determined by:** Stripe subscription status
**Affects:**
- `users.is_active` flag
- `active_network_count` for ancestors
- Commission rate calculations (based on active count)

### Payout Eligibility
**Determined by:** 3 separate checks
1. Active account (subscription status = active)
2. Required direct referrals (3 for structure 1, 6 for structure 2, etc.)
3. Stripe Connect account set up

**Check with:**
```sql
SELECT * FROM public.can_withdraw('user-uuid-here');
```

## Testing

### Test 1: Check Active Status Sync

```sql
-- Compare is_active with subscription status
SELECT
  u.id,
  u.email,
  u.is_active as user_is_active,
  s.status as subscription_status,
  (u.is_active = (s.status = 'active')) as matches
FROM public.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE u.network_position_id IS NOT NULL
LIMIT 20;
```

Should show `matches = true` for all users.

### Test 2: Check Payout Eligibility

```sql
-- See who can withdraw and why not
SELECT
  u.email,
  w.can_withdraw,
  w.reason,
  w.has_active_account,
  w.has_enough_referrals,
  w.has_connect_account,
  w.current_referrals || '/' || w.required_referrals as referrals
FROM public.users u
CROSS JOIN LATERAL public.can_withdraw(u.id) w
WHERE u.network_position_id IS NOT NULL
ORDER BY w.can_withdraw DESC, u.network_level
LIMIT 20;
```

### Test 3: Simulate Subscription Change

```sql
-- Find a test user with active subscription
SELECT u.id, u.email, s.stripe_subscription_id, s.status
FROM public.users u
JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.status = 'active'
LIMIT 1;

-- In Stripe Dashboard:
-- 1. Go to Subscriptions
-- 2. Find the test subscription
-- 3. Cancel it
-- 4. Check your webhook logs

-- Verify:
SELECT is_active FROM public.users WHERE id = 'test-user-id';
-- Should now be FALSE

-- Verify ancestors' active count decreased by 1
```

## Monitoring

### Daily Cron Execution

```sql
-- Check recent cron runs
SELECT
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobname = 'daily-active-status-update'
ORDER BY start_time DESC
LIMIT 10;
```

### Active Count Accuracy

```sql
-- Verify active counts match reality
WITH actual_active AS (
  SELECT
    u.id,
    COUNT(*) FILTER (
      WHERE child.network_position_id IS NOT NULL
      AND child_sub.status = 'active'
    ) as actual_active_count
  FROM public.users u
  LEFT JOIN public.users child ON child.network_level > u.network_level
    AND child.network_position >= (u.network_position - 1) * POWER(3, child.network_level - u.network_level)::BIGINT + 1
    AND child.network_position <= (u.network_position) * POWER(3, child.network_level - u.network_level)::BIGINT
  LEFT JOIN public.subscriptions child_sub ON child_sub.user_id = child.id
  WHERE u.network_position_id IS NOT NULL
  GROUP BY u.id
)
SELECT
  u.id,
  u.email,
  u.active_network_count as stored_count,
  a.actual_active_count,
  (u.active_network_count = a.actual_active_count) as matches
FROM public.users u
JOIN actual_active a ON a.id = u.id
WHERE u.network_level < 3  -- Only check first few levels (slow query)
LIMIT 10;
```

## Files Changed

### Modified
- `app/api/stripe/webhooks/route.ts` - Subscription and payment webhooks

### New
- `supabase-daily-subscription-sync.sql` - Updated daily cron
- `supabase-can-withdraw-with-connect.sql` - Updated withdrawal eligibility

### No Longer Needed
- `supabase-daily-active-status-cron.sql` - Old version (replaced)

## Rollback Plan

If something goes wrong:

```sql
-- Restore old date-based checking
CREATE OR REPLACE FUNCTION public.update_all_active_statuses()
RETURNS INTEGER AS $$
BEGIN
    UPDATE public.users
    SET is_active = (
        last_payment_date IS NOT NULL
        AND last_payment_date >= NOW() - INTERVAL '33 days'
    )
    WHERE network_position_id IS NOT NULL;

    RETURN ROW_COUNT;
END;
$$ LANGUAGE plpgsql;
```

Then redeploy old webhook code from git history.

## Next Steps

After migration:

1. ✅ Monitor cron job for 1 week
2. ✅ Verify active counts stay accurate
3. ✅ Test subscription cancellation flow
4. ✅ Test reactivation flow
5. ✅ Document Stripe Connect onboarding process

---

**Migration Date:** [Run date here]
**Status:** [Pending / Complete]
**Notes:** [Any issues encountered]
