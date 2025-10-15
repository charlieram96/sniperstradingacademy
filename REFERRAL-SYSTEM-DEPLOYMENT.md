# Referral System - Deployment Guide

## Current Status: ❌ Schema Not Deployed

Your referral system code is implemented, but the database schema is **not deployed** yet. This means:

- ✅ Referral records ARE being created when users sign up
- ✅ Referral status IS being updated when users pay $500
- ❌ `direct_referrals_count` column does NOT exist
- ❌ Referral counts are NOT being tracked
- ❌ Trigger is NOT deployed

---

## Quick Fix (5 Minutes)

### Step 1: Check Current State

Run this in Supabase SQL Editor:

```bash
check-referral-schema.sql
```

**Expected output:**
```
✗ direct_referrals_count column MISSING in users table
✗ trigger_update_direct_referrals MISSING on referrals table
✗ update_direct_referrals_count() function MISSING

SCHEMA INCOMPLETE
→ Deploy supabase-activation-schema.sql
```

### Step 2: Deploy the Schema

Run this in Supabase SQL Editor:

```bash
supabase-activation-schema.sql
```

**What this does:**
- Adds `direct_referrals_count` column to users table (default 0)
- Creates `update_direct_referrals_count()` function
- Creates trigger on referrals table that fires when status changes
- Adds other activation columns (activated_at, qualification_deadline, etc.)

**Expected output:**
```
ALTER TABLE
CREATE FUNCTION
CREATE TRIGGER
```

### Step 3: Verify Deployment

Run the check again:

```bash
check-referral-schema.sql
```

**Expected output:**
```
✓ direct_referrals_count column exists in users table
✓ trigger_update_direct_referrals exists on referrals table
✓ update_direct_referrals_count() function exists

✓✓✓ ALL CHECKS PASSED ✓✓✓
```

### Step 4: Fix Existing Data

Since the trigger wasn't there before, existing referral counts are wrong. Fix them:

```bash
fix-referral-counts.sql
```

**What this does:**
- Calculates actual count of active referrals for each user
- Updates `direct_referrals_count` to match reality
- Shows before/after comparison

**Expected output:**
```
BEFORE FIX: Current State
  John Smith: stored=0, actual=3 (✗ Needs Fix)
  Jane Doe: stored=0, actual=2 (✗ Needs Fix)

APPLYING FIX...
Fix applied!

AFTER FIX: Updated State
  John Smith: stored=3, actual=3 (✓ Correct)
  Jane Doe: stored=2, actual=2 (✓ Correct)

✓✓✓ SUCCESS - All counts are now correct!
```

### Step 5: Verify Everything Works

```bash
verify-direct-referrals.sql
```

**Expected output:**
```
TEST 1: ✓ direct_referrals_count column exists
TEST 2: ✓ Trigger exists
TEST 3: ✓ All required columns exist
TEST 4: ✓ PASS - All counts match

SUMMARY
✓ direct_referrals_count column exists
✓ Trigger exists
✓ All counts match actual referrals
```

---

## What Happens After Deployment

### When a User Signs Up with Referral Code:

**Server logs:**
```
✅ Referral record created successfully
   Referrer: 86a789ea-e356-4f06-bc2e-dc1398c553d3 → Referred: 1553fea9-f706-4bac-a3ab-7a43367949a9
```

**Database:**
- Referral record created with `status = "pending"`
- Referrer's `direct_referrals_count` stays the same (user hasn't paid yet)

### When User Pays $500:

**Server logs:**
```
✅ Referral updated to 'active' status
✅ Referrer's direct_referrals_count updated via trigger
   Referrer: John Smith (86a789ea...)
   New direct_referrals_count: 3
```

**Database:**
- Referral `status` changed to "active"
- Trigger fires automatically
- Referrer's `direct_referrals_count` incremented by +1

---

## Files Created

| File | Purpose |
|------|---------|
| `check-referral-schema.sql` | Safe pre-check - tells you what's missing |
| `supabase-activation-schema.sql` | Deploy this to add column + trigger |
| `fix-referral-counts.sql` | Sync counts with reality after deployment |
| `verify-direct-referrals.sql` | Full verification of data integrity |
| `DIRECT-REFERRALS-LOGGING.md` | Documentation of expected server logs |

---

## Code Changes Made

### 1. `app/(auth)/register/page.tsx`

**Added:** Error handling + logging for referral creation

```typescript
const { error: referralError } = await supabase
  .from("referrals")
  .insert({ ... })

if (referralError) {
  console.error("❌ Error creating referral record:", referralError)
} else {
  console.log("✅ Referral record created successfully")
  console.log(`   Referrer: ${referrer} → Referred: ${user}`)
}
```

### 2. `app/(auth)/complete-signup/page.tsx`

**Added:** Same logging for OAuth signup flow

### 3. `app/api/stripe/webhooks/route.ts`

**Added:** Logging for count updates + graceful handling if column missing

