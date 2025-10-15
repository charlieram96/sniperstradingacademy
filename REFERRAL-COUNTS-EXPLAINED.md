# Referral Counts System - Complete Guide

## Two Different Counts

Your system tracks **TWO separate referral counts** for different purposes:

### 1. `direct_referrals_count`
**Meaning:** Total users who paid the initial $500

**How it's calculated:**
```sql
SELECT COUNT(*)
FROM referrals
WHERE referrer_id = <user-id>
AND status = 'active'
```

**When it increments:**
- User signs up with your referral code → referral created (status = "pending")
- User pays $500 → referral status changes to "active" → count +1

**When it decrements:**
- Never (once someone pays $500, they always count)

**Use case:**
- Tracking total signups that paid
- Initial $250 per referral payment

---

### 2. `active_direct_referrals_count`
**Meaning:** Users who are **currently active** (paying subscription)

**How it's calculated:**
```sql
SELECT COUNT(*)
FROM users
WHERE referred_by = <user-id>
AND is_active = TRUE
```

**When it increments:**
- Referred user pays $500 → is_active = TRUE → count +1
- Referred user reactivates subscription → is_active = TRUE → count +1

**When it decrements:**
- Referred user stops paying → is_active = FALSE → count -1
- Referred user's grace period expires → is_active = FALSE → count -1

**Use case:**
- **Qualification for structure payouts** (need 3 active referrals)
- Tracking current active team size

---

## Why We Need Both

### Example Scenario:

**John refers 5 people:**
1. Alice - paid $500, still active ✓
2. Bob - paid $500, still active ✓
3. Charlie - paid $500, still active ✓
4. David - paid $500, but stopped paying (inactive) ✗
5. Eve - signed up, never paid ✗

**John's counts:**
- `direct_referrals_count` = **4** (Alice, Bob, Charlie, David paid $500)
- `active_direct_referrals_count` = **3** (Alice, Bob, Charlie are currently active)

**Qualification:**
- John is **qualified** because he has 3 active referrals (Alice, Bob, Charlie)
- If Charlie stops paying, active count drops to 2 → John **loses qualification**
- His total count stays 4 (David still counts as having paid once)

---

## Qualification Rules

### To qualify for structure payouts:

```
active_direct_referrals_count >= 3
```

**Requirements:**
- Need **3 users currently active** (is_active = TRUE)
- Not just 3 users who paid $500 once
- Qualification can be lost if active users become inactive

### Qualification Flow:

```
User has 0 active referrals → Not qualified
  ↓
3 users pay $500 → active_direct_referrals_count = 3
  ↓
qualified_at timestamp set → Now qualified! ✓
  ↓
Can receive structure bonuses (beyond 3 levels)
  ↓
One user stops paying → active_direct_referrals_count = 2
  ↓
Loses qualification (qualified_at stays, but needs 3 active again)
```

---

## Database Schema

### Columns in `users` table:

```sql
-- Referral tracking
referred_by UUID,                              -- Who referred this user
direct_referrals_count INTEGER DEFAULT 0,      -- Total who paid $500
active_direct_referrals_count INTEGER DEFAULT 0, -- Currently active referrals

-- Status
is_active BOOLEAN DEFAULT FALSE,                -- Currently active (paying)
qualified_at TIMESTAMP,                         -- When user qualified (3+ active)
```

### Columns in `referrals` table:

```sql
referrer_id UUID,                  -- Who made the referral
referred_id UUID,                  -- Who was referred
status TEXT,                       -- "pending" or "active"
initial_payment_status TEXT,       -- "pending" or "completed"
```

---

## How Triggers Work

### Trigger 1: `update_direct_referrals_count`

**Fires when:** Referral status changes to "active"
**Updates:** `direct_referrals_count`

```sql
-- User pays $500
UPDATE referrals SET status = 'active' WHERE referred_id = <user-id>;

-- Trigger fires
UPDATE users
SET direct_referrals_count = (
    SELECT COUNT(*) FROM referrals
    WHERE referrer_id = <referrer-id>
    AND status = 'active'
)
WHERE id = <referrer-id>;
```

### Trigger 2: `update_active_direct_referrals_count`

**Fires when:** User's `is_active` status changes
**Updates:** `active_direct_referrals_count`

```sql
-- User becomes inactive (stopped paying)
UPDATE users SET is_active = FALSE WHERE id = <user-id>;

-- Trigger fires
UPDATE users
SET active_direct_referrals_count = (
    SELECT COUNT(*) FROM users
    WHERE referred_by = <referrer-id>
    AND is_active = TRUE
)
WHERE id = <referrer-id>;

-- Check qualification
IF active_direct_referrals_count >= 3 AND qualified_at IS NULL THEN
    UPDATE users SET qualified_at = NOW() WHERE id = <referrer-id>;
END IF;
```

---

## Server Logs

### When user pays $500:

```
✅ Referral updated to 'active' status
✅ Referrer's direct_referrals_count updated via trigger
   Referrer: John Smith (86a789ea...)
   New direct_referrals_count: 4

✅ User became ACTIVE after $500 payment!
User abc123... became ACTIVE - referrer 86a789ea... active count: 3
```

### When user becomes inactive:

```
Subscription became inactive! Decremented active_network_count for 3 ancestors
User abc123... became INACTIVE - referrer 86a789ea... active count: 2
```

---

## Querying Referral Counts

### Check a user's referrals:

```sql
SELECT
    name,
    email,
    direct_referrals_count,
    active_direct_referrals_count,
    CASE
        WHEN qualified_at IS NOT NULL THEN 'Qualified'
        WHEN active_direct_referrals_count >= 3 THEN 'Should be qualified'
        ELSE 'Not qualified'
    END as qualification_status
FROM users
WHERE id = '<user-id>';
```

### List all referred users:

```sql
SELECT
    referred.name,
    referred.email,
    referred.is_active,
    r.status as referral_status,
    r.created_at
FROM users referrer
JOIN users referred ON referred.referred_by = referrer.id
LEFT JOIN referrals r ON r.referred_id = referred.id
WHERE referrer.id = '<user-id>'
ORDER BY r.created_at DESC;
```

### Top referrers by active count:

```sql
SELECT
    name,
    email,
    direct_referrals_count as total_paid,
    active_direct_referrals_count as currently_active,
    qualified_at
FROM users
WHERE active_direct_referrals_count > 0
ORDER BY active_direct_referrals_count DESC, direct_referrals_count DESC
LIMIT 10;
```

---

## Deployment Order

### 1. Clean up schema (remove duplicates)

```sql
supabase-cleanup-referral-schema.sql
```

**Removes:**
- `account_active` (duplicate of `is_active`)
- `accumulated_residual` (not needed)

**Adds:**
- `active_direct_referrals_count` column
- Updated `check_qualification_status()` function

### 2. Deploy activation schema (if not already deployed)

```sql
supabase-activation-schema.sql
```

**Adds:**
- `direct_referrals_count` column
- `update_direct_referrals_count()` trigger for paid referrals

### 3. Deploy active referrals trigger

```sql
supabase-active-referrals-trigger.sql
```

**Adds:**
- `update_active_direct_referrals_count()` trigger for active status changes

### 4. Migrate existing data

```sql
migrate-referral-counts.sql
```

**Does:**
- Calculates correct values for both counts
- Updates all users
- Sets qualification status

---

## Testing

### Test 1: New referral pays $500

1. Create user with referral code
2. Process $500 payment
3. Check logs:

```
✅ Referral updated to 'active' status
✅ Referrer's direct_referrals_count updated via trigger
   New direct_referrals_count: 1
User abc... became ACTIVE - referrer xyz... active count: 1
```

4. Query database:

```sql
SELECT direct_referrals_count, active_direct_referrals_count
FROM users WHERE id = '<referrer-id>';

-- Should show: direct_referrals_count = 1, active_direct_referrals_count = 1
```

### Test 2: User becomes inactive

1. User's subscription expires (or manually set is_active = FALSE)
2. Check logs:

```
User abc... became INACTIVE - referrer xyz... active count: 0
```

3. Query database:

```sql
SELECT direct_referrals_count, active_direct_referrals_count
FROM users WHERE id = '<referrer-id>';

-- Should show: direct_referrals_count = 1 (unchanged), active_direct_referrals_count = 0
```

### Test 3: Qualification

1. Have 3 users pay $500 and stay active
2. Check referrer's status:

```sql
SELECT
    name,
    active_direct_referrals_count,
    qualified_at
FROM users
WHERE id = '<referrer-id>';

-- Should show: active_direct_referrals_count = 3, qualified_at = <timestamp>
```

3. Deactivate 1 user
4. Check again:

```sql
-- Should show: active_direct_referrals_count = 2, qualified_at = <still set>
-- User was qualified but no longer meets requirement
```

---

## Common Questions

### Q: If someone paid $500 but stopped paying, do they still count?

**A:** They count for `direct_referrals_count` but NOT for `active_direct_referrals_count`.
- You got the initial $250 for their signup
- They don't count toward your qualification anymore

### Q: What happens if I qualified, then dropped below 3 active?

**A:** You lose qualification for structure bonuses. The `qualified_at` timestamp stays, but you need 3 active referrals again to receive structure payouts.

### Q: Can a user re-qualify after losing qualification?

**A:** Yes! If your active count goes back to 3+, you automatically qualify again (trigger sets `qualified_at` if it's null).

### Q: Do pending referrals (not paid) count for either?

**A:** No. They need to pay $500 first.
- Before $500: `direct_referrals_count` = 0, `active_direct_referrals_count` = 0
- After $500: `direct_referrals_count` = 1, `active_direct_referrals_count` = 1

### Q: What if I have 5 paid referrals but only 2 are active?

**A:**
- `direct_referrals_count` = 5
- `active_direct_referrals_count` = 2
- Qualification status = Not qualified (need 3 active)

---

## Summary

| Count | Tracks | Changes | Used For |
|-------|---------|---------|----------|
| `direct_referrals_count` | Users who paid $500 | Only increases | Initial $250 payment, total signups |
| `active_direct_referrals_count` | Currently active users | Increases/decreases | Qualification, structure bonuses |

**Key Difference:**
- One is **lifetime** (once paid, always counts)
- Other is **current** (only counts if still active)

**Qualification Rule:**
```
active_direct_referrals_count >= 3
```

This ensures users maintain an active team to receive structure bonuses!
