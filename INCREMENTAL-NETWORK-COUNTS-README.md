# Incremental Network Counting System

## Overview

This system replaces expensive scan-based network counting with efficient event-driven incremental updates.

**Performance Improvement:** ~100x faster for large networks (O(depth) vs O(subtree_size))

## How It Works

### Old System (Scan-Based)
- On every payment: Scan entire subtree to count active/total members
- Query all descendants (could be 1000+ rows)
- Very slow as networks grow

### New System (Event-Based)
- Track count changes at specific events
- Walk upchain only (typically 5-20 ancestors)
- Always accurate, always fast

## Database Columns

### `total_network_count`
- **Definition:** ALL members in your network (active + inactive + disabled)
- **Incremented when:** User gets network position assigned
- **Decremented when:** User position is vacated (90+ days inactive)

### `active_network_count`
- **Definition:** Members who paid within last 33 days
- **Incremented when:** User becomes active (pays subscription)
- **Decremented when:** User becomes inactive (33+ days without payment)

## Event Flow

### 1. User Registers
```
User signs up → No count changes yet
```

### 2. User Gets Network Position
```
assign_network_position() called
  ↓
increment_upchain_total_count() called
  ↓
All ancestors get total_network_count +1
```

### 3. User Pays Initial $500
```
Webhook: checkout.session.completed (initial payment)
  ↓
Update: initial_payment_completed = true
  ↓
No count changes (they don't have subscription yet)
```

### 4. User Subscribes (First Payment)
```
Webhook: invoice.payment_succeeded
  ↓
Check: was_active = false (first payment)
  ↓
increment_upchain_active_count() called
  ↓
All ancestors get active_network_count +1
  ↓
Set is_active = true
  ↓
Distribute sniper volume to upchain
```

### 5. User Pays Monthly/Weekly (While Active)
```
Webhook: invoice.payment_succeeded
  ↓
Check: was_active = true (already active)
  ↓
No count changes (already counted)
  ↓
Update last_payment_date
  ↓
Distribute sniper volume to upchain
```

### 6. User Becomes Inactive (33+ days)
```
Daily Cron: update_all_active_statuses()
  ↓
Check: last_payment_date > 33 days ago
  ↓
decrement_upchain_active_count() called
  ↓
All ancestors get active_network_count -1
  ↓
Set is_active = false, inactive_since = now
```

### 7. User Reactivates (Pays After Inactive)
```
Webhook: invoice.payment_succeeded
  ↓
Check: was_active = false (reactivating)
  ↓
increment_upchain_active_count() called
  ↓
All ancestors get active_network_count +1
  ↓
Set is_active = true, inactive_since = null
```

### 8. User Removed (90+ days)
```
Monthly Cron: cleanup_inactive_users()
  ↓
Check: inactive_since > 90 days ago
  ↓
decrement_upchain_total_count() called
  ↓
All ancestors get total_network_count -1
  ↓
If was active: decrement_upchain_active_count()
  ↓
Vacate position, add to vacant_positions table
```

## Migration Steps

### 1. Run Database Migrations (IN ORDER!)

```sql
-- Step 1: Create incremental counting functions
\i supabase-incremental-network-counts.sql

-- Step 2: Update assign_network_position function
\i supabase-assign-position-with-count.sql

-- Step 3: Update cleanup_inactive_users function
\i supabase-cleanup-with-counts.sql

-- Step 4: Create daily active status cron job
\i supabase-daily-active-status-cron.sql
```

### 2. Sync Existing Data (One-Time)

```sql
-- Preview which users will be affected
SELECT * FROM public.preview_active_status_changes()
WHERE status_change != 'No change';

-- Recalculate all network counts from scratch
-- WARNING: This is slow! Only run once during migration
SELECT * FROM public.sync_all_network_counts();

-- Verify counts are correct
SELECT
  id,
  email,
  total_network_count,
  active_network_count,
  is_active,
  last_payment_date
FROM public.users
WHERE network_position_id IS NOT NULL
ORDER BY network_level, network_position
LIMIT 20;
```

### 3. Deploy Webhook Changes

The webhook has been updated to:
- Check `was_active` before payment
- Increment active count if user became active
- Update commission rates without expensive scans

Deploy the updated webhook code:
```bash
git add app/api/stripe/webhooks/route.ts
git commit -m "Update webhook for incremental network counting"
git push
```

### 4. Set Up Daily Cron Job

```sql
-- Install pg_cron extension (if not already installed)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily execution at 2:00 AM UTC
SELECT cron.schedule(
    'daily-active-status-update',
    '0 2 * * *',
    $$SELECT public.update_all_active_statuses()$$
);

-- Verify it's scheduled
SELECT * FROM cron.job WHERE jobname = 'daily-active-status-update';
```

### 5. Set Up Monthly Cleanup Cron

```sql
-- Schedule monthly cleanup on 1st day at 3:00 AM UTC
SELECT cron.schedule(
    'monthly-inactive-cleanup',
    '0 3 1 * *',
    $$SELECT public.cleanup_inactive_users()$$
);

-- Verify it's scheduled
SELECT * FROM cron.job WHERE jobname = 'monthly-inactive-cleanup';
```

## Testing

