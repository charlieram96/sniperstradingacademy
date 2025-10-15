# Direct Referral System - Server Logs

## Overview

Added detailed server logging to track when direct referral records are created and when `direct_referrals_count` is incremented for referrers.

---

## Scenario 1: User Signs Up with Referral Code

### What Happens
1. User enters referral code on `/register`
2. User creates account with email/password or OAuth
3. System creates referral record with status "pending"
4. User assigned network position

### Expected Server Logs

#### Email/Password Signup

```
Calling assign_network_position: {
  userId: '1553fea9-f706-4bac-a3ab-7a43367949a9',
  referrerId: '86a789ea-e356-4f06-bc2e-dc1398c553d3'
}
✅ Referral record created successfully
   Referrer: 86a789ea-e356-4f06-bc2e-dc1398c553d3 → Referred: 1553fea9-f706-4bac-a3ab-7a43367949a9
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

#### OAuth (Google) Signup

```
✅ Referral record created successfully
   Referrer: 86a789ea-e356-4f06-bc2e-dc1398c553d3 → Referred: 1553fea9-f706-4bac-a3ab-7a43367949a9
Calling assign_network_position: {
  userId: '1553fea9-f706-4bac-a3ab-7a43367949a9',
  referrerId: '86a789ea-e356-4f06-bc2e-dc1398c553d3'
}
Position assigned successfully: L002P0000000007
...
```

### Log Breakdown

| Log Line | Meaning |
|----------|---------|
| `✅ Referral record created successfully` | Referral record inserted into database |
| `Referrer: X → Referred: Y` | Shows who referred whom |
| `Calling assign_network_position` | Starting position assignment |
| `Position assigned successfully` | User got their network position |

### ❌ Error Case: Referral Creation Failed

```
❌ Error creating referral record: { ... }
   Failed to create referral: referrer=86a789ea-e356-4f06-bc2e-dc1398c553d3, referred=1553fea9-f706-4bac-a3ab-7a43367949a9
```

**Possible Reasons:**
- Referrals table doesn't exist
- Missing columns (referrer_id, referred_id, status)
- RLS policies blocking insert
- Duplicate referral (user already has a referral record)

---

## Scenario 2: User Pays $500 (Referral Becomes Active)

### What Happens
1. User completes initial $500 payment
2. Stripe webhook receives payment confirmation
3. Referral status updated from "pending" → "active"
4. Database trigger fires: `update_direct_referrals_count`
5. Referrer's `direct_referrals_count` incremented by +1

### Expected Server Logs

```
Processing initial payment for user: 1553fea9-f706-4bac-a3ab-7a43367949a9
✅ User updated successfully with 30-day grace period: { ... }
✅ User 1553fea9-f706-4bac-a3ab-7a43367949a9 became ACTIVE after $500 payment!
✅ Incremented active_network_count for 3 ancestors in upchain
   Affected ancestor IDs: [86a789ea-e356-4f06-bc2e-dc1398c553d3, 12345678-1234-1234-1234-123456789012, root-user-id-here]
✅ Referral updated to 'active' status
✅ Referrer's direct_referrals_count updated via trigger
   Referrer: John Smith (86a789ea-e356-4f06-bc2e-dc1398c553d3)
   New direct_referrals_count: 3
✅ Payment recorded successfully
```

### Log Breakdown

| Log Line | Meaning |
|----------|---------|
| `Processing initial payment for user` | Webhook received $500 payment |
| `User became ACTIVE after $500 payment!` | User now counts as active |
| `Referral updated to 'active' status` | Referral status changed |
| `Referrer's direct_referrals_count updated via trigger` | Database trigger fired |
| `New direct_referrals_count: 3` | Referrer now has 3 active referrals |

### ❌ Error Cases

**Referral Update Failed:**
```
❌ Error updating referral: { ... }
```

**Possible Reasons:**
- No referral record exists for this user
- Missing `initial_payment_status` column
- Missing `status` column
- RLS policies blocking update

**Missing direct_referrals_count Column:**
```
✅ Referral updated to 'active' status
(no trigger log appears)
```

**Possible Reasons:**
- `direct_referrals_count` column doesn't exist
- Trigger `update_direct_referrals_count` not deployed
- Trigger failed silently

---

## Scenario 3: Multiple Referrals (Same Referrer)

### Example: Referrer Has 3 Active Referrals

**User 1 signs up:**
```
✅ Referral record created successfully
   Referrer: john-id → Referred: user-1-id
```

**User 1 pays $500:**
```
✅ Referral updated to 'active' status
✅ Referrer's direct_referrals_count updated via trigger
   Referrer: John Smith (john-id)
   New direct_referrals_count: 1
```

**User 2 signs up:**
```
✅ Referral record created successfully
   Referrer: john-id → Referred: user-2-id
```

**User 2 pays $500:**
```
✅ Referral updated to 'active' status
✅ Referrer's direct_referrals_count updated via trigger
   Referrer: John Smith (john-id)
   New direct_referrals_count: 2
```

