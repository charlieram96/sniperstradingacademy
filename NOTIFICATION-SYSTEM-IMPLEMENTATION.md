# Notification System Implementation Guide

## ✅ COMPLETED (85% Done)

### 1. Database & Schema
- ✅ Complete database migration (`supabase-notifications-schema.sql`)
- ✅ 8 new tables created:
  - `sms_consent` - TCPA compliance tracking
  - `notification_logs` - Delivery tracking with idempotency
  - `notification_health` - Channel health per user
  - `notification_campaigns` - Admin mass send with approval workflow
  - `notification_campaign_recipients` - Campaign tracking
  - `inbound_sms_messages` - STOP/UNSTOP/HELP handling
  - `notification_templates` - Template management
- ✅ Added to `users` table: `phone_number`, `timezone`, `notification_preferences`
- ✅ Database triggers for auto-disable on bounces/complaints
- ✅ Row Level Security (RLS) policies
- ✅ Seed data for default templates

### 2. Core Infrastructure
- ✅ TypeScript types (`lib/notifications/notification-types.ts`)
- ✅ Twilio SMS service (`lib/notifications/twilio/sms-service.ts`)
- ✅ Twilio/SendGrid email service (`lib/notifications/twilio/email-service.ts`)
- ✅ BullMQ notification queue (`lib/notifications/queue/notification-queue.ts`)
- ✅ Queue worker (`lib/notifications/queue/workers/notification-worker.ts`)
- ✅ Main notification orchestrator (`lib/notifications/notification-service.ts`)
- ✅ Utility functions:
  - Quiet hours enforcement (`lib/notifications/utils/quiet-hours.ts`)
  - Idempotency key generation (`lib/notifications/utils/idempotency.ts`)

### 3. API Routes
- ✅ Notification preferences (`/api/notifications/preferences`)
- ✅ Twilio inbound SMS webhook (`/api/webhooks/twilio/inbound-sms`)
- ✅ Twilio SMS status webhook (`/api/webhooks/twilio/sms-status`)

### 4. Email Templates
- ✅ Sample template created: `payout-processed-email.tsx`

### 5. Packages Installed
- ✅ `twilio`
- ✅ `@sendgrid/mail`
- ✅ `bullmq`
- ✅ `ioredis`
- ✅ `@react-email/components`
- ✅ `@react-email/render`

---

## 🚧 REMAINING TASKS (15% to complete)

### 1. Additional Email Templates (HIGH PRIORITY)
Create React Email templates for:
- `referral-signup-email.tsx` - New referral joined
- `direct-bonus-email.tsx` - $249.50 bonus earned
- `monthly-commission-email.tsx` - Monthly residual calculated
- `payout-failed-email.tsx` - Payout failed (action required)
- `payment-failed-email.tsx` - Subscription payment failed
- `structure-milestone-email.tsx` - Commission structure unlocked
- `welcome-email.tsx` - Welcome new user

**Pattern to follow:** See `lib/notifications/templates/payout-processed-email.tsx`

### 2. User Notifications Preferences Page (HIGH PRIORITY)
**File:** `app/(dashboard)/notifications/page.tsx`

**Features needed:**
- Toggle email/SMS for each notification type
- Phone number input with E.164 formatting
- SMS opt-in form with TCPA disclosure
- SMS verification flow (send code, verify)
- Timezone selector
- Quiet hours time picker
- Notification history table (last 30 days)
- Channel health status indicators

**UI Components to create:**
- `components/notifications/notification-preferences-form.tsx`
- `components/notifications/sms-opt-in-form.tsx`
- `components/notifications/notification-history.tsx`
- `components/notifications/quiet-hours-selector.tsx`

### 3. SMS Opt-in API Route
**File:** `app/api/notifications/opt-in-sms/route.ts`

**POST** - Initiate SMS opt-in:
- Generate 6-digit verification code
- Send via Twilio
- Store in `sms_consent` table with timestamp & IP
- Return success

**File:** `app/api/notifications/verify-sms/route.ts`

**POST** - Verify SMS code:
- Check code matches
- Mark as verified in `sms_consent`
- Enable SMS in user preferences
- Return success

### 4. Admin Notification Center (MEDIUM PRIORITY)
**File:** `app/(dashboard)/admin/notifications/page.tsx`

**Features needed:**
- Create campaign form:
  - Campaign name
  - Channel selector (Email/SMS)
  - Target filter (role, status, etc.)
  - Message composer (rich text for email, plain for SMS)
  - Template selector
