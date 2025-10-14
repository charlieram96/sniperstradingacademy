# Fix "Function Not Unique" Error - Deployment Guide

## The Problem

When creating new accounts, you're getting this error:

```
Error assigning network position: {
  code: '42725',
  message: 'function public.find_available_slot(text, integer) is not unique'
}
```

**Root Cause:** Multiple versions of `find_available_slot` exist in your database:
- Version 1: `find_available_slot(TEXT, INTEGER)` - Unlimited depth (4 columns)
- Version 2: `find_available_slot(TEXT, INTEGER, INTEGER)` - Round-robin (5 columns)

When `assign_network_position` calls with 2 parameters, PostgreSQL can't decide which to use.

## The Solution

We'll clean up duplicate functions and deploy only the **unlimited depth version** (simpler, no round-robin).

---

## Step-by-Step Fix

### STEP 1: Verify the Problem

Run this in Supabase SQL Editor to see all versions:

```sql
SELECT
    proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname LIKE '%find_available_slot%'
ORDER BY proname;
```

**Expected Result:** You'll see multiple functions with similar names.

---

### STEP 2: Clean Up Duplicates

**Run this SQL file in Supabase SQL Editor:**

```
cleanup-duplicate-functions.sql
```

This will:
- Drop ALL versions of `find_available_slot`
- Drop related functions (optimized, branch-specific, etc.)
- Show verification that cleanup was successful

**Verify:** Run the query from STEP 1 again. Should return 0 rows.

---

### STEP 3: Deploy Core Functions (If Not Already Deployed)

Make sure these foundational functions exist. If you're unsure, run them again (they use `CREATE OR REPLACE` so it's safe):

#### 3.1 Base Schema Functions

**File:** `supabase-network-position-schema.sql`

Creates:
- `format_network_position_id()`
- `calculate_child_positions()`
- `get_parent_position()`
- `is_position_occupied()`
- Basic `get_upline_chain()` (6-level limit)

**Run in Supabase SQL Editor**

#### 3.2 Unlimited Upline Chain

**File:** `supabase-upline-chain-unlimited.sql`

Replaces the 6-level limit version with unlimited upline chain.

**Run in Supabase SQL Editor**

#### 3.3 Incremental Network Counts

**File:** `supabase-incremental-network-counts.sql`

Creates:
- `increment_upchain_total_count()`
- `increment_upchain_active_count()`
- `decrement_upchain_total_count()`
- `decrement_upchain_active_count()`

**Run in Supabase SQL Editor**

---

### STEP 4: Deploy the Correct find_available_slot

**File:** `supabase-find-slot-unlimited.sql`

This creates the **unlimited depth** version:
- Signature: `find_available_slot(TEXT, INTEGER)`
- Returns: 4 columns (available_level, available_position, parent_position_id, relative_level)
- Max depth: 100 levels (effectively unlimited)

**Run in Supabase SQL Editor**

**Verify:**
```sql
SELECT * FROM public.find_available_slot('L000P0000000001', 100);
```

Should return available slot info, not an error.

---

### STEP 5: Deploy Updated assign_network_position

**File:** `supabase-assign-position-unlimited.sql`

This updates `assign_network_position` to:
- Use `max_depth=100` instead of `max_depth=6`
- Work with the unlimited version of `find_available_slot`
- Auto-increment network counts

**Run in Supabase SQL Editor**

---

### STEP 6: Deploy Tree Children Function (If Missing)

If you're still getting the `get_tree_children` error:

**File:** `supabase-tree-children-function.sql`

**Run in Supabase SQL Editor**

---

### STEP 7: Test Position Assignment

Try creating a new test user:

```sql
-- Create a test user first (you'll need to do this via your app or manually)
-- Then assign them a position:

SELECT public.assign_network_position('<new-user-id>', '<referrer-id>');
```

**Expected Result:**
```
L001P0000000004  -- Or similar position ID
```

**Should NOT see:**
```
ERROR: function public.find_available_slot(text, integer) is not unique
```

---

### STEP 8: Fix Orphaned Users

If you already have users without `network_position_id`:

**File:** `quick-fix-orphaned-users.sql`

This will automatically:
1. Find all users without positions
2. Assign them positions based on their referrer
3. Increment network counts for ancestors

**Run in Supabase SQL Editor**

---

## Verification Checklist