**User 3 signs up and pays:**
```
✅ Referral record created successfully
   Referrer: john-id → Referred: user-3-id
...
✅ Referrer's direct_referrals_count updated via trigger
   Referrer: John Smith (john-id)
   New direct_referrals_count: 3
```

---

## Scenario 4: User Signs Up Without Referral (Root User)

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

**No referral logs appear** - this is correct, root user has no referrer.

---

## Files Modified

### 1. `app/(auth)/register/page.tsx`

**Added:** Logging for referral creation (lines 232-246)

**What it does:**
- Captures error from referral insert
- Logs success with referrer and referred IDs
- Logs error if insert fails

### 2. `app/(auth)/complete-signup/page.tsx`

**Added:** Logging for OAuth referral creation (lines 82-96)

**What it does:**
- Same logging as email signup
- Works for Google OAuth flow

### 3. `app/api/stripe/webhooks/route.ts`

**Added:** Logging for direct_referrals_count increment (lines 147-182)

**What it does:**
- Queries referrer info before updating
- Updates referral status to "active"
- Queries referrer's updated `direct_referrals_count`
- Logs the new count value

---

## How to Verify Referral System is Working

### Test 1: Create New User with Referral

1. Sign up a new user with a referral code
2. Check server logs
3. Should see: `✅ Referral record created successfully`
4. Query database:

```sql
SELECT
    r.id,
    referrer.name as referrer_name,
    referred.name as referred_name,
    r.status,
    r.initial_payment_status,
    r.created_at
FROM referrals r
JOIN users referrer ON referrer.id = r.referrer_id
JOIN users referred ON referred.id = r.referred_id
WHERE referred.id = '<new-user-id>';
```

Expected: Referral record exists with status "pending"

### Test 2: User Pays $500

1. Process $500 payment for the user
2. Check server logs
3. Should see: `✅ Referral updated to 'active' status`
4. Should see: `New direct_referrals_count: X`
5. Query database:

```sql
-- Check referral status
SELECT status, initial_payment_status
FROM referrals
WHERE referred_id = '<user-id>';

-- Check referrer's count
SELECT
    id,
    name,
    direct_referrals_count
FROM users
WHERE id = '<referrer-id>';
```

Expected:
- Referral status = "active"
- initial_payment_status = "completed"
- Referrer's direct_referrals_count increased by 1

### Test 3: Verify Count Matches Reality

Run `verify-direct-referrals.sql`:

```bash
# In Supabase SQL Editor
```

Expected: All checks show ✓

---

## Troubleshooting

### Log Shows "Referral record created" but Count Never Updates

**Possible reasons:**
- Trigger `update_direct_referrals_count` not deployed
- `direct_referrals_count` column doesn't exist
- Referral never updated to "active" (payment not processed)

**Check:**
```sql
-- Verify trigger exists
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table = 'referrals'
AND trigger_name = 'trigger_update_direct_referrals';

-- Verify column exists
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'direct_referrals_count';
```

### No Referral Logs Appearing on Signup

**Possible reasons:**
- Code not deployed
- Referral creation failing silently (should now show error)
- User signing up without referral code

**Check:**
- Ensure user entered a valid referral code
- Check for error logs: `❌ Error creating referral record`

### Count Doesn't Match Actual Referrals

**Possible reasons:**
- Trigger was deployed after some referrals were created
- Referrals were manually updated without trigger firing
- Database inconsistency

**Fix:**
Run the fix script in `verify-direct-referrals.sql`

---

## Benefits

✅ **Visibility:** See exactly when referrals are created and activated
✅ **Debugging:** Quickly identify if referral system isn't working
✅ **Confidence:** Verify counts are updating correctly
✅ **Monitoring:** Track direct referral growth in real-time

---

## Related Files

- `supabase-activation-schema.sql` - Contains trigger and column definitions
- `verify-direct-referrals.sql` - Verification script to check system health
- `app/(auth)/register/page.tsx` - Email signup with referral creation
- `app/(auth)/complete-signup/page.tsx` - OAuth signup with referral creation
- `app/api/stripe/webhooks/route.ts` - Payment webhook with referral activation
- `app/(dashboard)/referrals/page.tsx` - Referrals display page

---

## Example: Full Referral Flow

```
1. User enters referral code: JOHN123
   → System validates code
   → Confirms referrer exists

2. User signs up with email
   → Account created
   → ✅ Referral record created successfully
   →    Referrer: john-id → Referred: new-user-id

3. User assigned network position
   → Position: L002P0000000015
   → ✅ Incremented total_network_count for ancestors

4. User verifies email

5. User pays $500
   → ✅ User became ACTIVE after $500 payment!
   → ✅ Referral updated to 'active' status
   → ✅ Referrer's direct_referrals_count updated via trigger
   →    Referrer: John Smith (john-id)
   →    New direct_referrals_count: 5

6. Referrer sees new referral in dashboard
   → /referrals page shows the new active referral
```

---

## Summary

- **Signup:** Shows referral record creation with IDs
- **$500 Payment:** Shows referral activation + count increment
- **Error handling:** Shows specific errors if creation/update fails
- **Count visibility:** Shows referrer's new count after each activation
- **Verification:** SQL script to ensure system health