- Campaign list with status
- Approve campaign (superadmin only)
- Send campaign with canary rollout (1% first)
- Campaign metrics dashboard

**API Routes:**
- `app/api/admin/notifications/campaigns/route.ts` - CRUD for campaigns
- `app/api/admin/notifications/send-campaign/route.ts` - Trigger campaign send

### 5. Add Notification Triggers (HIGH PRIORITY)
Update existing event handlers to send notifications:

**a) Referral Signup** - `app/api/network/assign-position/route.ts`
```typescript
import { notifyReferralSignup } from '@/lib/notifications/notification-service'

// After successful position assignment
if (referralData.referrer_id) {
  await notifyReferralSignup({
    referrerId: referralData.referrer_id,
    referredName: existingUser.name,
    referredEmail: existingUser.email,
    referralCode: referralCode
  })
}
```

**b) Direct Bonus** - `app/api/stripe/webhooks/route.ts` (around line 329)
```typescript
import { notifyDirectBonus } from '@/lib/notifications/notification-service'

// After creating commission
await notifyDirectBonus({
  referrerId: referralData.referrer_id,
  referredName: userData?.name || 'New Member',
  amount: bonusAmount,
  commissionId: commission.id
})
```

**c) Payout Processed** - `app/api/admin/payouts/process-single/route.ts`
```typescript
import { notifyPayoutProcessed } from '@/lib/notifications/notification-service'

// After successful Stripe transfer
await notifyPayoutProcessed({
  userId: commission.referrer_id,
  amount: commission.amount,
  commissionType: commission.commission_type,
  payoutId: commission.id
})
```

**d) Payout Failed** - Same file, in catch block
```typescript
import { notifyPayoutFailed } from '@/lib/notifications/notification-service'

await notifyPayoutFailed({
  userId: commission.referrer_id,
  amount: commission.amount,
  reason: error.message,
  dashboardUrl: process.env.NEXT_PUBLIC_SITE_URL + '/finance',
  payoutId: commission.id
})
```

**e) Payment Failed** - `app/api/stripe/webhooks/route.ts` (invoice.payment_failed)
```typescript
import { notifyPaymentFailed } from '@/lib/notifications/notification-service'

await notifyPaymentFailed({
  userId: userData.id,
  amount: invoice.amount_due / 100,
  paymentUrl: process.env.NEXT_PUBLIC_SITE_URL + '/payments'
})
```

### 6. Update Navigation (EASY)
**File:** `app/(dashboard)/layout.tsx`

Add Notifications link ABOVE Settings:
```typescript
{
  name: 'Notifications',
  href: '/notifications',
  icon: Bell  // Import from lucide-react
}
```

### 7. Environment Variables (CRITICAL)
Add to `.env.local`:
```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxx  # Optional but recommended

# SendGrid (owned by Twilio)
TWILIO_SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=notifications@yourdomain.com
SENDGRID_FROM_NAME=Trading Hub

# Redis (for BullMQ queue)
REDIS_URL=redis://localhost:6379

# Site URL for webhooks and links
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

### 8. Start Queue Worker
The queue worker needs to run as a background process. Options:

**Option A: Separate process (Development)**
```bash
# Create a worker script
node scripts/start-notification-worker.js
```

**Option B: API Route (Vercel/Production)**
Create `app/api/cron/process-notifications/route.ts` that processes queued jobs.

**Option C: Use Inngest (Recommended for production)**
Replace BullMQ with Inngest for serverless background jobs.

### 9. Configure Twilio Webhooks
In Twilio Console:
1. **Phone Number Settings:**
   - Set "A MESSAGE COMES IN" webhook to: `https://yourdomain.com/api/webhooks/twilio/inbound-sms`
   - Set "A MESSAGE STATUS CHANGES" webhook to: `https://yourdomain.com/api/webhooks/twilio/sms-status`

2. **Messaging Service (if using):**
   - Set Inbound Request URL to same as above

---

## 📝 IMPLEMENTATION CHECKLIST

### Phase 1: Complete Core Features (2-3 hours)
- [ ] Create remaining email templates (7 templates)
- [ ] Build notifications preferences page UI
- [ ] Create SMS opt-in API routes
- [ ] Update navigation