After deployment, verify:

### ✅ Functions Exist
```sql
SELECT
    proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname IN (
    'find_available_slot',
    'assign_network_position',
    'get_tree_children',
    'increment_upchain_total_count',
    'increment_upchain_active_count'
)
ORDER BY proname;
```

Should show:
- ✅ `find_available_slot(text, integer)` - ONLY ONE VERSION
- ✅ `assign_network_position(uuid, uuid)`
- ✅ `get_tree_children(uuid)`
- ✅ `increment_upchain_total_count(uuid)`
- ✅ `increment_upchain_active_count(uuid)`

### ✅ No Orphaned Users
```sql
SELECT COUNT(*) as orphaned_users
FROM users
WHERE network_position_id IS NULL;
```

Should return `0` (or run quick-fix-orphaned-users.sql to fix)

### ✅ Position Assignment Works
Create a test account via your app's signup flow and verify:
```sql
SELECT
    id,
    name,
    email,
    network_position_id,
    network_level,
    referred_by
FROM users
ORDER BY created_at DESC
LIMIT 5;
```

All recent users should have `network_position_id` populated.

---

## Correct Deployment Order Summary

1. ✅ `cleanup-duplicate-functions.sql` - **START HERE**
2. ✅ `supabase-network-position-schema.sql` - Base functions
3. ✅ `supabase-upline-chain-unlimited.sql` - Unlimited upline
4. ✅ `supabase-incremental-network-counts.sql` - Count functions
5. ✅ `supabase-find-slot-unlimited.sql` - Correct find_available_slot
6. ✅ `supabase-assign-position-unlimited.sql` - Updated assign function
7. ✅ `supabase-tree-children-function.sql` - Tree children (if needed)
8. ✅ `quick-fix-orphaned-users.sql` - Fix existing orphaned users

---

## Files NOT to Run

❌ **supabase-round-robin-find-slot.sql** - This creates the 3-parameter version that conflicts
❌ **supabase-round-robin-assign-position.sql** - Round-robin version (advanced feature)
❌ **supabase-assign-position-with-count.sql** - Old version with max_depth=6

These can be deployed later if you need round-robin distribution.

---

## What We Changed

### Before (Broken)
```sql
-- Multiple versions exist:
find_available_slot(TEXT, INTEGER)           -- Version 1
find_available_slot(TEXT, INTEGER, INTEGER)  -- Version 2

-- assign_network_position calls:
FROM public.find_available_slot(referrer_pos_id, 6)
-- PostgreSQL: "Which one?!" 🤷 ERROR
```

### After (Fixed)
```sql
-- Only ONE version:
find_available_slot(TEXT, INTEGER)  -- Returns 4 columns

-- assign_network_position calls:
FROM public.find_available_slot(referrer_pos_id, 100)
-- PostgreSQL: "Got it!" ✅ SUCCESS
```

---

## Troubleshooting

### Error: "function still exists"
Run cleanup script again, it will cascade delete dependencies.

### Error: "function does not exist"
You need to deploy the base functions first (STEP 3).

### Error: "relation does not exist"
Check that your `users` table has the required columns:
```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS network_position_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS network_level INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS network_position BIGINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tree_parent_network_position_id TEXT;
```

### Position assignment succeeds but counts don't increment
Make sure you deployed `supabase-incremental-network-counts.sql` and `supabase-upline-chain-unlimited.sql`.

---

## Testing After Deployment

1. **Create a test user via signup flow**
2. **Check they got a position:**
   ```sql
   SELECT network_position_id FROM users WHERE email = 'test@example.com';
   ```
3. **Check ancestor counts incremented:**
   ```sql
   SELECT name, network_position_id, total_network_count
   FROM users
   WHERE network_position_id IS NOT NULL
   ORDER BY network_level;
   ```

---

## Success Criteria

✅ New users get `network_position_id` automatically
✅ No "function not unique" errors
✅ No orphaned users (`network_position_id IS NULL`)
✅ Network counts increment correctly
✅ `get_tree_children` API works
✅ OAuth signup flow works (from previous fix)

---

## Need Help?

If issues persist after following this guide:
1. Check server logs for specific errors
2. Run verification queries to see what's missing
3. Verify you ran scripts in the correct order
4. Check that functions return the expected column count

The most common mistake is running scripts out of order or running the round-robin version by accident.
