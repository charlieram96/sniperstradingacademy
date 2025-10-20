# Monthly Residual Commission Payout System

## Overview

This system allows superadmins to manually process monthly residual commission payouts to users. It provides full visibility and control over each payout, with individual retry capabilities for failed transfers.

## Features

✅ **Superadmin-only access** - Restricted to users with `role = 'superadmin'`
✅ **Real-time status tracking** - See each member's payout status during processing
✅ **Individual payout control** - Process or retry individual payouts
✅ **Bulk processing** - Process all pending payouts at once
✅ **Prevent double payouts** - Automatically skips already-paid commissions
✅ **Stripe balance check** - Warning if insufficient balance
✅ **Error tracking** - See exactly who failed and why
✅ **Retry mechanism** - Retry failed payouts with one click

---

## Setup Instructions

### Step 1: Run Database Migration

Open Supabase SQL Editor and run the schema update file:

```bash
Run: supabase-payouts-schema.sql
```

This adds the following columns to the `commissions` table:
- `stripe_transfer_id` - Stripe transfer ID for audit trail
- `error_message` - Error details if payout failed
- `processed_at` - When payout was attempted
- `retry_count` - Number of retry attempts

### Step 2: Verify Supabase Cron Job

Ensure the monthly commission generation cron job is running:

**Schedule:** 1st of month at 00:01 UTC
**SQL:** `SELECT * FROM public.process_monthly_volumes();`

This cron job:
1. Archives current month's sniper volume
2. Creates commission records with `status = 'pending'` and `commission_type = 'residual_monthly'`
3. Resets sniper volume for new month

### Step 3: Deploy Code

The following files have been created:

**API Endpoints:**
- `app/api/admin/payouts/pending/route.ts` - Fetch pending commissions
- `app/api/admin/payouts/balance/route.ts` - Check Stripe balance
- `app/api/admin/payouts/process-single/route.ts` - Process one payout
- `app/api/admin/payouts/process-bulk/route.ts` - Process all payouts

**UI:**
- `app/(dashboard)/admin/payouts/page.tsx` - Admin interface

**Navigation:**
- Updated `app/(dashboard)/layout.tsx` to add "Payouts" link (superadmin only)

Deploy your Next.js application:
```bash
npm run build
# Deploy to Vercel/production
```

---

## How It Works

### Monthly Workflow

**1st of Month (Automated):**
```
Supabase Cron runs process_monthly_volumes()
  ↓
For each user with sniper volume:
  - Calculate commission: sniper_volume × commission_rate
  - Create commission record (status: 'pending', type: 'residual_monthly')
  - Archive to sniper_volume_history
  - Reset sniper_volume_current_month = 0
```

**~7th of Month (Manual by Superadmin):**
```
Superadmin visits /admin/payouts
  ↓
Reviews pending commissions and Stripe balance
  ↓
Clicks "Process All Pending"
  ↓
System processes each payout:
  - Verify user has stripe_connect_account_id
  - Verify payouts_enabled = true
  - Create Stripe transfer
  - Update status to 'paid' with paid_at timestamp
  ↓
Failed payouts remain as 'pending' with error_message
  ↓
Superadmin retries failed payouts individually
```

---

## Using the Admin Interface

### Access the Page

Navigate to: **`/admin/payouts`**

Only superadmins will see this in the sidebar navigation.

### Dashboard Overview

**Summary Cards:**
- **Total Pending** - Total amount owed to all users
- **Pending** - Number of not-yet-processed payouts
- **Failed** - Number of payouts that need retry
- **Stripe Balance** - Current available balance (⚠️ warning if insufficient)

### Processing Payouts

#### Option 1: Bulk Process All

1. Click **"Process All Pending (X)"** button
2. Review confirmation modal:
   - Total users
   - Total amount
   - Your Stripe balance
3. Click **"Confirm & Process"**
4. Watch real-time status updates
5. View results summary when complete

#### Option 2: Individual Processing

For each commission row:
- **Status badges:**
  - ⏸️ **Pending** - Not yet processed
  - ❌ **Failed** - Needs retry
  - ✅ **Paid** - Completed
- **Action buttons:**
  - **"Process"** - Process a pending payout
  - **"Retry"** - Retry a failed payout

**Error Messages:**
Common errors displayed in the "Error" column:
- "No Stripe Connect account" - User hasn't completed bank onboarding
- "Bank account not verified" - User needs to verify their bank
- "Transfer failed: [reason]" - Stripe error details

### Filters

Use the dropdown to filter by status:
- **All** - Show all commissions
- **Pending** - Only unprocessed payouts
- **Failed** - Only payouts that need retry

---

## Money Flow

### How Transfers Work

```
Your Main Stripe Account
  (Contains all revenue)
        ↓
stripe.transfers.create()
  (Pulls from your balance)
        ↓
User's Connected Account
  (Stripe Express Account)
        ↓
  Automatically pays out to
  their bank within 2-7 days
```

### Important Notes

1. **Stripe Balance Required**
   - All payouts come from YOUR Stripe account balance
   - Ensure sufficient balance before bulk processing
   - System will warn if balance insufficient

2. **Transfer Fees**
   - Stripe charges $0.25 per transfer
   - These fees are deducted from your balance
   - Example: 100 payouts = $25 in fees

3. **Sequential Processing**
   - Payouts are processed one at a time
   - If one fails, processing continues
   - Failed payouts can be retried later

