# Trading Hub - Setup Instructions

## Overview
Trading Hub is a Next.js application for options traders to build their network and earn commissions through a multi-level referral system.

## Features
- User authentication with NextAuth
- Stripe payment integration ($200/month subscription)
- 10% commission on direct referrals
- Multi-level referral network tracking
- Dashboard with earnings and network statistics
- Group management with hierarchical view
- Payment and commission tracking

## Setup Requirements

### 1. Supabase Setup
1. Create a new Supabase project at https://supabase.com
2. Run the SQL schema from `supabase-schema.sql` in the SQL editor
3. Get your project URL and keys from Settings > API

### 2. Stripe Setup
1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Dashboard
3. Set up a webhook endpoint for `/api/stripe/webhook`
4. Configure webhook to listen for:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`

### 3. NextAuth Setup
1. Generate a secret: `openssl rand -base64 32`
2. (Optional) Set up Google OAuth in Google Cloud Console

### 4. Environment Variables
Update `.env.local` with your actual values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# NextAuth
AUTH_SECRET=your_generated_auth_secret
AUTH_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Google OAuth (optional)
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
```

## Installation & Running

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
├── app/
│   ├── (auth)/          # Authentication pages
│   ├── (dashboard)/     # Protected dashboard pages
│   ├── api/             # API routes
│   └── page.tsx         # Landing page
├── components/
│   └── ui/              # Reusable UI components
├── lib/
│   ├── auth/            # NextAuth configuration
│   ├── stripe/          # Stripe utilities
│   └── supabase/        # Supabase clients
└── supabase-schema.sql  # Database schema
```

## Key Pages

- `/` - Landing page
- `/login` - User login
- `/register` - User registration (supports referral codes)
- `/dashboard` - Main dashboard with stats
- `/group` - View network members
- `/payments` - Subscription and payment history
- `/referrals` - Manage referral links

## Testing

1. Register a new account
2. Subscribe to activate your account ($200/month)
3. Share your referral link from `/referrals`
4. New users who register with your link become your referrals
5. Earn 10% commission when referrals subscribe

## Deployment

This app can be deployed to Vercel:

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

## Support

For issues or questions, please refer to the documentation or contact support.