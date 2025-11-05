# Stripe Webhook Recovery & Monitoring Guide
**Version:** 1.0
**Date:** November 5, 2025
**Status:** ✅ System Enhanced with Event Persistence

---

## Overview

This guide documents the Stripe webhook recovery system, including how to identify missing payments, recover lost data, and prevent future failures.

### What Was Fixed

1. ✅ **Event Persistence** - All webhook events now stored in `webhook_events` table
2. ✅ **Idempotency** - Duplicate events automatically rejected
3. ✅ **Error Tracking** - Failed events logged with error messages
4. ✅ **Recovery Scripts** - Automated tools to identify and sync missing payments
5. ✅ **Monitoring** - Query-based monitoring for failed webhooks

---

## System Architecture

### Webhook Flow

```
Stripe sends event
    ↓
POST /api/stripe/webhooks
    ↓
├─ Verify signature
├─ Store event in webhook_events table
├─ Check for duplicates (idempotency)
├─ Process event (switch statement)
├─ Mark as processed/failed
└─ Return 200 OK or 500 Error
```

### Database Tables

**`webhook_events`** - Event persistence
```sql
- id: UUID
- stripe_event_id: TEXT (unique)
- event_type: TEXT
- payload: JSONB
- processed: BOOLEAN
- processing_attempts: INTEGER
- last_error: TEXT
- last_attempt_at: TIMESTAMP
- created_at: TIMESTAMP
- processed_at: TIMESTAMP
```

**`payments`** - Payment records
**`users`** - User activation status
**`commissions`** - Bonus commissions
**`referrals`** - Referral tracking

---

## How to Identify Missing Payments

### Step 1: Run Identification Script

```bash
cd /Users/charlieramirez/Desktop/tradinghub
npx tsx scripts/identify-missing-payments.ts
```

**What it does:**
- Fetches all users with Stripe customer IDs
- Checks each user for payment records in database
- Queries Stripe for successful $499 payments
- Identifies mismatches (paid in Stripe but not in DB)
- Generates `missing-payments-report.json`

**Output:**
```
┌────────────────────────────┬──────────┬─────────┬─────────────────┐
│ Email                      │ Active   │ Has DB  │ Stripe Amount   │
├────────────────────────────┼──────────┼─────────┼─────────────────┤
│ user@example.com          │ No ✗     │ No ✗    │ $499            │
└────────────────────────────┴──────────┴─────────┴─────────────────┘

📄 Detailed report saved to: missing-payments-report.json
```

### Step 2: Review the Report

**File:** `missing-payments-report.json`

```json
{
  "generatedAt": "2025-11-05T...",
  "totalAffected": 3,
  "users": [
    {
      "userId": "uuid",
      "email": "user@example.com",
      "stripeCustomerId": "cus_xxx",
      "stripePaymentId": "pi_xxx",
      "stripePaymentDate": "2025-11-04",
      "currentStatus": {
        "isActive": false,
        "hasPaymentRecord": false,
        "membershipStatus": "locked"
      }
    }
  ]
}
```

---

## How to Recover Missing Payments

### Step 1: Review Affected Users

**IMPORTANT:** Always review `missing-payments-report.json` before running recovery!

Verify:
- Users actually paid in Stripe
- Amounts are correct ($499 for initial)
- Users should be activated

### Step 2: Run Recovery Script

```bash
npx tsx scripts/sync-missing-payments.ts
```

**What it does for each user:**
1. ✅ Assigns network position (if missing)
2. ✅ Activates user account
3. ✅ Increments ancestor active counts
4. ✅ Updates referral status
5. ✅ Records payment in database
6. ✅ Creates $249.50 direct bonus for referrer

**Output:**
```
================================================================================
🔧 SYNCING: user@example.com
================================================================================

💰 Stripe Payment: $499 (succeeded)
📅 Payment Date: 11/4/2025, 3:45:00 PM

📍 Step 1: Assigning network position...
   ✅ Position assigned: 1-2-3

👤 Step 2: Activating user account...
   ✅ User activated (membership unlocked, is_active = true)

📊 Step 3: Updating ancestor active counts...
   ✅ Updated active_network_count for 12 ancestors

🤝 Step 4: Updating referral status...
   ✅ Referral status updated to active

💳 Step 5: Recording payment in database...
   ✅ Payment record created ($499)

🎁 Step 6: Creating direct bonus commission...
   ✅ Direct bonus created: $249.50
   ⏰ Available after: 11/7/2025

================================================================================
✅✅✅ SYNC COMPLETE: user@example.com
================================================================================
```

### Step 3: Verify Recovery

**SQL Query (run in Supabase):**