```typescript
try {
  const { data: referrerData, error: countError } = await supabase
    .from("users")
    .select("name, direct_referrals_count")
    ...

  if (countError) {
    console.warn("⚠️  Could not fetch direct_referrals_count - column may not exist")
    console.warn("   Deploy supabase-activation-schema.sql to enable referral counting")
  } else {
    console.log(`✅ Referrer's direct_referrals_count updated via trigger`)
    console.log(`   New direct_referrals_count: ${referrerData.direct_referrals_count}`)
  }
} catch (err) {
  console.warn("⚠️  Error fetching direct_referrals_count:", err)
}
```

**Why this is important:**
- Webhook won't crash if schema not deployed
- You'll see a warning in logs telling you to deploy schema
- Payment processing continues successfully

---

## Testing After Deployment

### Test 1: Create New User with Referral

1. Go to `/register`
2. Enter a valid referral code
3. Sign up with email or Google
4. Check server logs

**Expected:**
```
✅ Referral record created successfully
   Referrer: <id> → Referred: <id>
```

5. Query database:

```sql
SELECT * FROM referrals WHERE referred_id = '<new-user-id>';
```

**Expected:**
- status = "pending"
- initial_payment_status = null

### Test 2: Process $500 Payment

1. Process initial payment for the user
2. Check server logs

**Expected:**
```
✅ Referral updated to 'active' status
✅ Referrer's direct_referrals_count updated via trigger
   Referrer: John Smith (...)
   New direct_referrals_count: 3
```

3. Query database:

```sql
-- Check referral
SELECT status, initial_payment_status
FROM referrals
WHERE referred_id = '<user-id>';

-- Check referrer's count
SELECT name, direct_referrals_count
FROM users
WHERE id = '<referrer-id>';
```

**Expected:**
- Referral status = "active"
- Referrer's count increased by 1

### Test 3: Multiple Referrals Same Referrer

1. Create 3 users with same referral code
2. Have all 3 pay $500
3. Check referrer's count

**Expected:**
```sql
SELECT name, direct_referrals_count
FROM users
WHERE id = '<referrer-id>';

-- Should show: direct_referrals_count = 3
```

---

## Troubleshooting

### Problem: "column u.direct_referrals_count does not exist"

**Cause:** Schema not deployed

**Fix:**
1. Run `check-referral-schema.sql`
2. Deploy `supabase-activation-schema.sql`
3. Re-run check

### Problem: Webhook shows "Could not fetch direct_referrals_count"

**Cause:** Schema not deployed (this is expected)

**Fix:**
1. Deploy `supabase-activation-schema.sql`
2. Warning will disappear
3. Next payment will show correct log

### Problem: Count is 0 but user has active referrals

**Cause:** Trigger wasn't there when referrals became active

**Fix:**
1. Run `fix-referral-counts.sql`
2. Counts will be synced

### Problem: Trigger not firing

**Cause:** Trigger not deployed or function missing

**Fix:**
1. Run `check-referral-schema.sql`
2. Verify trigger exists
3. If missing, redeploy `supabase-activation-schema.sql`

---

## How the Trigger Works

### Trigger Definition

```sql
CREATE TRIGGER trigger_update_direct_referrals
AFTER INSERT OR UPDATE ON public.referrals
FOR EACH ROW
EXECUTE FUNCTION update_direct_referrals_count();
```

**Fires when:**
- New referral is inserted
- Existing referral is updated

### Trigger Function Logic

```sql
CREATE FUNCTION update_direct_referrals_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND OLD.status != 'active') THEN
        -- Count active referrals for the referrer
        UPDATE users
        SET direct_referrals_count = (
            SELECT COUNT(*)
            FROM referrals
            WHERE referrer_id = NEW.referrer_id
            AND status = 'active'
        )
        WHERE id = NEW.referrer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**What it does:**
1. Checks if referral status changed to "active"
2. Counts all active referrals for the referrer
3. Updates referrer's `direct_referrals_count`

---

## Qualification System (Bonus)

The activation schema also adds qualification tracking:

### Columns Added:
- `activated_at` - When user paid $500
- `qualification_deadline` - No longer used (removed in latest version)
- `qualified_at` - When user qualified (3+ direct referrals)
- `accumulated_residual` - Residual income held until qualified

### How It Works:

**Before qualified (< 3 direct referrals):**
- User receives initial $250 per referral
- Monthly residuals accumulate but not paid

**After qualified (≥ 3 direct referrals):**
- `qualified_at` timestamp set
- Accumulated residuals released
- All future residuals paid immediately

**Check qualification:**
```sql
SELECT
    name,
    direct_referrals_count,
    qualified_at,
    accumulated_residual,
    CASE
        WHEN qualified_at IS NOT NULL THEN 'Qualified'
        WHEN direct_referrals_count >= 3 THEN 'Should be qualified (run fix)'
        ELSE 'Not qualified yet'
    END as status
FROM users
WHERE direct_referrals_count > 0
ORDER BY direct_referrals_count DESC;
```

---

## Next Steps

1. ✅ **Deploy schema** (supabase-activation-schema.sql)
2. ✅ **Fix existing counts** (fix-referral-counts.sql)
3. ✅ **Verify deployment** (verify-direct-referrals.sql)
4. ✅ **Test with new user** (create referral + pay $500)
5. ✅ **Monitor logs** (check for count update messages)

---

## Summary

**Before deployment:**
- Referrals created ✓
- Referrals activated ✓
- Counts tracked ✗

**After deployment:**
- Referrals created ✓
- Referrals activated ✓
- Counts tracked ✓
- Trigger fires automatically ✓
- Server logs show updates ✓
- Qualification tracking ✓

**Time to deploy:** ~5 minutes
**Risk level:** Low (only adds columns, doesn't modify existing data)
**Rollback:** Not needed (no destructive changes)
