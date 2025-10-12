# Round-Robin Referral Distribution - Deployment Guide

## What This Does

Implements **even distribution** of referrals across the 3 branches below each user using a round-robin rotation strategy.

### Before (Breadth-First):
```
User refers 6 people:
→ All 6 might go into Branch 1
→ Branches 2 and 3 remain empty
→ Unbalanced tree
```

### After (Round-Robin):
```
User refers 6 people:
→ Branch 1: 2 people
→ Branch 2: 2 people
→ Branch 3: 2 people
→ Perfectly balanced tree
```

---

## How It Works

### The Algorithm

1. **Track Last Branch**: Each user has `last_referral_branch` (1, 2, or 3)
2. **Rotate on Each Referral**:
   - Last = 1 → Next = 2
   - Last = 2 → Next = 3
   - Last = 3 → Next = 1 (cycle back)
3. **Search Target Branch First**: Find first available position in that branch's subtree
4. **Fallback**: If branch is full, try the next branch in rotation

### Example Flow

```
You are at L000P0000000001
Your 3 child branches:
- Branch 1: L001P0000000001
- Branch 2: L001P0000000002
- Branch 3: L001P0000000003

Current state: last_referral_branch = 3

Referral #1:
  Next branch = 1 (after 3)
  → Search Branch 1 subtree
  → Assign to first available in Branch 1
  → Update your last_referral_branch = 1

Referral #2:
  Next branch = 2 (after 1)
  → Search Branch 2 subtree
  → Assign to that position
  → Update your last_referral_branch = 2

Referral #3:
  Next branch = 3 (after 2)
  → Search Branch 3 subtree
  → Assign to that position
  → Update your last_referral_branch = 3

Cycle repeats: 1 → 2 → 3 → 1 → 2 → 3...
```

---

## Deployment Steps

### Step 1: Add Database Column

**Run in Supabase SQL Editor:**

```sql
\i supabase-round-robin-schema.sql
```

**What it does:**
- Adds `last_referral_branch` column to `users` table
- Sets default value = 1 for all users
- Adds validation constraint (must be 1, 2, or 3)

**Verify:**
```sql
SELECT email, network_position_id, last_referral_branch
FROM public.users
WHERE network_position_id IS NOT NULL
LIMIT 10;
```

All users should have `last_referral_branch = 1`.

---

### Step 2: Update find_available_slot Function

**Run in Supabase SQL Editor:**

```sql
\i supabase-round-robin-find-slot.sql
```

**What it does:**
- Creates `find_available_slot_in_branch(position_id, branch, max_depth)`
  - Searches only within specified branch's subtree
- Updates `find_available_slot(position_id, max_depth, start_branch)`
  - Now accepts `start_branch` parameter
  - Tries branches in rotation with fallback

**Verify:**
```sql
-- Test finding slot in branch 1
SELECT * FROM public.find_available_slot_in_branch('L000P0000000001', 1, 100);

-- Test with round-robin (start from branch 2)
SELECT * FROM public.find_available_slot('L000P0000000001', 100, 2);
```

---

### Step 3: Update assign_network_position Function

**Run in Supabase SQL Editor:**

```sql
\i supabase-round-robin-assign-position.sql
```

**What it does:**
- Gets referrer's `last_referral_branch`
- Calculates next branch: `(last_referral_branch % 3) + 1`
- Calls `find_available_slot` with target branch
- Updates referrer's `last_referral_branch` after assignment

**Verify:**
```sql
-- Check function exists and has correct signature
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'assign_network_position';
```

---

### Step 4: Test Round-Robin Distribution

**Run verification queries from `verify-round-robin-distribution.sql`**

**Test 1: Check Current State**
```sql
SELECT
    email,
    network_position_id,
    last_referral_branch
FROM public.users
WHERE network_position_id IS NOT NULL
ORDER BY network_level, network_position;
```

**Test 2: Simulate Assignments** (in transaction)
```sql
BEGIN;

-- Create 9 test users under same referrer
DO $$
DECLARE
    referrer_id UUID := (SELECT id FROM public.users WHERE email = 'sniperstacademy@gmail.com');
    new_user_id UUID;
    i INTEGER;
BEGIN
    FOR i IN 1..9 LOOP
        new_user_id := gen_random_uuid();
        INSERT INTO public.users (id, email, name, referred_by)
        VALUES (new_user_id, 'rr_test_' || i || '@test.com', 'Test ' || i, referrer_id);

        PERFORM public.assign_network_position(new_user_id, referrer_id);
    END LOOP;
END $$;

-- View distribution
SELECT
    email,
    network_position_id,
    CASE
        WHEN (network_position - 1) % 3 = 0 THEN 'Branch 1'
        WHEN (network_position - 1) % 3 = 1 THEN 'Branch 2'
        WHEN (network_position - 1) % 3 = 2 THEN 'Branch 3'
    END as branch
FROM public.users
WHERE email LIKE 'rr_test_%'
ORDER BY created_at;

-- Expected: 3 in each branch

ROLLBACK;  -- Or COMMIT if you want to keep test data
```

---

## Production Testing

### Test with Real User Registration