```sql
SELECT
  u.email,
  u.is_active,
  u.membership_status,
  u.initial_payment_completed,
  u.network_position_id,
  p.amount as payment_amount,
  p.created_at as payment_date,
  c.amount as bonus_amount,
  c.status as bonus_status
FROM users u
LEFT JOIN payments p ON p.user_id = u.id AND p.payment_type = 'initial'
LEFT JOIN commissions c ON c.referred_id = u.id AND c.commission_type = 'direct_bonus'
WHERE u.email IN ('user1@example.com', 'user2@example.com');
```

**Expected Results:**
- `is_active` = true
- `membership_status` = "unlocked"
- `initial_payment_completed` = true
- `payment_amount` = 499
- `bonus_amount` = 249.50
- `bonus_status` = "pending"

---

## Monitoring Webhooks

### Daily Monitoring Queries

**1. Check for Unprocessed Events:**

```sql
SELECT
  id,
  stripe_event_id,
  event_type,
  processing_attempts,
  last_error,
  created_at
FROM webhook_events
WHERE processed = false
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

**2. Check for Failed Processing Attempts:**

```sql
SELECT
  event_type,
  COUNT(*) as failed_count,
  COUNT(DISTINCT last_error) as unique_errors
FROM webhook_events
WHERE processing_attempts > 1
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY failed_count DESC;
```

**3. Find Users with Payments But Not Activated:**

```sql
SELECT
  u.email,
  u.is_active,
  u.membership_status,
  p.amount,
  p.created_at as payment_date,
  p.stripe_payment_intent_id
FROM users u
INNER JOIN payments p ON p.user_id = u.id
WHERE p.payment_type = 'initial'
AND p.status = 'succeeded'
AND (u.is_active = false OR u.initial_payment_completed = false)
ORDER BY p.created_at DESC;
```

### Stripe Dashboard Checks

**Location:** https://dashboard.stripe.com/webhooks

**Daily Checks:**
1. Navigate to your webhook endpoint
2. Click "Event Log" tab
3. Look for failed deliveries (red indicators)
4. Check response codes:
   - ✅ 200 = Success
   - ⚠️ 400 = Bad request (signature issues)
   - ❌ 500 = Server error (processing failed)

**Common Issues:**
- **401/403:** Authentication problems
- **500:** Database errors, RPC failures
- **Timeouts:** Operations taking too long

### Alert Setup (Recommended)

Set up monitoring alerts for:

1. **Unprocessed Events > 5 in 1 hour**
   ```sql
   SELECT COUNT(*) FROM webhook_events
   WHERE processed = false
   AND created_at > NOW() - INTERVAL '1 hour'
   ```

2. **Failed Processing Attempts > 10 in 24 hours**
   ```sql
   SELECT COUNT(*) FROM webhook_events
   WHERE processing_attempts > 1
   AND created_at > NOW() - INTERVAL '24 hours'
   ```

3. **Critical Event Types Failed**
   ```sql
   SELECT COUNT(*) FROM webhook_events
   WHERE event_type IN ('checkout.session.completed', 'invoice.payment_succeeded')
   AND processed = false
   AND created_at > NOW() - INTERVAL '6 hours'
   ```

---

## Common Failure Scenarios

### Scenario 1: Missing userId in Metadata

**Symptoms:**
- Webhook received but no database updates
- Error log: "No userId in checkout session metadata"

**Cause:**
Checkout session created without `metadata.userId`

**Fix:**
Ensure all checkout sessions include:
```typescript
metadata: {
  userId: user.id,
  paymentType: "initial"
}
```

**Recovery:**
User's Stripe customer ID is linked to their account. Use recovery script.

### Scenario 2: RPC Function Failures

**Symptoms:**
- Payment recorded but user not activated
- Network position not assigned
- Commissions not created

**Cause:**
- `assign_network_position()` failed
- `increment_upchain_active_count()` failed
- Database constraint violations

**Fix:**
Check database logs for RPC errors. Common issues:
- Missing referrer (referred_by = NULL)
- Position already assigned
- RLS policy blocking writes (use service role client)

**Recovery:**
Run sync script - it handles partial failures gracefully.

### Scenario 3: Duplicate Events

**Symptoms:**
- Stripe shows webhook delivered multiple times
- Database has duplicate records

**Current Protection:**
✅ Now handled automatically via `webhook_events` table unique constraint on `stripe_event_id`.

**Behavior:**
Duplicate events return 200 OK with `{duplicate: true}` without processing.

### Scenario 4: Silent Failures (PARTIALLY FIXED)

**Symptoms:**
- Webhook returns 200 OK
- Operations actually failed
- No alerts or notifications

**Partial Fix:**
- Events now persisted to `webhook_events` table
- Can query for unprocessed events
- Exceptions now properly caught and logged

**Remaining Issue:**
Errors within switch cases (e.g., RPC failures) don't cause 500 response. Operations log errors but webhook still returns 200 OK, so Stripe won't retry.

**Future Improvement:**
Refactor switch statement to track critical operation failures and return 500 for payment-related events.

---

## Manual Webhook Replay

If you need to manually replay a failed webhook:

### Step 1: Get Event from Database

```sql
SELECT
  id,
  stripe_event_id,
  event_type,
  payload
