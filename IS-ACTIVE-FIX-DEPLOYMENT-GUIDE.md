# Fix is_active Default Value - Deployment Guide

## The Problem

Users are automatically set to `is_active = TRUE` when they sign up, but they should only become active after the $500 initial payment.

**Current (Broken) Flow:**
1. User signs up → `is_active = TRUE` ✗ WRONG!
2. User pays $500 → `is_active = TRUE` (still true, but wasn't changed)
3. Unpaid users are active → Can participate in network ✗ WRONG!

**Expected (Correct) Flow:**
1. User signs up → `is_active = FALSE` ✓
2. User pays $500 → `is_active = TRUE` ✓
3. User has 30-day grace period ✓
4. After 30 days without subscription → `is_active = FALSE` ✓
5. With active subscription → `is_active = TRUE` ✓

---

## Root Cause

The database schema sets `is_active DEFAULT TRUE`:

**File:** `supabase-network-position-schema.sql` (old line 23)
```sql
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
```

**File:** `supabase-sniper-volume-schema.sql` (old line 23)
```sql
ALTER COLUMN is_active SET DEFAULT TRUE;
```

This means ALL new users automatically get `is_active = TRUE` when their account is created, BEFORE they pay anything.

---

## The Solution

We've updated the schema files and created a migration to:
1. Change the default value to `FALSE`
2. Fix existing users who shouldn't be active
3. Set up daily grace period management

---

## Deployment Steps

### STEP 1: Run the Migration

**File:** `fix-is-active-default.sql`

This script will:
- Change `is_active` default from TRUE to FALSE
- Find users who are active but haven't paid $500
- Deactivate those users
- Decrement `active_network_count` for their ancestors
- Show a detailed report of what was changed

**Run in Supabase SQL Editor:**
Copy and paste the entire contents of `fix-is-active-default.sql` and execute.

**Expected Output:**
```
========================================
FIXING EXISTING USERS WHO SHOULD NOT BE ACTIVE
========================================
Deactivated user: John Doe (john@example.com) - Reason: No initial payment
  → Decremented active_network_count for ancestors
...
========================================
SUMMARY: Deactivated X users
========================================
```

---

### STEP 2: Deploy the Daily Subscription Sync Cron

**File:** `supabase-updated-daily-subscription-sync.sql`

This function handles the 30-day grace period logic:
- Users who paid $500 stay active for 30 days
- After 30 days, they need an active subscription
- Automatically updates `is_active` status daily
- Increments/decrements `active_network_count` for ancestors

**Run in Supabase SQL Editor:**
Copy and paste the entire contents of `supabase-updated-daily-subscription-sync.sql` and execute.

**Then, set up a daily cron job in Supabase:**

1. Go to Supabase Dashboard → Database → Cron Jobs (or use pg_cron)
2. Create a new cron job:

```sql
-- Run daily at 2 AM UTC
SELECT cron.schedule(
    'daily-subscription-sync',
    '0 2 * * *',  -- Every day at 2 AM
    $$
    SELECT public.daily_subscription_sync();
    $$
);
```

3. Verify the cron job was created:
```sql
SELECT * FROM cron.job;
```

---

### STEP 3: Verify the Fix

**File:** `verify-is-active-fix.sql`

Run this verification script to check:
- Default value is now FALSE
- Active users all have paid $500
- Inactive users haven't paid
- Grace period logic is working

**Run in Supabase SQL Editor:**
Copy and paste `verify-is-active-fix.sql` and execute.

**Expected Results:**
```
✓ Default is FALSE - New users will start inactive
✓ No active users without initial payment
✓ No active users past grace period without subscription
```

---

### STEP 4: Test with a New Signup

Create a test user through your signup flow:

**1. After signup (before payment):**
```sql
SELECT id, name, email, is_active, initial_payment_completed
FROM users
WHERE email = 'test@example.com';
```

**Expected:**
- `is_active = FALSE` ✓
- `initial_payment_completed = NULL` or `FALSE` ✓

**2. After $500 payment:**
```sql
SELECT id, name, email, is_active, initial_payment_completed, initial_payment_date
FROM users
WHERE email = 'test@example.com';
```

**Expected:**
- `is_active = TRUE` ✓
- `initial_payment_completed = TRUE` ✓
- `initial_payment_date` is set ✓

**3. Check grace period (simulate 31 days later):**
```sql
-- Manually set the date to 31 days ago to test
UPDATE users
SET initial_payment_date = NOW() - INTERVAL '31 days'
WHERE email = 'test@example.com';

-- Run the daily sync manually
SELECT public.daily_subscription_sync();

-- Check status
SELECT id, name, email, is_active, initial_payment_date
FROM users
WHERE email = 'test@example.com';
```

**Expected (if no subscription):**
- `is_active = FALSE` ✓ (grace period expired)

**Expected (if has active subscription):**
- `is_active = TRUE` ✓ (subscription keeps them active)

---

## What Changed

### Schema Files Updated

**1. `supabase-network-position-schema.sql`**

```diff
- ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
+ ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE, -- Users start INACTIVE until $500 payment
```

**2. `supabase-sniper-volume-schema.sql`**

```diff
- ALTER COLUMN is_active SET DEFAULT TRUE;
+ ALTER COLUMN is_active SET DEFAULT FALSE;
```

### Webhook Handler (Already Correct!)

The webhook at `app/api/stripe/webhooks/route.ts` already properly handles activation:

**Line 99:** Sets `is_active = TRUE` on $500 payment ✓
**Line 98:** Sets `initial_payment_date` for grace period tracking ✓
**Lines 112-127:** Increments `active_network_count` for ancestors ✓

No changes needed here!

---

## How the 30-Day Grace Period Works

### Phase 1: Initial Payment → 30 Days
- User pays $500 → `is_active = TRUE`, `initial_payment_date` set
- User has 30 days to subscribe (grace period)
- User stays active during this period
- User counts toward upline's `active_network_count`

### Phase 2: After 30 Days
**Option A: User subscribed**
- `subscription.status = 'active'`
- User stays `is_active = TRUE` ✓
- Daily cron keeps them active as long as subscription is active

**Option B: User didn't subscribe**
- Daily cron detects grace period expired
- Sets `is_active = FALSE`
- Decrements `active_network_count` for ancestors
- User no longer counts toward upline's earnings

---

## Verification Checklist

After deployment, verify these conditions:

### ✅ Database Default
```sql
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'is_active';
```
**Should return:** `false`

### ✅ No Active Users Without Payment
```sql
SELECT COUNT(*) as wrong_active_users
FROM users
WHERE is_active = TRUE
AND (initial_payment_completed IS NULL OR initial_payment_completed = FALSE);
```
**Should return:** `0`

### ✅ Active Users Within Grace Period OR Have Subscription
```sql
SELECT
    u.name,
    u.email,
    u.is_active,
    u.initial_payment_date,
    s.status as subscription_status,
    CASE
        WHEN u.initial_payment_date >= NOW() - INTERVAL '30 days' THEN 'In grace period'
        WHEN s.status = 'active' THEN 'Has subscription'
        ELSE 'PROBLEM - Should not be active'
    END as reason
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = TRUE;
```
**Should show:** All active users either in grace period OR have active subscription

### ✅ Daily Cron Job Running
```sql
SELECT * FROM cron.job WHERE jobname = 'daily-subscription-sync';
```
**Should return:** 1 row with schedule `'0 2 * * *'`

---

## Troubleshooting

### Issue: Users still starting with is_active = TRUE

**Check:**
```sql
SELECT column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'is_active';
```

**If still TRUE:**
Run `fix-is-active-default.sql` again.

### Issue: Webhook not activating users on payment

**Check webhook logs:**
Look for:
```
✅ User updated successfully with 30-day grace period
```

**If not found:**
- Check Stripe webhook is configured correctly
- Verify `paymentType` metadata is set to `"initial"` in checkout session
- Check server logs for errors

### Issue: Grace period not expiring after 30 days

**Check cron job:**
```sql
SELECT * FROM cron.job WHERE jobname = 'daily-subscription-sync';
```

**Manually run sync:**
```sql
SELECT public.daily_subscription_sync();
```

**Check output:**
Look for:
```
User X grace period expired (30 days since $500 payment) - decremented active_network_count for Y ancestors
```

### Issue: Active network counts are wrong

**Run a full sync:**
```sql
SELECT * FROM public.sync_all_network_counts();
```

This will recalculate all network counts from scratch.

---

## Files Modified

### New Files Created
1. `fix-is-active-default.sql` - Migration to fix default and existing users
2. `verify-is-active-fix.sql` - Verification script
3. `IS-ACTIVE-FIX-DEPLOYMENT-GUIDE.md` - This guide

### Existing Files Updated
1. `supabase-network-position-schema.sql` - Changed DEFAULT TRUE → FALSE
2. `supabase-sniper-volume-schema.sql` - Changed DEFAULT TRUE → FALSE

### Existing Files to Deploy
1. `supabase-updated-daily-subscription-sync.sql` - Daily grace period cron (already exists)

---

## Impact on Existing Users

### Users Who Paid $500
- ✅ Stay active (have `initial_payment_date`)
- ✅ Get 30-day grace period
- ✅ Need to subscribe after grace period

### Users Who Haven't Paid $500
- ⚠️ Will be deactivated (correct behavior)
- ⚠️ Won't count toward upline's `active_network_count`
- ⚠️ Need to pay $500 to become active

### Network Counts
- `active_network_count` will decrease for uplines of users who get deactivated
- This is correct behavior (only paid members should count)
- Counts will be recalculated by the migration

---

## Success Criteria

✅ New users start with `is_active = FALSE`
✅ Users become active only after $500 payment
✅ Users stay active for 30 days (grace period)
✅ After 30 days without subscription → inactive
✅ With subscription → stay active
✅ `active_network_count` updates correctly
✅ Daily cron job running and working

---

## Related Documentation

- `supabase-updated-daily-subscription-sync.sql` - Grace period logic
- `TWO-PHASE-ACTIVE-STATUS-DEPLOYMENT.md` - Original design doc
- `verify-two-phase-active-status.sql` - Additional verification
- `app/api/stripe/webhooks/route.ts` - Payment webhook logic

---

## Need Help?

If you encounter issues:
1. Check the verification script output
2. Review server logs for webhook errors
3. Manually run the daily sync and check output
4. Verify cron job is scheduled correctly
5. Check Stripe webhook configuration
