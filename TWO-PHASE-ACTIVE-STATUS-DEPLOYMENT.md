# Two-Phase Active Status Deployment Guide

## What Changed

### Old Logic (Incorrect)
- Active status = has active Stripe subscription
- User pays $500 → waits for subscription → then becomes active

### New Logic (Correct)
- **Phase 1 (30-day grace):** User pays $500 → active immediately for 30 days
- **Phase 2 (Subscription):** User subscribes → active based on subscription status
- Stripe handles monthly/weekly billing with 3-day grace period (33 days total)

---

## User Journey

### Day 0: Initial Payment
```
User pays $500 initial payment
↓
✅ is_active = TRUE (immediately!)
✅ initial_payment_date = NOW()
✅ 30-day grace period starts
✅ active_network_count incremented for all ancestors
```

### Day 1-30: Grace Period
```
User can subscribe anytime (weekly $49.75 or monthly $199)
↓
When user clicks "Subscribe":
  ✅ First payment charged immediately
  ✅ Billing anniversary = day of first subscription
  ✅ Subscription status = 'active'
  ✅ is_active = TRUE (stays active)
```

**Example:**
- User subscribes on June 15 → next payment July 15
- User subscribes on June 28 → next payment July 28

### Day 31+: Grace Period Expired
```
IF user hasn't subscribed:
  ❌ is_active = FALSE
  ❌ active_network_count decremented for all ancestors
  ⚠️  User must subscribe to reactivate
```

### Ongoing: Subscription Billing
```
Stripe auto-charges on billing anniversary
↓
Payment succeeds:
  ✅ subscription.status = 'active'
  ✅ is_active = TRUE
  ✅ User stays active

Payment fails (after retries + grace period):
  ❌ subscription.status = 'past_due' or 'canceled'
  ❌ is_active = FALSE
  ❌ active_network_count decremented for ancestors

User updates card and pays:
  ✅ subscription.status = 'active' again
  ✅ is_active = TRUE
  ✅ active_network_count incremented for ancestors
```

---

## Deployment Steps

### Step 1: Run Database Migrations

**In Supabase SQL Editor, run these in order:**

```sql
-- 1. Add initial_payment_date column
\i supabase-initial-payment-date-schema.sql

-- 2. Update daily cron with two-phase logic
\i supabase-updated-daily-subscription-sync.sql
```

**Verify:**
```sql
-- Check column was added
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'initial_payment_date';

-- Should return 1 row
```

---

### Step 2: Verify Current State

```sql
-- Preview what will change
SELECT * FROM public.preview_active_status_changes()
WHERE status_change != 'No change';
```

**What to look for:**
- Test users without subscriptions may show "Will become INACTIVE" (expected if >30 days since payment)
- Real users with active subscriptions should show "No change"

---

### Step 3: Run Verification Suite

Copy and paste queries from `verify-two-phase-active-status.sql` one by one.

**Key checks:**
1. ✅ Column `initial_payment_date` exists
2. ✅ All users show `status_matches = TRUE`
3. ✅ Users in grace period are active
4. ✅ Users with active subscriptions are active
5. ✅ Active counts are accurate

---

### Step 4: Deploy Code Changes

The webhook has been updated to:
- Set `is_active = true` on initial $500 payment
- Increment `active_network_count` for ancestors

```bash
cd /Users/charlieramirez/Desktop/tradinghub

# Review changes
git diff app/api/stripe/webhooks/route.ts

# Stage and commit
git add .
git commit -m "Implement two-phase active status

- Users become active immediately after $500 payment
- 30-day grace period to subscribe
- Active status follows subscription status after subscribing
- Stripe handles monthly/weekly billing with 3-day grace period"

# Deploy
git push
```

---

### Step 5: Test the Complete Flow

#### Test 1: Create Test User and Pay $500

**In your app:**
1. Register new test user
2. Pay $500 initial payment
3. Check database:

```sql
SELECT
    email,
    is_active,
    initial_payment_date,
    initial_payment_completed
FROM public.users
WHERE email = 'testuser@example.com';
```

**Expected:**
- `is_active = TRUE`
- `initial_payment_date = <timestamp of payment>`
- `initial_payment_completed = TRUE`

#### Test 2: Subscribe Within Grace Period

**In your app:**
1. Go to payments page
2. Choose weekly or monthly
3. Complete subscription
4. Check database:

```sql
SELECT
    u.email,
    u.is_active,
    s.status as subscription_status,
    s.current_period_end
FROM public.users u
JOIN public.subscriptions s ON s.user_id = u.id
WHERE u.email = 'testuser@example.com';
```

**Expected:**
- `is_active = TRUE`
- `subscription_status = 'active'`
- `current_period_end = <30 days from now>`

#### Test 3: Grace Period Expiration (Simulated)