FROM webhook_events
WHERE processed = false
AND event_type = 'checkout.session.completed'
ORDER BY created_at DESC
LIMIT 10;
```

### Step 2: Resend via Stripe Dashboard

1. Go to Stripe Dashboard > Developers > Events
2. Search for the event ID
3. Click "Resend webhook"
4. Or use Stripe CLI:
   ```bash
   stripe events resend evt_xxx
   ```

### Step 3: Verify Processing

```sql
SELECT processed, processed_at, last_error
FROM webhook_events
WHERE stripe_event_id = 'evt_xxx';
```

---

## Prevention Checklist

### Development Best Practices

- [ ] Always include `metadata.userId` in checkout sessions
- [ ] Use service role client for webhook operations
- [ ] Wrap critical operations in try-catch blocks
- [ ] Log all errors with context (user ID, event ID, amounts)
- [ ] Test webhooks in development with Stripe CLI
- [ ] Use Stripe test mode for staging environment

### Monitoring Setup

- [ ] Daily query for unprocessed events
- [ ] Weekly reconciliation: Stripe payments vs database records
- [ ] Alert on failed webhook deliveries
- [ ] Monitor `webhook_events` table for patterns
- [ ] Check Stripe dashboard for endpoint health

### Database Maintenance

- [ ] Archive old webhook events (> 90 days)
- [ ] Index `webhook_events` table appropriately
- [ ] Monitor table size and performance
- [ ] Regular RLS policy audits
- [ ] Backup before recovery operations

---

## Scripts Reference

### identify-missing-payments.ts

**Location:** `/scripts/identify-missing-payments.ts`

**Purpose:** Find users who paid in Stripe but aren't activated in database

**Usage:**
```bash
npx tsx scripts/identify-missing-payments.ts
```

**Outputs:**
- Console table of affected users
- `missing-payments-report.json` file

**Dependencies:**
- Stripe API key (`STRIPE_SECRET_KEY`)
- Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`)

### sync-missing-payments.ts

**Location:** `/scripts/sync-missing-payments.ts`

**Purpose:** Recover missing payments by replaying webhook operations

**Usage:**
```bash
npx tsx scripts/sync-missing-payments.ts
```

**Inputs:**
- Reads `missing-payments-report.json`

**Outputs:**
- Detailed console logs per user
- `payment-recovery-results.json` file

**Operations:**
1. Network position assignment
2. User activation
3. Ancestor count updates
4. Referral status updates
5. Payment recording
6. Direct bonus creation

---

## Troubleshooting

### Issue: Script can't find Stripe payment

**Check:**
```bash
stripe payment_intents list --customer cus_xxx
```

**Possible Causes:**
- Wrong customer ID
- Payment in different Stripe account (test vs live)
- Payment refunded or disputed

### Issue: RPC function errors during recovery

**Check:**
```sql
-- Verify RPC functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'assign_network_position',
  'increment_upchain_active_count',
  'distribute_to_upline_batch'
);
```

**Fix:** Ensure all database functions are deployed

### Issue: Permission denied errors

**Check:** Service role key is set correctly:
```bash
echo $SUPABASE_SERVICE_ROLE_KEY
```

**Fix:** Update `.env.local` with correct service role key

---

## Support & Further Help

### Documentation
- Stripe Webhooks: https://stripe.com/docs/webhooks
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security

### Logs
- **Vercel:** `vercel logs --follow`
- **Supabase:** Dashboard > Logs
- **Stripe:** Dashboard > Developers > Events

### Contact
For webhook failures affecting user payments, this is critical - escalate immediately!

---

## Changelog

### Version 1.0 (November 5, 2025)
- ✅ Added `webhook_events` table for event persistence
- ✅ Implemented idempotency checking
- ✅ Created identification script
- ✅ Created recovery script
- ✅ Added monitoring queries
- ✅ Updated webhook handler with event tracking
- 📝 Documented recovery procedures

---

**Last Updated:** November 5, 2025
**Status:** Production Ready ✅
