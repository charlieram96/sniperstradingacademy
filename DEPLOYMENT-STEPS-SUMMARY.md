# Complete Deployment Steps - Quick Reference

## What Was Implemented

✅ **Two-Phase Active Status Logic:**
- User pays $500 → active immediately (30-day grace period)
- User subscribes → active based on subscription status
- Weekly ($49.75) or monthly ($199) payment options
- Incremental network counting (event-based)
- Position assignment bug fixes

---

## Step-by-Step Deployment

### 1. Database Migrations (Supabase SQL Editor)

Run these SQL files **in order**:

```sql
-- A. Add initial_payment_date column
-- Copy/paste contents of: supabase-initial-payment-date-schema.sql

-- B. Update daily cron with two-phase logic
-- Copy/paste contents of: supabase-updated-daily-subscription-sync.sql
```

**Verify it worked:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'initial_payment_date';
-- Should return 1 row
```

---

### 2. Check Current State

```sql
-- Preview what will change when cron runs
SELECT * FROM public.preview_active_status_changes()
WHERE status_change != 'No change';
```

---

### 3. Run Verification Queries

Open `verify-two-phase-active-status.sql` and run the queries one by one.

**Key checks:**
- All positions are length 15 ✅
- No duplicate positions ✅
- Active status matches expected ✅
- Active counts are accurate ✅

---

### 4. Deploy Code

```bash
cd /Users/charlieramirez/Desktop/tradinghub

# Review changes
git status
git diff

# Commit and push
git add .
git commit -m "Implement two-phase active status, weekly payments, and bug fixes"
git push
```

**Watch deployment logs for:**
- ✅ Build succeeds
- ✅ No TypeScript/ESLint errors
- ✅ Deployment completes

---

### 5. Test in Production

#### Test A: New User Registration
1. Register test user
2. Pay $500 initial payment
3. **Check:** User becomes active immediately
4. **Check:** `initial_payment_date` is set
5. **Check:** Ancestors' `active_network_count` incremented

#### Test B: Weekly Subscription
1. Go to payments page
2. Choose weekly payment ($49.75/week)
3. Complete checkout
4. **Check:** First charge is $49.75
5. **Check:** Subscription created with weekly interval

#### Test C: Monthly Subscription
1. Choose monthly payment ($199/month)
2. Complete checkout
3. **Check:** First charge is $199
4. **Check:** Subscription created with monthly interval

---

## Files Reference

### Database Files (Run in Supabase)
| File | Purpose |
|------|---------|
| `supabase-initial-payment-date-schema.sql` | Adds initial_payment_date column |
| `supabase-updated-daily-subscription-sync.sql` | Two-phase active status logic |
| `verify-two-phase-active-status.sql` | Verification queries |

### Code Files (Deployed via Git)
| File | Changes |
|------|---------|
| `app/api/stripe/webhooks/route.ts` | Initial payment → set active, increment counts |
| Other files | Already updated (weekly payments, etc.) |

### Documentation
| File | Contents |
|------|----------|
| `TWO-PHASE-ACTIVE-STATUS-DEPLOYMENT.md` | Complete deployment guide |
| `DEPLOYMENT-STEPS-SUMMARY.md` | This quick reference |
| `FINAL-DEPLOYMENT-CHECKLIST.md` | Original deployment checklist |

---

## What Happens After Deployment

### For New Users:
1. Pay $500 → **Active immediately**
2. Have 30 days to subscribe
3. Choose weekly ($49.75) or monthly ($199)
4. First payment charged immediately when subscribing
5. Billing anniversary = day of first subscription

### For Existing Test Users:
- **testuser7**: Currently active but no subscription
  - If `initial_payment_date` > 30 days ago → will become inactive
  - If `initial_payment_date` < 30 days ago → stays active
- **Other test users**: Should be inactive (no payments or subscriptions)

### For You (charlieram96):
- Has active subscription → stays active ✅
- Active status follows subscription status ✅

---

## Monitoring (First 24 Hours)

```sql
-- Check users in grace period
SELECT
    email,
    EXTRACT(DAY FROM NOW() - initial_payment_date)::INTEGER as days_left,
    is_active
FROM public.users
WHERE initial_payment_completed = TRUE
AND initial_payment_date >= NOW() - INTERVAL '30 days'
AND (SELECT COUNT(*) FROM public.subscriptions WHERE user_id = users.id) = 0;

-- Check active counts
SELECT
    email,
    network_level,
    total_network_count,
    active_network_count
FROM public.users
WHERE network_level < 3
ORDER BY network_level, network_position;

-- Check cron execution
SELECT
    start_time,
    status,
    return_message
FROM cron.job_run_details
WHERE jobname = 'daily-active-status-update'
ORDER BY start_time DESC
LIMIT 3;
```

---

## Troubleshooting

### User paid $500 but still inactive

**Run:**
```sql
SELECT public.update_all_active_statuses();
```

This manually triggers the status sync.

### Active counts seem wrong

**Run:**
```sql
SELECT * FROM public.sync_all_network_counts();
```

This recalculates all counts from scratch.

### Position assignment still creating duplicates

**Check:**
```sql
SELECT email, network_position_id, length(network_position_id)
FROM public.users
WHERE network_position_id IS NOT NULL;
```

All lengths should be **exactly 15**.

---

## Quick Status Check

**Run this one query to see everything:**

```sql
SELECT
    u.email,
    u.is_active,
    u.network_position_id,
    u.initial_payment_completed,
    EXTRACT(DAY FROM NOW() - u.initial_payment_date)::INTEGER as days_since_payment,
    s.status as sub_status,
    u.active_network_count,
    CASE
        WHEN s.status = 'active' THEN '✅ Active subscription'
        WHEN u.initial_payment_date >= NOW() - INTERVAL '30 days' THEN '⏳ In grace period'
        WHEN u.initial_payment_date < NOW() - INTERVAL '30 days' THEN '❌ Grace expired'
        ELSE '⚪ No payment'
    END as status_reason
FROM public.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE u.network_position_id IS NOT NULL
ORDER BY u.network_level, u.network_position;
```

---

## Success ✅

Deployment is complete when:

1. ✅ Database migrations run successfully
2. ✅ Verification queries all pass
3. ✅ Code deployed to production
4. ✅ Test user flow works end-to-end
5. ✅ Active counts update correctly
6. ✅ Position assignment creates no duplicates

---

## Next Actions

**After successful deployment:**

1. Monitor for 24 hours
2. Test real user registration
3. Verify webhook logs show correct events
4. Check daily cron runs at 2 AM UTC
5. Update user-facing docs about 30-day grace period

**Ready to go!** 🚀