**Simulate a user past 30 days:**
```sql
-- Temporarily set initial_payment_date to 35 days ago
UPDATE public.users
SET initial_payment_date = NOW() - INTERVAL '35 days'
WHERE email = 'testuser-no-sub@example.com';

-- Run the daily cron
SELECT * FROM public.update_all_active_statuses();

-- Check user is now inactive
SELECT email, is_active FROM public.users
WHERE email = 'testuser-no-sub@example.com';
```

**Expected:**
- `is_active = FALSE`
- Cron output: "grace period expired"

**Cleanup:**
```sql
-- Restore date
UPDATE public.users
SET initial_payment_date = NOW()
WHERE email = 'testuser-no-sub@example.com';
```

---

## Monitoring

### Daily Checks

```sql
-- 1. Users in grace period
SELECT
    email,
    EXTRACT(DAY FROM NOW() - initial_payment_date)::INTEGER as days_since_payment,
    is_active
FROM public.users
WHERE initial_payment_completed = TRUE
AND initial_payment_date >= NOW() - INTERVAL '30 days'
AND (SELECT COUNT(*) FROM public.subscriptions WHERE user_id = users.id) = 0;

-- 2. Active status accuracy
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active,
    COUNT(*) FILTER (WHERE is_active = FALSE) as inactive
FROM public.users
WHERE network_position_id IS NOT NULL;

-- 3. Cron execution log
SELECT
    jobname,
    start_time,
    status,
    return_message
FROM cron.job_run_details
WHERE jobname = 'daily-active-status-update'
ORDER BY start_time DESC
LIMIT 5;
```

---

## Troubleshooting

### Issue 1: User paid $500 but is_active = FALSE

**Check:**
```sql
SELECT
    email,
    is_active,
    initial_payment_completed,
    initial_payment_date,
    EXTRACT(DAY FROM NOW() - initial_payment_date)::INTEGER as days_since_payment
FROM public.users
WHERE email = 'problem-user@example.com';
```

**Fix:**
- If `days_since_payment > 30` and no subscription → Expected (grace period expired)
- If `days_since_payment < 30` → Run daily cron manually: `SELECT public.update_all_active_statuses();`

### Issue 2: Webhook didn't set is_active = TRUE

**Check webhook logs:**
```bash
# In your deployment logs
"Processing initial payment for user: ..."
"User became active! Incremented active_network_count for N ancestors"
```

**If missing:**
- Verify webhook secret is correct
- Check Stripe webhook is receiving events
- Re-test payment with new user

### Issue 3: Active counts don't match

**Recalculate:**
```sql
-- Run the full sync (one-time fix)
SELECT * FROM public.sync_all_network_counts();
```

---

## Edge Cases Handled

✅ **User pays $500, subscribes on day 1**
- Active continuously from day 0 → day 30 → ongoing

✅ **User pays $500, waits 29 days, then subscribes**
- Active for 29 days → subscribes → stays active

✅ **User pays $500, never subscribes**
- Active for 30 days → becomes inactive on day 31

✅ **User pays $500, subscribes, then cancels**
- Active immediately → active with subscription → inactive after cancel

✅ **User pays $500, never subscribes, then subscribes 60 days later**
- Active for 30 days → inactive for 30 days → active when subscribes

---

## Success Criteria

Deployment is successful when:

1. ✅ Users who pay $500 become active immediately
2. ✅ `initial_payment_date` is set correctly
3. ✅ Users stay active for 30 days after initial payment (if no subscription)
4. ✅ Users who subscribe stay active based on subscription status
5. ✅ Grace period expiration correctly deactivates users
6. ✅ Active counts update correctly on status changes
7. ✅ Daily cron runs successfully
8. ✅ Webhook logs show status changes

---

## Files Created/Modified

### Database Files
- ✅ `supabase-initial-payment-date-schema.sql` - Adds column
- ✅ `supabase-updated-daily-subscription-sync.sql` - Two-phase cron logic
- ✅ `verify-two-phase-active-status.sql` - Verification queries

### Code Files
- ✅ `app/api/stripe/webhooks/route.ts` - Updated initial payment handling

### Documentation
- ✅ `TWO-PHASE-ACTIVE-STATUS-DEPLOYMENT.md` - This file

---

## Rollback Plan

If issues occur:

```sql
-- Revert to subscription-only logic
CREATE OR REPLACE FUNCTION public.update_all_active_statuses()
RETURNS INTEGER AS $$
BEGIN
    -- Simple logic: active = has active subscription
    UPDATE public.users u
    SET is_active = (
        EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.user_id = u.id
            AND s.status = 'active'
        )
    )
    WHERE network_position_id IS NOT NULL;

    RETURN ROW_COUNT;
END;
$$ LANGUAGE plpgsql;
```

Then redeploy old webhook code from git history.

---

## Next Steps After Deployment

1. ✅ Monitor for 24 hours
2. ✅ Check daily cron execution logs
3. ✅ Verify active counts stay accurate
4. ✅ Test payment flows (initial, subscription, cancellation)
5. ✅ Document grace period in user-facing materials

---

**Deployment Date:** [To be filled]
**Status:** Ready for deployment
**Priority:** High