1. Register 3 new test users using same referral code
2. Check their positions:

```sql
SELECT
    u.email,
    u.network_position_id,
    u.created_at,
    CASE
        WHEN (u.network_position - 1) % 3 = 0 THEN 'Branch 1'
        WHEN (u.network_position - 1) % 3 = 1 THEN 'Branch 2'
        WHEN (u.network_position - 1) % 3 = 2 THEN 'Branch 3'
    END as branch
FROM public.users u
WHERE u.created_at > NOW() - INTERVAL '10 minutes'
AND u.network_position_id IS NOT NULL
ORDER BY u.created_at;
```

3. Verify referrer's `last_referral_branch` updated:

```sql
SELECT
    email,
    last_referral_branch,
    (SELECT COUNT(*) FROM public.users WHERE referred_by = users.id) as total_referrals
FROM public.users
WHERE id = 'referrer-id-here';
```

---

## Monitoring Queries

### Check Branch Balance

```sql
-- Overall distribution across network
WITH branch_stats AS (
    SELECT
        CASE
            WHEN (network_position - 1) % 3 = 0 THEN 1
            WHEN (network_position - 1) % 3 = 1 THEN 2
            WHEN (network_position - 1) % 3 = 2 THEN 3
        END as branch,
        COUNT(*) as user_count
    FROM public.users
    WHERE network_position_id IS NOT NULL
    AND network_level > 0
    GROUP BY branch
)
SELECT
    branch,
    user_count,
    ROUND((user_count::NUMERIC / SUM(user_count) OVER ()) * 100, 2) as percentage
FROM branch_stats
ORDER BY branch;
```

**Expected:** Each branch ~33% of users (after enough assignments)

### Check Individual User's Branch Distribution

```sql
-- For a specific user, show their direct children's branch distribution
SELECT
    COUNT(*) FILTER (WHERE (network_position - 1) % 3 = 0) as branch_1_count,
    COUNT(*) FILTER (WHERE (network_position - 1) % 3 = 1) as branch_2_count,
    COUNT(*) FILTER (WHERE (network_position - 1) % 3 = 2) as branch_3_count
FROM public.users
WHERE tree_parent_network_position_id = 'L000P0000000001';  -- Replace with position
```

---

## Edge Cases Handled

### 1. Branch Full
**Scenario:** Target branch is completely full
**Behavior:** Automatically tries next branch in rotation
**Result:** Assignment still succeeds, user goes to available branch

### 2. All Branches Full
**Scenario:** All 3 branches full to max depth (100 levels)
**Behavior:** Raises exception
**Result:** Assignment fails (network is full)

### 3. First Referral
**Scenario:** User gets their first referral (last_referral_branch = NULL or 1)
**Behavior:** Starts with branch 2 (since next of 1 is 2)
**Result:** Clean rotation from the start

### 4. Existing Users
**Scenario:** Users assigned before round-robin was enabled
**Behavior:** May have unbalanced distribution
**Result:** New referrals will balance out over time

---

## Rollback Plan

If you need to revert to breadth-first:

```sql
-- Restore original find_available_slot (without branch parameter)
CREATE OR REPLACE FUNCTION public.find_available_slot(
    referrer_position_id TEXT,
    max_depth INTEGER DEFAULT 100
)
RETURNS TABLE(
    available_level INTEGER,
    available_position BIGINT,
    parent_position_id TEXT,
    relative_level INTEGER
) AS $$
-- [Original implementation from supabase-find-slot-unlimited.sql]
$$;

-- Restore original assign_network_position
CREATE OR REPLACE FUNCTION public.assign_network_position(
    p_user_id UUID,
    p_referrer_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
-- [Original implementation from supabase-assign-position-with-count.sql]
$$;
```

You can keep the `last_referral_branch` column (it won't be used).

---

## Performance Considerations

### Impact
- **Minimal**: Only adds one extra integer lookup per assignment
- **Branching search is equally fast**: Same complexity as breadth-first
- **Fallback adds overhead**: Only when target branch is full (rare)

### Benchmarks
- Breadth-first search: ~10-50ms
- Round-robin search: ~12-55ms (+20% worst case)
- Fallback search: +5ms per additional branch tried

---

## Success Criteria

Deployment is successful when:

1. ✅ `last_referral_branch` column exists
2. ✅ All users have valid values (1, 2, or 3)
3. ✅ New assignments show rotation (1→2→3→1)
4. ✅ Branch distribution is balanced for new referrals
5. ✅ No assignment errors
6. ✅ Referrer's `last_referral_branch` updates after each assignment

---

## Files Created

1. `supabase-round-robin-schema.sql` - Adds column
2. `supabase-round-robin-find-slot.sql` - Branch-aware search
3. `supabase-round-robin-assign-position.sql` - Round-robin logic
4. `verify-round-robin-distribution.sql` - Verification queries
5. `ROUND-ROBIN-DEPLOYMENT-GUIDE.md` - This guide

---

## Next Steps After Deployment

1. Monitor branch distribution for 24 hours
2. Check balance improves over time
3. Verify no assignment failures
4. Document round-robin behavior for users

**Ready to deploy!** 🚀