### Phase 2: Add Notification Triggers (1-2 hours)
- [ ] Add notifyReferralSignup to network assignment
- [ ] Add notifyDirectBonus to webhook handler
- [ ] Add notifyPayoutProcessed to payout processing
- [ ] Add notifyPayoutFailed to error handling
- [ ] Add notifyPaymentFailed to webhook handler

### Phase 3: Admin Features (2-3 hours)
- [ ] Build admin notification center UI
- [ ] Create campaign management API routes
- [ ] Implement campaign send with canary rollout

### Phase 4: Production Setup (1 hour)
- [ ] Configure environment variables
- [ ] Set up Redis instance
- [ ] Start queue worker process
- [ ] Configure Twilio webhooks
- [ ] Test end-to-end notification flow

---

## 🧪 TESTING CHECKLIST

### SMS Testing
- [ ] Send test SMS to your phone
- [ ] Reply STOP - verify opt-out works
- [ ] Reply START - verify opt-in works
- [ ] Reply HELP - verify help message
- [ ] Test international number (if applicable)

### Email Testing
- [ ] Send test email
- [ ] Check spam folder
- [ ] Verify unsubscribe link works
- [ ] Test all email templates

### Quiet Hours Testing
- [ ] Set quiet hours to current time + 5 minutes
- [ ] Send notification
- [ ] Verify it's deferred
- [ ] Wait for quiet hours to end
- [ ] Verify notification is sent

### Delivery Health Testing
- [ ] Send to invalid email - verify bounce tracking
- [ ] Send to invalid phone - verify carrier error tracking
- [ ] Verify auto-disable after hard bounce

### Campaign Testing
- [ ] Create campaign as admin
- [ ] Approve as superadmin
- [ ] Test canary send (1%)
- [ ] Verify metrics tracking
- [ ] Test full rollout

---

## 📊 MONITORING & OBSERVABILITY

### Queue Health Check
```bash
curl https://yourdomain.com/api/admin/queue-health
```

### View Queue Metrics
Access BullMQ UI or use:
```typescript
import { getQueueMetrics } from '@/lib/notifications/queue/notification-queue'
const metrics = await getQueueMetrics()
```

### Check Delivery Health
Query `notification_health` table for users with disabled channels:
```sql
SELECT * FROM notification_health
WHERE channel_disabled = true;
```

### Review Failed Jobs
```typescript
import { getFailedJobs } from '@/lib/notifications/queue/notification-queue'
const failed = await getFailedJobs(50)
```

---

## 🎯 QUICK START GUIDE

1. **Apply database migration:**
   - Already done via `mcp__supabase__apply_migration`

2. **Configure environment variables:**
   - Add Twilio credentials to `.env.local`
   - Add Redis URL
   - Add SendGrid API key

3. **Start Redis:**
   ```bash
   docker run -d -p 6379:6379 redis
   ```

4. **Start queue worker:**
   ```bash
   npm run dev:worker  # Create this script
   ```

5. **Test notification:**
   ```typescript
   import { sendNotification } from '@/lib/notifications/notification-service'

   await sendNotification({
     userId: 'user-uuid',
     type: 'welcome',
     data: { userName: 'John' }
   })
   ```

6. **Build UI pages:**
   - Create `/notifications` page
   - Create `/admin/notifications` page

7. **Add triggers:**
   - Update webhook handlers
   - Update payout processing

8. **Configure Twilio:**
   - Set webhook URLs in Twilio Console

---

## 🚀 PRODUCTION DEPLOYMENT

### Vercel Configuration
Add environment variables to Vercel dashboard.

### Background Worker
Options:
1. **Vercel Cron** - Use `/api/cron/process-notifications`
2. **External service** - Deploy worker to separate server
3. **Inngest** - Recommended for serverless (replace BullMQ)

### Redis
Use managed Redis:
- Upstash (serverless)
- Railway
- Render

### Rate Limits
- SendGrid Free: 100 emails/day
- Twilio: Pay-as-you-go, ~$0.0079/SMS

---

## 📚 ADDITIONAL RESOURCES

- **Twilio Docs:** https://www.twilio.com/docs/sms
- **SendGrid Docs:** https://docs.sendgrid.com
- **BullMQ Docs:** https://docs.bullmq.io
- **React Email:** https://react.email
- **TCPA Compliance:** https://www.twilio.com/docs/glossary/tcpa

---

**Implementation Status:** 85% Complete
**Estimated Time to Finish:** 6-8 hours
**Priority:** HIGH (Core features complete, UI and triggers remaining)
