# Production Deployment Checklist

## 🚨 CRITICAL: Fix Google OAuth Redirect to Localhost

### Problem
After Google sign-in, users are redirected to localhost instead of production domain.

### Solution

#### 1. Set Environment Variables in Production
```bash
# These MUST be set in your production environment (Vercel, Railway, etc.)
NEXTAUTH_URL=https://www.sniperstradingacademy.com
AUTH_URL=https://www.sniperstradingacademy.com
```

#### 2. Update Google OAuth Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "APIs & Services" > "Credentials"
4. Click on your OAuth 2.0 Client ID
5. Update these settings:

**Authorized JavaScript origins:**
- `https://www.sniperstradingacademy.com`
- `https://sniperstradingacademy.com`

**Authorized redirect URIs:**
- `https://www.sniperstradingacademy.com/api/auth/callback/google`
- `https://sniperstradingacademy.com/api/auth/callback/google`

#### 3. If Using Vercel
Add this environment variable:
```bash
VERCEL_URL=www.sniperstradingacademy.com
```

#### 4. Generate and Set AUTH_SECRET
```bash
# Generate a new secret
openssl rand -base64 32

# Set in production as:
AUTH_SECRET=<generated-value>
NEXTAUTH_SECRET=<same-generated-value>
```

### Verification Steps
1. After setting environment variables, redeploy your application
2. Clear browser cookies for your domain
3. Test Google sign-in in an incognito window
4. Check the debug endpoint: `https://www.sniperstradingacademy.com/api/auth/debug`

### Common Issues

#### "There was a problem with the server configuration"
- AUTH_SECRET is not set or invalid
- NEXTAUTH_URL doesn't match your production domain

#### Redirects to localhost after OAuth
- NEXTAUTH_URL and AUTH_URL not set in production
- Google OAuth redirect URIs not updated

#### 500 Error on /api/auth/session
- Missing AUTH_SECRET in production
- Database connection issues

### Environment Variables Template
```env
# Authentication (REQUIRED)
AUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_SECRET=<same-as-auth-secret>
NEXTAUTH_URL=https://www.sniperstradingacademy.com
AUTH_URL=https://www.sniperstradingacademy.com

# Google OAuth
AUTH_GOOGLE_ID=<from-google-console>
AUTH_GOOGLE_SECRET=<from-google-console>

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=<your-value>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-value>
SUPABASE_SERVICE_ROLE_KEY=<your-value>

# Stripe (existing)
STRIPE_SECRET_KEY=<your-value>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-value>
STRIPE_WEBHOOK_SECRET=<your-value>
```