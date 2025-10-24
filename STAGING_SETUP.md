# Staging Environment Setup Guide

This guide will walk you through setting up a complete staging environment for the Snipers Trading Academy platform.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Supabase Staging Project](#phase-1-supabase-staging-project)
4. [Phase 2: Stripe Test Mode Setup](#phase-2-stripe-test-mode-setup)
5. [Phase 3: Vercel Deployment](#phase-3-vercel-deployment)
6. [Phase 4: Testing & Validation](#phase-4-testing--validation)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### Why a Staging Environment?

- **Safe Testing**: Test features before production deployment
- **Data Isolation**: Separate staging and production databases
- **No Real Charges**: Stripe test mode prevents accidental real payments
- **Migration Testing**: Verify database migrations before production
- **Team Collaboration**: Share in-progress features with stakeholders

### Architecture

```
Production:
  ├─ Supabase Production Project
  ├─ Stripe Live Mode
  └─ https://www.sniperstradingacademy.com

Staging:
  ├─ Supabase Staging Project (separate)
  ├─ Stripe Test Mode
  └─ https://staging.sniperstradingacademy.com
      (or tradinghub-staging.vercel.app)

Development:
  ├─ Supabase Production/Staging (your choice)
  ├─ Stripe Test Mode
  └─ http://localhost:3000
```

---

## Prerequisites

Before starting, ensure you have:

- [ ] Vercel account (free tier works)
- [ ] Supabase account
- [ ] Stripe account
- [ ] Git repository pushed to GitHub/GitLab/Bitbucket
- [ ] Access to create new Supabase projects
- [ ] Domain name (optional, for custom staging URL)

---

## Phase 1: Supabase Staging Project

### Step 1: Create New Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Configure:
   - **Name**: `tradinghub-staging` (or similar)
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Same as production for consistency
   - **Pricing Plan**: Free tier is fine for staging

### Step 2: Copy Database Schema

You have two options:

#### Option A: Use Migrations (Recommended)

If you've been tracking migrations:

```bash
# Make sure you have the Supabase CLI installed
npm install -g supabase

# Link to staging project
supabase link --project-ref YOUR_STAGING_PROJECT_REF

# Push existing migrations
supabase db push

# Verify migrations were applied
supabase db diff
```

#### Option B: Manual Schema Copy

1. In **production** Supabase dashboard:
   - Go to **Database → Schema**
   - Select all tables
   - Copy DDL (Create statements)

2. In **staging** Supabase dashboard:
   - Go to **SQL Editor**
   - Paste and execute DDL statements
   - Verify all tables, functions, and triggers were created

### Step 3: Get Staging Credentials

1. In staging project, go to **Settings → API**
2. Copy the following values:

   ```
   Project URL: https://xxxxx.supabase.co
   anon/public key: eyJhbG...
   service_role key: eyJhbG... (keep secret!)
   ```

3. Open `.env.staging` and fill in:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_STAGING_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   ```

### Step 4: Configure Auth Providers

1. In staging Supabase → **Authentication → Providers**
2. For **Email**:
   - Enable email/password auth
   - Set **Site URL**: `https://your-staging-domain.vercel.app`
   - Set **Redirect URLs**: `https://your-staging-domain.vercel.app/**`

3. For **Google OAuth** (if using):
   - Enable Google provider
   - Create new OAuth credentials in [Google Cloud Console](https://console.cloud.google.com)
   - Add authorized redirect: `https://your-staging-domain.vercel.app/auth/callback`
   - Copy Client ID and Secret to `.env.staging`

---

## Phase 2: Stripe Test Mode Setup

### Step 1: Switch to Test Mode

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Toggle **"Test mode"** (top right)
3. You should see "Test mode" indicator

### Step 2: Get Test API Keys

1. Go to **Developers → API keys**
2. Copy:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

3. Add to `.env.staging`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_your_key_here
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
   ```

### Step 3: Create Test Products

You need to recreate your products/prices in test mode:

1. Go to **Products → Add product**
2. Create:
   - **Initial Payment**: $499 one-time payment
   - **Monthly Subscription**: $199/month recurring
   - **Weekly Subscription**: $49.75/week recurring (if using)

3. Copy the Price IDs (start with `price_`)
4. Update your code if needed (or use environment variables for price IDs)

### Step 4: Set Up Staging Webhook

**Important**: You'll configure this AFTER deploying to Vercel in Phase 3.

For now, just note that you'll need to:
1. Create webhook endpoint pointing to: `https://your-staging-domain.vercel.app/api/stripe/webhooks`
2. Enable all 21 webhook events (see list below)

#### Required Webhook Events

```
✓ account.updated
✓ account.application.deauthorized
✓ account.external_account.created
✓ account.external_account.updated
✓ account.external_account.deleted
✓ checkout.session.completed
✓ customer.subscription.created
✓ customer.subscription.updated
✓ customer.subscription.deleted
✓ customer.subscription.paused
✓ invoice.payment_succeeded
✓ invoice.payment_failed
✓ payment_intent.payment_failed
✓ charge.dispute.created
✓ charge.dispute.closed
✓ charge.refunded
✓ payout.paid
✓ payout.failed
✓ payout.canceled
✓ transfer.created
```

### Step 5: Test Credit Cards

Stripe provides test cards for staging:

| Card Number         | Scenario                          |
|---------------------|-----------------------------------|
| 4242 4242 4242 4242 | Success                           |
| 4000 0000 0000 0002 | Declined                          |
| 4000 0000 0000 9995 | Insufficient funds                |
| 4000 0025 0000 3155 | Requires authentication (3D Secure)|

- Any future expiry date (e.g., 12/34)
- Any 3-digit CVC
- Any 5-digit ZIP code

---

## Phase 3: Vercel Deployment

### Step 1: Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New → Project"**
3. Import your Git repository
4. **Important**: Don't deploy yet! We need to configure environments first

### Step 2: Configure Staging Environment

1. In your Vercel project → **Settings → Environment Variables**
2. For each variable in `.env.staging`, add it to Vercel:
   - Select **"Preview"** environment (not Production)
   - Add all staging variables

3. Key variables to set:

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_SITE_URL
   AUTH_SECRET (generate new!)
   AUTH_URL
   NEXTAUTH_URL
   NEXTAUTH_SECRET
   STRIPE_SECRET_KEY (test mode)
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (test mode)
   STRIPE_WEBHOOK_SECRET (configure later)
   NEXT_PUBLIC_ENVIRONMENT=staging
   ```

### Step 3: Create Staging Branch

```bash
# Create staging branch from main
git checkout -b staging

# Push to remote
git push -u origin staging
```

### Step 4: Configure Branch Deployment

1. In Vercel → **Settings → Git**
2. Find **"Production Branch"** → Set to `main`
3. **Preview branches**: Enable for `staging`
4. Vercel will now automatically deploy:
   - `main` branch → Production environment
   - `staging` branch → Preview environment (uses staging env vars)

### Step 5: Get Staging URL

1. Deploy the staging branch:
   ```bash
   git checkout staging
   git push origin staging
   ```

2. Vercel will deploy and give you a URL like:
   ```
   https://tradinghub-git-staging-yourname.vercel.app
   ```

3. Optionally, set a custom domain:
   - Vercel → **Settings → Domains**
   - Add: `staging.sniperstradingacademy.com`
   - Configure DNS as instructed by Vercel

### Step 6: Update Environment Variables with Staging URL

Now that you have the staging URL:

1. Go back to Vercel → **Environment Variables**
2. Update these variables with your actual staging URL:
   ```
   NEXT_PUBLIC_SITE_URL=https://your-actual-staging-url.vercel.app
   AUTH_URL=https://your-actual-staging-url.vercel.app
   NEXTAUTH_URL=https://your-actual-staging-url.vercel.app
   ```

3. Redeploy to apply changes:
   - Go to **Deployments**
   - Click on latest deployment → **⋯ → Redeploy**

### Step 7: Complete Stripe Webhook Setup

Now configure the webhook you noted in Phase 2:

1. Stripe Dashboard (Test mode) → **Developers → Webhooks**
2. Click **"Add endpoint"**
3. **Endpoint URL**: `https://your-staging-url.vercel.app/api/stripe/webhooks`
4. **Events**: Select all 21 events listed in Phase 2
5. Click **"Add endpoint"**
6. Copy the **"Signing secret"** (starts with `whsec_`)
7. Add to Vercel environment variables:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_your_staging_webhook_secret
   ```
8. Redeploy again to apply webhook secret

---

## Phase 4: Testing & Validation

### Checklist

#### Database & Auth
- [ ] Can create new account in staging
- [ ] Email verification works (check Supabase auth logs)
- [ ] Can log in with password
- [ ] Google OAuth works (if configured)
- [ ] 2FA enrollment works
- [ ] 2FA verification works
- [ ] Back button doesn't bypass 2FA

#### Payments
- [ ] Can access Stripe checkout for $499 initial payment
- [ ] Test card payment succeeds (4242...)
- [ ] User gets activated after payment
- [ ] Network position assigned correctly
- [ ] Referral bonus created ($249.50)
- [ ] Can create subscription ($199/month)
- [ ] Subscription payment succeeds
- [ ] User remains active with subscription

#### Webhooks
- [ ] All webhooks appear in Stripe dashboard as "Succeeded"
- [ ] Check Vercel logs → **Deployments → Latest → Functions**
- [ ] Search for webhook logs
- [ ] Verify no errors in webhook processing

#### Network Features
- [ ] Dashboard shows correct network data
- [ ] Can view team members
- [ ] Network visualizer works
- [ ] Upline chain displays correctly

#### Admin Features
- [ ] Can access admin panel (as superadmin)
- [ ] Network view loads
- [ ] Can modify user bypasses
- [ ] Payouts panel loads

### Test Stripe Webhook

You can send test webhooks from Stripe:

1. Stripe Dashboard → **Developers → Webhooks**
2. Click on your staging webhook
3. Click **"Send test webhook"**
4. Select event type (e.g., `invoice.payment_succeeded`)
5. Click **"Send test event"**
6. Check Vercel logs for processing

---

## Troubleshooting

### Common Issues

#### 1. "Invalid redirect URL" after login

**Problem**: Supabase auth redirect doesn't match

**Solution**:
1. Go to Supabase → **Authentication → URL Configuration**
2. Add your staging URL to **Redirect URLs**:
   ```
   https://your-staging-url.vercel.app/**
   ```

#### 2. Stripe webhooks failing

**Problem**: Webhook signature verification fails

**Solution**:
1. Verify `STRIPE_WEBHOOK_SECRET` matches webhook signing secret
2. Check Vercel logs for exact error message
3. Ensure webhook points to correct URL (no typos)
4. Redeploy after adding webhook secret

#### 3. Database queries failing

**Problem**: RLS policies block service role

**Solution**:
1. Check if you're using service role client for admin operations
2. Verify service role key is correct
3. Check Supabase logs → **Logs → Database**

#### 4. 2FA not working

**Problem**: QR code doesn't scan or codes rejected

**Solution**:
1. Ensure server time is correct (Vercel handles this)
2. Check if using proper TOTP app (Google Authenticator, Authy)
3. Verify codes in Supabase → **Authentication → Users** → User details

#### 5. Build fails on Vercel

**Problem**: TypeScript or build errors

**Solution**:
```bash
# Test build locally first
npm run build

# Fix any errors, then push
git add .
git commit -m "Fix build errors"
git push origin staging
```

---

## Workflow

### Day-to-Day Development

```bash
# Develop features locally
git checkout -b feature/new-feature
# ... make changes ...
npm run dev

# When ready for staging
git checkout staging
git merge feature/new-feature
git push origin staging
# → Auto-deploys to staging environment

# Test in staging
# → Run through testing checklist

# When validated, merge to production
git checkout main
git merge staging
git push origin main
# → Auto-deploys to production
```

### Database Migrations

```bash
# Create migration locally
supabase migration new feature_name

# Test locally
supabase db reset

# Apply to staging
supabase link --project-ref STAGING_REF
supabase db push

# After validation, apply to production
supabase link --project-ref PRODUCTION_REF
supabase db push
```

---

## Security Best Practices

1. **Never** use production Supabase keys in staging
2. **Never** use Stripe live mode keys in staging
3. **Always** generate a new `AUTH_SECRET` for each environment
4. **Don't** commit `.env.staging` or `.env.production` to Git
5. **Do** use different webhook signing secrets per environment
6. **Enable** Vercel deployment protection (Settings → Deployment Protection)
7. **Limit** who has access to staging environment variables

---

## Quick Reference

### Environment URLs

| Environment | URL | Database | Stripe |
|-------------|-----|----------|--------|
| Development | localhost:3000 | Staging/Prod | Test Mode |
| Staging | staging.domain.com | Staging | Test Mode |
| Production | www.domain.com | Production | Live Mode |

### Key Differences

| Aspect | Staging | Production |
|--------|---------|------------|
| Supabase Project | Separate | Separate |
| Stripe Mode | Test | Live |
| Data | Test/Fake | Real |
| Branch | `staging` | `main` |
| Users | Internal team | Real customers |

---

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Check Supabase database logs
3. Check Stripe webhook logs
4. Review this guide's troubleshooting section
5. Check Next.js, Supabase, or Stripe documentation

---

## Next Steps

After setting up staging:

- [ ] Set up automated database backups (Supabase has this built-in)
- [ ] Configure monitoring/error tracking (Sentry, LogRocket, etc.)
- [ ] Set up CI/CD tests before staging deployment
- [ ] Document any staging-specific test scenarios
- [ ] Share staging URL with team members
- [ ] Create test user accounts for QA

---

**Happy Testing!** 🚀

Your staging environment is now a safe sandbox for validating changes before they reach your customers.
