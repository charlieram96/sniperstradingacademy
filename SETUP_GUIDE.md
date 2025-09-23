# Snipers Trading Academy - Setup Guide

## Quick Start Checklist

- [ ] Supabase account created
- [ ] Google Cloud account created  
- [ ] Stripe account created
- [ ] Environment variables configured
- [ ] Database initialized
- [ ] Test payment successful

## 1. Supabase Setup (15 minutes)

### Create Project
1. Visit [supabase.com](https://supabase.com)
2. Click **"Start your project"**
3. Sign up with GitHub or email
4. Click **"New Project"**
5. Fill in:
   - Name: `snipers-trading-academy`
   - Database Password: (save this securely!)
   - Region: Choose closest to your users
6. Click **"Create new project"** (takes 2 minutes)

### Get API Keys
1. Once created, go to **Settings** → **API**
2. Copy these values to `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=         # Copy "Project URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Copy "anon public" key
SUPABASE_SERVICE_ROLE_KEY=        # Copy "service_role" key (keep secret!)
```

### Initialize Database
1. Go to **SQL Editor** in Supabase
2. Click **"New query"**
3. Copy ALL contents from `supabase-mlm-schema.sql`
4. Paste and click **"Run"**
5. You should see "Success. No rows returned"

### Enable Email Auth
1. Go to **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. Configure email templates if needed

## 2. Google OAuth Setup (10 minutes)

### Create Google Cloud Project
1. Visit [console.cloud.google.com](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Name: `Snipers Trading Academy`
4. Click **"Create"**

### Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **"External"** user type
3. Fill in:
   - App name: `Snipers Trading Academy`
   - User support email: Your email
   - Developer contact: Your email
4. Click **"Save and Continue"**
5. Skip scopes (use defaults)
6. Add test users if needed
7. Click **"Save and Continue"**

### Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. Application type: **Web application**
4. Name: `Snipers Trading Academy Web`
5. Add Authorized JavaScript origins:
```
http://localhost:3000
https://your-production-domain.com
```
6. Add Authorized redirect URIs:
```
http://localhost:3000/api/auth/callback/google
https://your-production-domain.com/api/auth/callback/google
```
7. Click **"Create"**
8. Copy credentials to `.env.local`:
```bash
AUTH_GOOGLE_ID=         # Copy "Client ID"
AUTH_GOOGLE_SECRET=     # Copy "Client secret"
```

### Link Google to Supabase (Optional)
1. In Supabase go to **Authentication** → **Providers**
2. Enable **Google**
3. Paste your Google Client ID and Secret
4. Copy the callback URL for Google Console

## 3. Stripe Setup (10 minutes)

### Create Stripe Account
1. Visit [stripe.com](https://stripe.com)
2. Click **"Start now"**
3. Create account with email
4. Verify email address

### Get API Keys
1. Go to **Developers** → **API keys**
2. Copy to `.env.local`:
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=   # Copy "Publishable key"
STRIPE_SECRET_KEY=                     # Copy "Secret key" (keep secret!)
```

### Setup Webhook (Local Development)
1. Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (download from stripe.com/docs/cli)
```

2. Login to Stripe CLI:
```bash
stripe login
```

3. Forward webhooks to localhost:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

4. Copy the webhook signing secret shown to `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Setup Webhook (Production)
1. Go to **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Endpoint URL: `https://your-domain.com/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated` 
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
5. Click **"Add endpoint"**
6. Copy signing secret to `.env.local`

## 4. NextAuth Setup (2 minutes)

Generate a secure secret:
```bash
openssl rand -base64 32
```

Add to `.env.local`:
```bash
AUTH_SECRET=your_generated_secret_here
AUTH_URL=http://localhost:3000  # Change for production
```

## 5. Final Configuration

Your complete `.env.local` should look like:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# NextAuth
AUTH_SECRET=your_generated_32_char_secret
AUTH_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google OAuth
AUTH_GOOGLE_ID=xxxxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-...
```

## 6. Test Everything

### Start the application:
```bash
npm run dev
```

### Test Supabase:
1. Go to http://localhost:3000
2. Click **"Sign Up"**
3. Create an account
4. Check Supabase dashboard for new user

### Test Google Login:
1. Click **"Continue with Google"**
2. Select your Google account
3. Should redirect back to dashboard

### Test Stripe Payment:
1. After signup, click **"Unlock Membership ($500)"**
2. Use test card: `4242 4242 4242 4242`
3. Any future expiry date
4. Any 3-digit CVC
5. Should redirect to dashboard with unlocked status

### Test Webhook (keep stripe listen running):
1. Complete a test payment
2. Check terminal for webhook events
3. Verify user status updated in database

## 7. Common Issues & Solutions

### "Invalid API Key" Error
- Double-check all keys are copied correctly
- No extra spaces or quotes
- Restart dev server after changing `.env.local`

### Google Login Not Working
- Ensure redirect URIs match exactly
- Check OAuth consent screen is published
- Verify client ID and secret

### Stripe Webhook Failing
- Ensure `stripe listen` is running for local dev
- Check webhook secret is correct
- Verify endpoint URL matches

### Database Errors
- Run the SQL schema file completely
- Check Supabase service is running
- Verify connection URL is correct

## 8. Production Deployment

### Vercel Deployment
1. Push code to GitHub
2. Connect repo to Vercel
3. Add all environment variables
4. Update `AUTH_URL` to production domain
5. Deploy

### Update Services
1. **Google**: Add production URLs to OAuth
2. **Stripe**: Add production webhook endpoint
3. **Supabase**: Update allowed URLs if needed

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs
2. Check browser console for errors
3. Verify all environment variables
4. Test with the demo account: test@example.com / testpass123

## Next Steps

1. Customize email templates in Supabase
2. Set up Stripe Connect for commission payouts
3. Configure custom domain
4. Enable RLS policies in Supabase
5. Set up monitoring and analytics