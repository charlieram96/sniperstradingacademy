# Email Verification Template Setup Guide

This guide will help you configure custom, branded email templates for Trading Hub's email verification system.

---

## Table of Contents

1. [Quick Setup Checklist](#quick-setup-checklist)
2. [Supabase Email Configuration](#supabase-email-configuration)
3. [Custom Email Template](#custom-email-template)
4. [URL Redirect Configuration](#url-redirect-configuration)
5. [Testing Email Verification](#testing-email-verification)
6. [Troubleshooting](#troubleshooting)

---

## Quick Setup Checklist

Before configuring email templates, ensure these are completed:

- [ ] `NEXT_PUBLIC_SITE_URL` is set in `.env.local`
- [ ] Email confirmations are enabled in Supabase Auth settings
- [ ] Redirect URLs are whitelisted in Supabase
- [ ] SMTP is configured (or using Supabase default)

---

## Supabase Email Configuration

### Step 1: Access Email Templates

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select **Confirm signup** template

### Step 2: Enable Email Confirmations

1. Go to **Authentication** → **Settings**
2. Scroll to **Email Auth**
3. Ensure **Enable email confirmations** is **ON**
4. Set **Confirm email** to **enabled**

### Step 3: Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add your site URLs to **Redirect URLs**:
   - Development: `http://localhost:3000/auth/callback**`
   - Production: `https://yourdomain.com/auth/callback**`
   - **Note:** The `**` wildcard allows query parameters

### Step 4: SMTP Configuration (Optional)

For production, configure custom SMTP for better deliverability:

1. Go to **Settings** → **Auth** → **SMTP Settings**
2. Choose provider (SendGrid, AWS SES, Postmark, etc.)
3. Fill in SMTP credentials
4. Enable **Use custom SMTP server**

**Recommended providers:**
- **SendGrid**: Free tier, easy setup
- **AWS SES**: Pay-as-you-go, excellent deliverability
- **Postmark**: Premium, best for transactional emails

---

## Custom Email Template

### Trading Hub Branded Template

Replace the default Supabase template with this branded version:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - Trading Hub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

          <!-- Header with Gold Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #D4AF37 0%, #B8941F 100%); padding: 40px 40px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Trading Hub
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">
                Elite Trading Academy
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 50px 40px;">
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                Verify Your Email Address
              </h2>

              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Welcome to Trading Hub! You're one step away from accessing our elite trading academy.
              </p>

              <p style="margin: 0 0 30px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Click the button below to verify your email and activate your account:
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="{{ .ConfirmationURL }}"
                       style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #B8941F 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #6a6a6a; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>

              <p style="margin: 10px 0 0; padding: 15px; background-color: #f8f8f8; border-radius: 4px; word-break: break-all; font-size: 13px; color: #4a4a4a; font-family: monospace;">
                {{ .ConfirmationURL }}
              </p>

              <!-- What's Next Section -->
              <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e5e5;">
                <h3 style="margin: 0 0 15px; color: #1a1a1a; font-size: 18px; font-weight: 600;">
                  What's Next?
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #4a4a4a; font-size: 14px; line-height: 1.8;">
                  <li>Access expert-led trading courses</li>
                  <li>Join live trading sessions</li>
                  <li>Start earning $250 per referral</li>
                  <li>Build your passive income stream</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #6a6a6a; font-size: 13px; line-height: 1.6;">
                This link will expire in 24 hours for security purposes.
              </p>
              <p style="margin: 0; color: #6a6a6a; font-size: 13px; line-height: 1.6;">
                If you didn't create an account with Trading Hub, you can safely ignore this email.
              </p>

              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
                <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                  © 2024 Trading Hub. All rights reserved.
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Template Variables

Supabase provides these variables for email templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{ .ConfirmationURL }}` | Email verification link | `https://yourdomain.com/auth/callback?code=...` |
| `{{ .SiteURL }}` | Your site URL | `https://yourdomain.com` |
| `{{ .Email }}` | User's email address | `user@example.com` |
| `{{ .Token }}` | Verification token | `abc123...` |

---

## URL Redirect Configuration

### How Redirects Work

1. User clicks verification link in email
2. Supabase processes the verification
3. Redirects to `emailRedirectTo` URL with `code` parameter
4. Your app exchanges the code for a session
5. User is redirected to dashboard

### Code Implementation

The following has already been implemented in the codebase:

**Register Page** (`app/(auth)/register/page.tsx`):
```typescript
const { data: authData, error: authError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${redirectUrl}/auth/callback?next=/dashboard`,
    data: {
      name,
      referred_by: confirmedReferrer?.id,
    },
  },
})
```

**Auth Callback** (`app/auth/callback/route.ts`):
```typescript
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") || "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { data: session, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && session?.user) {
      // User verified, redirect to dashboard
      return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`)
}
```

---

## Testing Email Verification

### Test Checklist

1. **Signup Flow**
   - [ ] Register with a new email
   - [ ] Receive verification email within 1 minute
   - [ ] Email has proper branding
   - [ ] Email contains verification link
   - [ ] Link opens correctly

2. **Verification Link**
   - [ ] Click link in email
   - [ ] Redirected to auth callback
   - [ ] Then redirected to dashboard
   - [ ] User is logged in
   - [ ] Email is marked as verified

3. **Resend Email**
   - [ ] Click "Resend verification email" button
   - [ ] Receive new email
   - [ ] New link works correctly

### Testing in Development

**Option 1: Use Supabase Inbucket (Development)**
1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Scroll down to **Inbucket** section
3. View test emails sent in development

**Option 2: Use Real Email**
1. Use a real email address (your own)
2. Check spam folder if not received
3. Test with multiple email providers (Gmail, Outlook, etc.)

### Testing in Production

1. Create test user account
2. Verify email arrives quickly (< 2 minutes)
3. Check email rendering in different clients:
   - Gmail (web, mobile)
   - Outlook (web, desktop)
   - Apple Mail
   - Mobile devices (iOS, Android)

---

## Troubleshooting

### Problem: Email Not Received

**Possible Causes:**
1. Email confirmations disabled in Supabase
2. SMTP not configured (in production)
3. Email in spam folder
4. Invalid email address

**Solutions:**
1. Check **Authentication** → **Settings** → Enable email confirmations
2. Configure SMTP in **Settings** → **Auth**
3. Check spam/junk folder
4. Verify email format is correct

### Problem: Verification Link Doesn't Work

**Possible Causes:**
1. Redirect URL not whitelisted
2. `emailRedirectTo` not set in code
3. Callback route not implemented
4. Link expired (24 hours)

**Solutions:**
1. Add redirect URL to Supabase: **Authentication** → **URL Configuration**
2. Verify `emailRedirectTo` is set in `signUp()` call
3. Check `/app/auth/callback/route.ts` exists
4. Request new verification email

### Problem: Redirects to Wrong Page

**Possible Causes:**
1. `NEXT_PUBLIC_SITE_URL` not set
2. Callback route logic error
3. Wrong `next` parameter

**Solutions:**
1. Set `NEXT_PUBLIC_SITE_URL` in `.env.local`
2. Check callback route logic in `/app/auth/callback/route.ts`
3. Verify `next=/dashboard` parameter in `emailRedirectTo`

### Problem: User Sees "Email Already Registered"

**Possible Causes:**
1. Email already exists in Supabase
2. User didn't complete verification
3. Duplicate signup attempt

**Solutions:**
1. Check Supabase **Authentication** → **Users**
2. If unverified, delete user and re-register
3. Or resend verification email

### Problem: Email Template Doesn't Update

**Possible Causes:**
1. Template not saved in Supabase
2. Cached template
3. Wrong template selected

**Solutions:**
1. Click **Save** in Supabase email template editor
2. Clear browser cache and test again
3. Verify editing **Confirm signup** template (not others)

---

## Advanced Configuration

### Custom Email Subject

In Supabase email template editor, you can customize the subject line:

```
Verify your email - Welcome to Trading Hub! 🎯
```

### Rate Limiting

Supabase has rate limits for email sending:

- **Free tier**: 3 emails per hour per user
- **Pro tier**: Higher limits, configure in settings

For production, use custom SMTP to avoid rate limits.

### Internationalization

To support multiple languages:

1. Create separate templates for each language
2. Detect user's locale during signup
3. Pass locale in metadata
4. Use conditional logic in template

Example:
```html
{{ if eq .Locale "es" }}
  <h2>Verifica tu correo electrónico</h2>
{{ else }}
  <h2>Verify Your Email Address</h2>
{{ end }}
```

---

## Security Best Practices

1. **HTTPS Only**: Always use HTTPS in production
2. **Expire Links**: Keep default 24-hour expiration
3. **One-Time Use**: Links can only be used once
4. **No Sensitive Data**: Don't include passwords in emails
5. **Verify Domain**: Use proper SPF/DKIM records for custom SMTP

---

## Environment Variables Checklist

Ensure these are set in `.env.local`:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Required for email redirects
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # or https://yourdomain.com

# Optional (for OAuth)
AUTH_GOOGLE_ID=xxx
AUTH_GOOGLE_SECRET=xxx
```

---

## Support

If you encounter issues:

1. Check [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
2. Review server logs for errors
3. Test with Supabase Inbucket (development)
4. Contact Supabase support (for SMTP/deliverability issues)

---

## Changelog

**2024-01-XX - Initial Setup**
- Added custom branded email template
- Configured redirect URLs
- Implemented callback route
- Added resend email functionality
