# Network Count Logging - Server Logs

## Overview

Added detailed server logging to track when `total_network_count` and `active_network_count` are incremented for ancestors in the upchain.

---

## Scenario 1: User Signs Up (total_network_count)

### What Happens
1. User creates account with email/password or OAuth
2. User assigned network position
3. `increment_upchain_total_count()` is called
4. All ancestors in upchain get +1 to their `total_network_count`

### Expected Server Logs

```
Calling assign_network_position: {
  userId: '1553fea9-f706-4bac-a3ab-7a43367949a9',
  referrerId: '86a789ea-e356-4f06-bc2e-dc1398c553d3'
}
Position assigned successfully: L002P0000000007
Updated user data: {
  network_position_id: 'L002P0000000007',
  network_level: 2,
  network_position: 7,
  tree_parent_network_position_id: 'L001P0000000003'
}
✅ Upchain found: 3 ancestors (excluding self)
✅ Incremented total_network_count for 3 ancestors
   Affected ancestor IDs: [86a789ea-e356-4f06-bc2e-dc1398c553d3, 12345678-1234-1234-1234-123456789012, root-user-id-here]
```

### Log Breakdown

| Log Line | Meaning |
|----------|---------|
| `Calling assign_network_position` | Starting position assignment |
| `Position assigned successfully: L002P0000000007` | Position ID assigned |
| `✅ Upchain found: 3 ancestors` | Found 3 users above this new user |
| `✅ Incremented total_network_count for 3 ancestors` | All 3 got +1 to their count |
| `Affected ancestor IDs: [...]` | Shows first 3 ancestor IDs |

---

## Scenario 2: User Pays $500 (active_network_count)

### What Happens
1. User completes initial $500 payment
2. User becomes active (`is_active = TRUE`)
3. `increment_upchain_active_count()` is called
4. All ancestors in upchain get +1 to their `active_network_count`

### Expected Server Logs

```
Processing initial payment for user: 1553fea9-f706-4bac-a3ab-7a43367949a9
✅ User updated successfully with 30-day grace period: { ... }
✅ User 1553fea9-f706-4bac-a3ab-7a43367949a9 became ACTIVE after $500 payment!
✅ Incremented active_network_count for 3 ancestors in upchain
   Affected ancestor IDs: [86a789ea-e356-4f06-bc2e-dc1398c553d3, 12345678-1234-1234-1234-123456789012, root-user-id-here]
```

### Log Breakdown

| Log Line | Meaning |
|----------|---------|
| `Processing initial payment for user` | Webhook received $500 payment |
| `✅ User updated successfully with 30-day grace period` | User status updated |
| `✅ User X became ACTIVE after $500 payment!` | User now counts as active |
| `✅ Incremented active_network_count for 3 ancestors` | All 3 ancestors got +1 |
| `Affected ancestor IDs: [...]` | Shows first 3 ancestor IDs |

---

## Scenario 3: Deep Network (Many Ancestors)

### Example: User at Level 10 with 10 Ancestors

```
✅ Upchain found: 10 ancestors (excluding self)
✅ Incremented total_network_count for 10 ancestors
   Affected ancestor IDs: [user-1-id, user-2-id, user-3-id, ... +7 more]
```

Only shows first 3 IDs, then indicates how many more (`+7 more` in this case).

---

## Scenario 4: Root User (No Ancestors)

### Expected Server Logs

```
Position assigned successfully: L000P0000000001
Updated user data: {
  network_position_id: 'L000P0000000001',
  network_level: 0,
  network_position: 1,
  tree_parent_network_position_id: null
}
No upchain found (user might be root)
```

Root user has no ancestors, so no counts to increment.

---

## Files Modified

### 1. `app/api/network/assign-position/route.ts`

**Added:** Logging for `total_network_count` increment

**Location:** After line 125 (after "Updated user data")

**What it does:**
- Fetches the upchain using `get_upline_chain()`
- Counts how many ancestors were affected
- Logs first 3 ancestor IDs (or all if fewer than 3)

### 2. `app/api/stripe/webhooks/route.ts`

**Added:** Logging for `active_network_count` increment

**Location:** After line 122 (in initial payment handler)

**What it does:**
- After `increment_upchain_active_count()` succeeds
- Fetches the upchain using `get_upline_chain()`
- Logs which ancestors were affected
- Shows first 3 ancestor IDs

---

## How to Verify Counts Are Accurate

### Test 1: Create New User

1. Sign up a new user
2. Check server logs
3. Should see: `✅ Incremented total_network_count for X ancestors`
4. Query database:

```sql
-- Check the new user's referrer
SELECT
    id,
    name,
    total_network_count,
    network_position_id
FROM users
WHERE id = '<referrer-id>';
```

Expected: `total_network_count` should have increased by 1

### Test 2: User Pays $500

1. Process $500 payment for a user
2. Check server logs
3. Should see: `✅ Incremented active_network_count for X ancestors`
4. Query database:

```sql
-- Check the user's referrer
SELECT
    id,
    name,
    active_network_count,
    network_position_id
FROM users
WHERE id = '<referrer-id>';
```

Expected: `active_network_count` should have increased by 1

---

## Troubleshooting

### Log Shows 0 Ancestors

**Possible reasons:**
- User is the root user (level 0)
- Network position wasn't assigned correctly
- `get_upline_chain()` function not deployed

**Check:**
```sql
SELECT network_position_id, network_level FROM users WHERE id = '<user-id>';
```

### Log Shows Fewer Ancestors Than Expected

**Possible reasons:**
- Some positions in the tree are vacant (no user assigned)
- User is at a shallow level

**Normal behavior:** Not all positions in the tree have users, so gaps are expected

### No Upchain Logs Appearing

**Possible reasons:**
- Database function `get_upline_chain()` not deployed
- RPC call failing silently

**Check:**
```sql
SELECT * FROM pg_proc WHERE proname = 'get_upline_chain';
```

Should return 1 row. If not, deploy `supabase-upline-chain-unlimited.sql`

---

## Benefits

✅ **Visibility:** See exactly which ancestors are affected
✅ **Debugging:** Quickly identify if counts aren't updating
✅ **Confidence:** Verify the system is working correctly
✅ **Monitoring:** Track network growth in real-time

---

## Related Files

- `supabase-incremental-network-counts.sql` - Contains increment/decrement functions
- `supabase-upline-chain-unlimited.sql` - Contains `get_upline_chain()` function
- `supabase-assign-position-unlimited.sql` - Position assignment with count increment
- `verify-network-counts.sql` - Can verify counts match reality (if created)

---

## Example: Full User Signup Flow

```
1. User signs up via /register
   → Calling assign_network_position: { userId: '...', referrerId: '...' }
   → Position assigned successfully: L002P0000000007
   → ✅ Incremented total_network_count for 3 ancestors

2. User verifies email (if email signup)

3. User pays $500
   → Processing initial payment for user: ...
   → ✅ User became ACTIVE after $500 payment!
   → ✅ Incremented active_network_count for 3 ancestors

4. User starts 30-day grace period

5. User subscribes (within 30 days)
   → Subscription status: active
   → User remains active beyond grace period
```

---

## Summary

- **Signup:** Shows `total_network_count` increment for X ancestors
- **$500 Payment:** Shows `active_network_count` increment for X ancestors
- **First 3 IDs:** Logged for easy verification
- **Deep networks:** Shows count with "+N more" indicator
- **Root user:** Special message (no ancestors)
