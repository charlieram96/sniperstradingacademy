# Production Deployment Guide

## Environment Variables Required

Make sure to set these environment variables in your production environment (Vercel, Railway, etc.):

### Required Environment Variables

```bash
# NextAuth (CRITICAL - Must be set correctly)
AUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://www.sniperstradingacademy.com
AUTH_URL=https://www.sniperstradingacademy.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-key>

# Stripe
STRIPE_SECRET_KEY=<your-stripe-secret-key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>

# Google OAuth (if using)
AUTH_GOOGLE_ID=<your-google-client-id>
AUTH_GOOGLE_SECRET=<your-google-client-secret>
```

## Generate AUTH_SECRET

Run this command to generate a secure AUTH_SECRET:
```bash
openssl rand -base64 32
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add these authorized redirect URIs:
   - `https://www.sniperstradingacademy.com/api/auth/callback/google`
   - `https://sniperstradingacademy.com/api/auth/callback/google` (without www)

## Vercel Deployment

If deploying to Vercel:

1. Add all environment variables in Vercel Dashboard > Settings > Environment Variables
2. Make sure to add them for Production environment
3. Redeploy after adding environment variables

## Common Issues and Fixes

### "There was a problem with the server configuration"
- Check that AUTH_SECRET is set and is a valid base64 string
- Verify NEXTAUTH_URL matches your production URL exactly
- Check that Google OAuth credentials are correct

### Sign out redirects to /undefined
- Ensure AUTH_URL and NEXTAUTH_URL are set to your production domain
- Both should be: `https://www.sniperstradingacademy.com`

### Google Sign-in not working
- Verify redirect URIs in Google Console match exactly
- Check that AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are correct
- Make sure Google+ API is enabled

## Testing Production Locally

To test with production-like settings locally:

1. Create `.env.local` with production values
2. Run: `npm run build && npm run start`
3. Test all auth flows

## Security Checklist

- [ ] AUTH_SECRET is unique and secure (not the example one)
- [ ] All sensitive keys are in environment variables, not in code
- [ ] Database has proper security rules
- [ ] Stripe webhook endpoint is secured
- [ ] HTTPS is enforced