---

## Safety Features

### Prevent Double Payouts

The system automatically checks:
```typescript
if (commission.status === 'paid') {
  // Skip - already paid
}
```

No commission will be paid twice, even if you click "Process All" multiple times.

### Balance Validation

Before bulk processing:
```typescript
const totalNeeded = commissions × amount
const fees = commissions.length × 0.25

if (stripeBalance < totalNeeded + fees) {
  // Block processing with error
}
```

### Audit Trail

Every payout is tracked:
- `stripe_transfer_id` - Stripe's unique ID
- `paid_at` - When payment completed
- `processed_at` - When attempt was made
- `error_message` - What went wrong (if failed)
- `retry_count` - How many times retried

---

## Troubleshooting

### Error: "No Stripe Connect account"

**Problem:** User hasn't completed bank account onboarding
**Solution:**
1. User must visit Finance page
2. Complete Stripe Connect onboarding
3. Connect their bank account
4. Retry payout after verified

### Error: "Bank account not verified"

**Problem:** Stripe account exists but `payouts_enabled = false`
**Solution:**
1. User needs to complete verification in Stripe dashboard
2. May need to provide additional documents
3. Can take 1-3 business days
4. Retry after Stripe approves

### Error: "Insufficient Stripe balance"

**Problem:** Your Stripe balance is less than total owed
**Solution:**
1. Wait for more customer payments to arrive
2. Transfer funds into your Stripe account
3. Process in batches (filter pending, process 50 at a time)

### Error: "Transfer failed: [Stripe error]"

**Problem:** Stripe rejected the transfer
**Solution:**
1. Read error message for specific reason
2. Common fixes:
   - Account closed → User needs new bank account
   - Invalid routing number → User needs to update
   - Account frozen → Contact Stripe support
3. Retry after user fixes issue

---

## Database Schema

### Commissions Table Columns

```sql
-- Existing columns
id                  UUID
referrer_id         UUID        -- User receiving payout
referred_id         UUID        -- User who triggered commission
amount              DECIMAL     -- Amount to pay (in dollars)
status              TEXT        -- 'pending' | 'paid' | 'cancelled'
commission_type     TEXT        -- 'direct_bonus' | 'residual_monthly'
created_at          TIMESTAMP
paid_at             TIMESTAMP

-- NEW columns (added by this system)
stripe_transfer_id  TEXT        -- Stripe's transfer ID
error_message       TEXT        -- Error details if failed
processed_at        TIMESTAMP   -- When payout was attempted
retry_count         INTEGER     -- Number of retry attempts
```

---

## API Reference

### GET `/api/admin/payouts/pending`

Returns all pending/failed residual commissions.

**Response:**
```json
{
  "commissions": [{
    "id": "uuid",
    "referrerId": "uuid",
    "amount": 249.50,
    "status": "pending",
    "userName": "John Doe",
    "userEmail": "john@example.com",
    "stripeConnectAccountId": "acct_xxx",
    "errorMessage": null,
    "retryCount": 0
  }],
  "summary": {
    "total": 50,
    "pending": 45,
    "failed": 5,
    "totalAmount": 12450.00
  }
}
```

### GET `/api/admin/payouts/balance`

Returns current Stripe balance.

**Response:**
```json
{
  "available": 15000.00,
  "pending": 2500.00,
  "currency": "usd"
}
```

### POST `/api/admin/payouts/process-single`

Process one commission payout.

**Request:**
```json
{
  "commissionId": "uuid"
}
```

**Response (Success):**
```json
{
  "success": true,
  "transferId": "tr_xxx",
  "commissionId": "uuid",
  "amount": 249.50,
  "userName": "John Doe"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Bank account not verified",
  "commissionId": "uuid"
}
```

### POST `/api/admin/payouts/process-bulk`

Process multiple commissions at once.

**Request:**
```json
{
  "commissionIds": ["uuid1", "uuid2"]  // Optional - defaults to all pending
}
```

**Response:**
```json
{
  "successful": 48,
  "failed": 2,
  "skipped": 0,
  "total": 50,
  "results": [{
    "commissionId": "uuid",
    "userName": "John Doe",
    "amount": 249.50,
    "success": true,
    "transferId": "tr_xxx"
  }]
}
```

---

## Best Practices

### Timing

- **Wait 3-5 days after month end** before processing
- Allows time for any late payments to clear
- Ensures accurate commission calculations

### Pre-Processing Checklist

1. ✅ Check Stripe balance is sufficient
2. ✅ Review pending commission total
3. ✅ Verify month period is correct
4. ✅ Confirm all direct bonuses are processed first

### Post-Processing

1. Review results summary
2. Address any failed payouts
3. Contact users with errors
4. Keep records for accounting

### Communication

Send email to users before/after processing:
- "Your commission will be processed on [date]"
- "Commission transferred! Check your bank in 2-7 days"

---

## Security

- ✅ All routes check `role === 'superadmin'`
- ✅ Returns 403 if not authorized
- ✅ Navigation link only visible to superadmins
- ✅ Supabase RLS policies enforce permissions
- ✅ Stripe API key secured in environment variables

---

## Support

If you encounter issues:

1. Check Supabase logs for API errors
2. Check Stripe dashboard for transfer status
3. Review commission records in database
4. Contact Stripe support for payment issues

**Happy Processing! 💰**
