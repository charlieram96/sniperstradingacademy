## Referral System - Deployment Checklist

### Quick Fix (10 minutes)

Run these SQL scripts in order in Supabase SQL Editor:

---

### ✅ Step 1: Clean Up Duplicates

```bash
supabase-cleanup-referral-schema.sql
```

**What it does:**
- ❌ Removes `account_active` (duplicate of `is_active`)
- ❌ Removes `accumulated_residual` (not needed)
- ✅ Adds `active_direct_referrals_count` column
- ✅ Updates `check_qualification_status()` to use active count

**Expected output:**
```
✓ account_active column removed
✓ accumulated_residual column removed
✓ Added active_direct_referrals_count column
✓ Updated check_qualification_status()
```

---

### ✅ Step 2: Deploy Activation Schema (if not already deployed)

```bash
supabase-activation-schema.sql
```

**What it does:**
- ✅ Adds `direct_referrals_count` column
- ✅ Creates `update_direct_referrals_count()` function
- ✅ Creates trigger on `referrals` table

**Expected output:**
```
ALTER TABLE
CREATE FUNCTION
CREATE TRIGGER
```

**Skip if:** You already have `direct_referrals_count` column

---

### ✅ Step 3: Deploy Active Referrals Trigger

```bash
supabase-active-referrals-trigger.sql
```

**What it does:**
- ✅ Creates `update_active_direct_referrals_count()` function
- ✅ Creates trigger on `users` table (fires when `is_active` changes)
- ✅ Auto-qualifies users with 3+ active referrals

**Expected output:**
```
CREATE FUNCTION
CREATE TRIGGER
✓✓✓ ACTIVE REFERRALS TRIGGER DEPLOYED ✓✓✓
```

---

### ✅ Step 4: Migrate Existing Data

```bash
migrate-referral-counts.sql
```

**What it does:**
- Calculates `direct_referrals_count` from referrals table
- Calculates `active_direct_referrals_count` from users table
- Updates all users with correct counts
- Sets `qualified_at` for users with 3+ active referrals

**Expected output:**
```
BEFORE MIGRATION: (shows current state)
APPLYING MIGRATION...
AFTER MIGRATION: (shows updated state)
✓✓✓ SUCCESS - All counts are correct!
```

---

### ✅ Step 5: Verify Deployment

```bash
check-referral-schema.sql
```

**Expected output:**
```
✓ direct_referrals_count column exists
✓ active_direct_referrals_count column exists
✓ trigger_update_direct_referrals exists
✓ trigger_update_active_direct_referrals exists
✓✓✓ ALL CHECKS PASSED ✓✓✓
```

---

## What You'll Have After Deployment

### Two Referral Counts:

1. **`direct_referrals_count`**
   - Counts users who paid $500 (referral status = "active")
   - Never decreases
   - Used for initial $250 per referral payment

2. **`active_direct_referrals_count`**
   - Counts users currently active (is_active = TRUE)
   - Increases/decreases as users activate/deactivate
   - **Used for qualification** (need 3 active)

### Automatic Triggers:

- **When user pays $500:**
  - Referral status → "active"
  - `direct_referrals_count` +1
  - `is_active` → TRUE
  - `active_direct_referrals_count` +1

- **When user stops paying:**
  - `is_active` → FALSE
  - `active_direct_referrals_count` -1
  - `direct_referrals_count` unchanged

- **When user hits 3 active referrals:**
  - `qualified_at` timestamp set
  - Can receive structure bonuses

---

## Testing After Deployment

### Test 1: Create Referral

1. Sign up user with referral code
2. Process $500 payment
3. Check server logs:

```
✅ Referral updated to 'active' status
✅ Referrer's direct_referrals_count updated via trigger
   New direct_referrals_count: 1
User abc... became ACTIVE - referrer xyz... active count: 1
```

4. Query database:

```sql
SELECT
    name,
    direct_referrals_count,
    active_direct_referrals_count
FROM users
WHERE id = '<referrer-id>';

-- Should show both = 1
```

### Test 2: Deactivate User

1. Set user's `is_active` = FALSE (or let subscription expire)
2. Check logs:

```
User abc... became INACTIVE - referrer xyz... active count: 0
```

3. Query database:

```sql
SELECT
    name,
    direct_referrals_count,     -- Should be 1 (unchanged)
    active_direct_referrals_count -- Should be 0
FROM users
WHERE id = '<referrer-id>';
```

### Test 3: Qualification

1. Create 3 users, all pay $500
2. Query referrer:

```sql
SELECT
    name,
    active_direct_referrals_count, -- Should be 3
    qualified_at                    -- Should have timestamp
FROM users
WHERE id = '<referrer-id>';
```

---

## Troubleshooting

### ❌ Error: "direct_referrals_count column does not exist"

**Fix:** Run `supabase-activation-schema.sql` first

### ❌ Error: "active_direct_referrals_count column does not exist"

**Fix:** Run `supabase-cleanup-referral-schema.sql` first

### ❌ Counts don't match reality

**Fix:** Run `migrate-referral-counts.sql` to recalculate

### ❌ Trigger not firing

**Fix:**
1. Check trigger exists: `check-referral-schema.sql`
2. Redeploy: `supabase-active-referrals-trigger.sql`

---

## Files Reference

| File | Purpose |
|------|---------|
| `supabase-cleanup-referral-schema.sql` | Remove duplicates, add active count |
| `supabase-activation-schema.sql` | Add direct_referrals_count + trigger |
| `supabase-active-referrals-trigger.sql` | Add active count trigger |
| `migrate-referral-counts.sql` | Backfill both counts |
| `check-referral-schema.sql` | Verify deployment |
| `REFERRAL-COUNTS-EXPLAINED.md` | Full documentation |

---

## Time Estimate

- Step 1: 1 min
- Step 2: 1 min (or skip)
- Step 3: 1 min
- Step 4: 2 min
- Step 5: 1 min

**Total: ~5-10 minutes**

---

## Summary

**Before:**
- ❌ Duplicate columns (`is_active` and `account_active`)
- ❌ Unnecessary column (`accumulated_residual`)
- ❌ Only tracking paid referrals
- ❌ Qualification using wrong count

**After:**
- ✅ Single active column (`is_active`)
- ✅ Two referral counts (paid vs active)
- ✅ Automatic tracking via triggers
- ✅ Qualification requires 3 ACTIVE referrals
- ✅ Full server logging