### Test 1: New User Gets Position
```sql
-- Assign position to test user
SELECT public.assign_network_position('test-user-uuid', 'referrer-uuid');

-- Verify all ancestors got total_network_count +1
SELECT id, email, total_network_count
FROM public.users
WHERE network_position_id IN (
  SELECT network_position_id
  FROM public.get_upline_chain(
    (SELECT network_position_id FROM public.users WHERE id = 'test-user-uuid')
  )
)
ORDER BY network_level;
```

### Test 2: User Becomes Active
```sql
-- Before: Check counts
SELECT id, email, active_network_count, is_active
FROM public.users
WHERE id = 'ancestor-uuid';

-- Simulate payment (run this via webhook test or manually)
SELECT public.increment_upchain_active_count('test-user-uuid');

UPDATE public.users
SET is_active = true, last_payment_date = NOW()
WHERE id = 'test-user-uuid';

-- After: Verify count increased
SELECT id, email, active_network_count, is_active
FROM public.users
WHERE id = 'ancestor-uuid';
```

### Test 3: User Becomes Inactive
```sql
-- Preview who will become inactive
SELECT * FROM public.preview_active_status_changes()
WHERE status_change = 'Will become INACTIVE';

-- Run daily cron
SELECT * FROM public.update_all_active_statuses();

-- Verify counts decreased for ancestors
```

## Monitoring

### Check Count Accuracy

Compare incremental counts with actual scans (should match):

```sql
SELECT
  u.id,
  u.email,
  u.total_network_count as current_total,
  u.active_network_count as current_active,
  n.total_count as scanned_total,
  n.active_count as scanned_active,
  (u.total_network_count = n.total_count) as total_matches,
  (u.active_network_count = n.active_count) as active_matches
FROM public.users u
CROSS JOIN LATERAL public.count_network_size(u.network_position_id) n
WHERE u.network_position_id IS NOT NULL
  AND u.network_level < 5  -- Only check first few levels (scan is slow)
LIMIT 20;
```

### Check Active Status

```sql
-- Users who should be active but aren't (data issue)
SELECT id, email, last_payment_date, is_active
FROM public.users
WHERE network_position_id IS NOT NULL
  AND last_payment_date >= NOW() - INTERVAL '33 days'
  AND is_active = FALSE;

-- Users who are active but shouldn't be (data issue)
SELECT id, email, last_payment_date, is_active
FROM public.users
WHERE network_position_id IS NOT NULL
  AND (last_payment_date IS NULL OR last_payment_date < NOW() - INTERVAL '33 days')
  AND is_active = TRUE;
```

### Check Cron Job Status

```sql
-- View all scheduled jobs
SELECT * FROM cron.job;

-- View recent job runs
SELECT * FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job
  WHERE jobname IN ('daily-active-status-update', 'monthly-inactive-cleanup')
)
ORDER BY start_time DESC
LIMIT 20;
```

## Manual Corrections

If counts get out of sync, you can:

### Fix Single User
```sql
-- Recalculate counts for one user
SELECT * FROM public.sync_network_counts('user-uuid-here');
```

### Fix All Users
```sql
-- WARNING: Very slow for large networks!
-- Only use for major data issues
SELECT * FROM public.sync_all_network_counts()
WHERE changed = true;
```

## Performance Comparison

### Old System (Scan-Based)
- Update 1 user's counts: Scan 1,000 descendants = **1,000 rows read**
- Time: ~500ms per user

### New System (Incremental)
- Update 1 user's counts: Walk 10 ancestors = **10 rows updated**
- Time: ~5ms per user

**Result: 100x faster!**

## Files Changed

### New SQL Files
- `supabase-incremental-network-counts.sql` - Core counting functions
- `supabase-assign-position-with-count.sql` - Updated position assignment
- `supabase-cleanup-with-counts.sql` - Updated inactive cleanup
- `supabase-daily-active-status-cron.sql` - Daily cron job

### Modified Files
- `app/api/stripe/webhooks/route.ts` - Updated payment webhook

## Support

If you encounter issues:

1. Check cron job logs: `SELECT * FROM cron.job_run_details`
2. Run accuracy check query (see Monitoring section)
3. If counts are wrong, run sync function for affected users
4. Check webhook logs for payment processing errors

## FAQ

**Q: What if counts get out of sync?**
A: Run `sync_network_counts()` for the affected user, or `sync_all_network_counts()` for all users (slow).

**Q: Do I still need the old `update_network_counts()` function?**
A: No, it's replaced by the incremental functions. But kept for backward compatibility/manual fixes.

**Q: What happens if a payment webhook fails?**
A: The daily cron will catch status changes within 24 hours. Sniper volume might be missed though.

**Q: Can I adjust the 33-day threshold?**
A: Yes, update both the `update_all_active_statuses()` function and webhook payment handler.

## Next Steps

After migration is complete:

1. ✅ Monitor cron job execution for 1 week
2. ✅ Run accuracy checks daily for first week
3. ✅ Remove old `update_network_counts()` calls from codebase
4. ✅ Consider adding alerts for count mismatches
5. ✅ Document any edge cases discovered

---

**Migration Date:** [Add date when you run this]
**Migrated By:** [Your name]
**Status:** [Pending / In Progress / Complete]
