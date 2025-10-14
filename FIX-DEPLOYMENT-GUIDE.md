# FIX DEPLOYMENT GUIDE

## Issues Identified

1. **Missing database function `get_tree_children`** - Causing API errors in tree-children route
2. **2 accounts without network position IDs** - Position assignment failed during signup
3. **Network counts not incrementing** - Because position assignment is failing

## Root Cause

The database functions haven't been deployed to your Supabase database. The SQL files exist in your codebase but need to be executed in the correct order.

## Solution: Deploy Database Functions

### STEP 1: Verify Current State

Run this SQL in your Supabase SQL Editor:

```sql
-- Execute the verification script
\i verify-database-functions.sql
```

Or copy the contents of `verify-database-functions.sql` and run it in the Supabase SQL Editor.

This will show you which functions are missing and which users don't have network positions.

### STEP 2: Deploy Functions in Correct Order

**IMPORTANT:** These must be run in order because they depend on each other.

#### 2.1 Base Schema and Helper Functions (if not already deployed)

```bash
# File: supabase-network-position-schema.sql
```

This creates:
- `format_network_position_id()` - Formats position IDs
- `calculate_child_positions()` - Calculates child positions
- `get_parent_position()` - Gets parent position
- `find_available_slot()` - Finds available slot in tree
- `get_upline_chain()` - Gets upline chain (6-level limit version)

**Run this in Supabase SQL Editor:**
Copy the entire contents of `supabase-network-position-schema.sql` and execute it.

#### 2.2 Unlimited Upline Chain (CRITICAL FIX)

```bash
# File: supabase-upline-chain-unlimited.sql
```

This replaces the 6-level limit version with unlimited version that goes all the way to root.

**Run this in Supabase SQL Editor:**
Copy the entire contents of `supabase-upline-chain-unlimited.sql` and execute it.

#### 2.3 Incremental Network Count Functions

```bash
# File: supabase-incremental-network-counts.sql
```

This creates:
- `increment_upchain_total_count()` - Increments total count for ancestors
- `decrement_upchain_total_count()` - Decrements total count for ancestors
- `increment_upchain_active_count()` - Increments active count for ancestors
- `decrement_upchain_active_count()` - Decrements active count for ancestors

**Run this in Supabase SQL Editor:**
Copy the entire contents of `supabase-incremental-network-counts.sql` and execute it.

#### 2.4 Position Assignment with Auto Count Increment

```bash
# File: supabase-assign-position-with-count.sql
```

This creates/updates:
- `assign_network_position()` - Assigns position AND automatically increments ancestor counts

**Run this in Supabase SQL Editor:**
Copy the entire contents of `supabase-assign-position-with-count.sql` and execute it.

#### 2.5 Tree Children Function

```bash
# File: supabase-tree-children-function.sql
```

This creates:
- `get_tree_children()` - Gets the 3 direct children of a user in the tree
- `is_tree_full()` - Checks if user's tree is full

**Run this in Supabase SQL Editor:**
Copy the entire contents of `supabase-tree-children-function.sql` and execute it.

### STEP 3: Verify Functions Were Deployed

Run the verification script again:

```sql
\i verify-database-functions.sql
```

All functions should now show "✓ EXISTS"

### STEP 4: Fix Orphaned Users

Now that the functions exist, assign positions to the 2 users who don't have them.

1. First, identify the orphaned users:

```sql
SELECT
    id,
    name,
    email,
    created_at,
    referred_by
FROM users
WHERE network_position_id IS NULL
ORDER BY created_at ASC;
```

2. For each orphaned user, assign their position:

```sql
-- Replace <user-id> with actual user ID
-- Replace <referrer-id> with their referrer ID (from referred_by column)

SELECT public.assign_network_position('<user-id>', '<referrer-id>');
```

Example:
```sql
SELECT public.assign_network_position('123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001');
```

3. Verify the fix:

```sql
-- Should return 0
SELECT COUNT(*) as users_without_position
FROM users
WHERE network_position_id IS NULL;
```

### STEP 5: Verify Network Counts

After fixing orphaned users, verify that network counts are correct:

```sql
SELECT
    u.name,
    u.network_position_id,
    u.total_network_count,
    u.active_network_count,
    (
        SELECT COUNT(*)
        FROM users u2
        WHERE u2.tree_parent_network_position_id = u.network_position_id
    ) as direct_children_count
FROM users u
WHERE u.network_position_id IS NOT NULL
ORDER BY u.network_level, u.network_position;
```

### STEP 6: Test the Fix

1. Test the tree-children API endpoint:

```bash
# Replace with actual user ID
curl http://localhost:3000/api/network/tree-children?userId=<user-id>
```

The error should be gone!

2. Create a test user and verify position assignment works:

```bash
# Sign up a new user through your app
# Check that they get a network_position_id immediately
```

## Files Created for This Fix

1. `verify-database-functions.sql` - Verify what's deployed and find orphaned users
2. `fix-orphaned-users.sql` - Step-by-step guide to fix users without positions
3. `FIX-DEPLOYMENT-GUIDE.md` - This comprehensive guide

## Prevention

To prevent this in the future:

1. **Document database migrations** - Keep a list of which SQL files have been run
2. **Add health checks** - Monitor for users without network positions
3. **Test in staging first** - Always deploy to staging environment first
4. **Add alerts** - Alert when position assignment fails

## Troubleshooting

### Error: "function already exists"
This is fine - it means the function was already deployed. The `CREATE OR REPLACE` will update it.

### Error: "function X does not exist"
You missed a dependency. Make sure you run the SQL files in the correct order (see STEP 2).

### Network counts are still wrong after fixing
Run a full sync to recalculate from scratch:

```sql
-- This scans the entire tree and fixes all counts
-- WARNING: This is slow for large networks!
SELECT * FROM public.sync_all_network_counts();
```

### Position assignment still failing
Check the server logs for the actual error. Common issues:
- Referrer doesn't have a position yet
- User creation window expired (10 minutes in production, 60 in dev)
- Database connection issues

## Summary

The core issue was that database functions weren't deployed. Once deployed:
- ✅ `get_tree_children` API will work
- ✅ New users will get positions automatically
- ✅ Network counts will increment automatically
- ✅ Orphaned users can be fixed manually
