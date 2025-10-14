# OAuth Login Flow Fix - Testing Guide

## What Was Fixed

### Problem
When users clicked "Sign in with Google" on the **login page** with an unregistered Google account:
- Supabase created a new user automatically
- User bypassed the referral signup flow
- User ended up in dashboard without `network_position_id`
- Created orphaned user accounts

### Solution Implemented
1. **Login page** now adds `mode=login` parameter to OAuth redirect
2. **Auth callback** detects login mode and blocks new users
3. **Error handling** shows clear messages when blocked
4. New users are redirected to register page with instructions

## Files Modified

1. `app/(auth)/login/page.tsx` - Added `mode=login` to Google OAuth
2. `app/auth/callback/route.ts` - Added login mode detection and blocking logic
3. `app/(auth)/register/page.tsx` - Added error message display from URL params

## Testing Scenarios

### Test 1: Existing User Login with Google (Should Work)
**Setup:** Use a Google account that's already registered

**Steps:**
1. Go to `/login`
2. Click "Continue with Google"
3. Select your registered Google account
4. Authenticate with Google

**Expected Result:**
- ✅ User is redirected to dashboard
- ✅ User can access all features
- ✅ No errors shown

**If Failed:**
- Check server logs for errors
- Verify user has `referred_by` and `network_position_id` in database

---

### Test 2: New User Login with Google (Should Be Blocked)
**Setup:** Use a Google account that has NEVER been registered

**Steps:**
1. Go to `/login`
2. Click "Continue with Google"
3. Select an unregistered Google account
4. Authenticate with Google

**Expected Result:**
- ✅ User is redirected to `/register?error=account_not_found&message=...`
- ✅ Error message shown: "No account found. Please sign up first."
- ✅ User is NOT signed in
- ✅ User is NOT in database, or if created, was immediately signed out

**If Failed:**
- Check auth callback logs
- Verify mode=login parameter is being sent
- Check if user was created in Supabase Auth

---

### Test 3: New User Signup with Google from Register Page (Should Work)
**Setup:** Use a Google account that has NEVER been registered

**Steps:**
1. Go to `/register`
2. Enter or search for a referral code
3. Confirm the referrer
4. Click "Continue with Google" (NOT email signup)
5. Select an unregistered Google account
6. Authenticate with Google

**Expected Result:**
- ✅ User is redirected to `/complete-signup`
- ✅ Complete signup page processes the pending referral
- ✅ User gets assigned a `network_position_id`
- ✅ User is redirected to dashboard
- ✅ User can access all features

**If Failed:**
- Check if `pending_referral` was stored in localStorage
- Check complete-signup page logs
- Verify position assignment API is working
- Check database functions are deployed (see FIX-DEPLOYMENT-GUIDE.md)

---

### Test 4: Existing User Login via Email/Password (Should Work)
**Setup:** Use email/password credentials of an existing user

**Steps:**
1. Go to `/login`
2. Enter email and password
3. Click "Sign in"

**Expected Result:**
- ✅ User is redirected to dashboard
- ✅ No errors shown

**This should not be affected by the OAuth changes**

---

### Test 5: Email Signup (Should Work)
**Setup:** Use a new email address

**Steps:**
1. Go to `/register`
2. Enter or search for a referral code
3. Confirm the referrer
4. Fill in email signup form (name, email, password)
5. Click "Create account"
6. Verify email via link sent to inbox

**Expected Result:**
- ✅ User receives verification email
- ✅ After clicking link, user is redirected to dashboard
- ✅ User has `network_position_id` assigned
- ✅ User's referrer's network counts are incremented

**This should not be affected by the OAuth changes**

---

## Monitoring for Orphaned Users

After deploying these fixes, you should no longer get orphaned users. To monitor:

### Query to Find Orphaned Users
```sql
SELECT
    id,
    name,
    email,
    created_at,
    referred_by,
    network_position_id
FROM users
WHERE network_position_id IS NULL
ORDER BY created_at DESC;
```

Run this daily for the first week after deployment. If you see new orphaned users:
1. Check the server logs for their signup flow
2. Verify they didn't come from the login page OAuth
3. May indicate a different issue (e.g., position assignment API failing)

### Fix Any Existing Orphaned Users
If you already have orphaned users from before this fix:

1. Run `verify-database-functions.sql` to find them
2. Run `quick-fix-orphaned-users.sql` to assign positions
3. See `FIX-DEPLOYMENT-GUIDE.md` for full instructions

## Server Logs to Watch

When testing, watch for these log messages:

### Success Cases (Login Mode)
```
New OAuth user detected, redirecting to complete-signup
```

### Blocked Cases (Login Mode)
```
Blocking new user from login flow - must sign up first
```
or
```
Blocking incomplete user from login flow
```

### Normal Login
```
(No special logs - user goes straight to dashboard)
```

## Edge Cases to Consider

### Edge Case 1: User starts signup, doesn't complete, then tries login
**Scenario:** User went to register, started OAuth, but closed browser before completing referral

**Expected:**
- User has no `referred_by` or `network_position_id`
- Login with Google should block them
- They must complete signup via register page

### Edge Case 2: User has referral but no network position
**Scenario:** User has `referred_by` but position assignment failed

**Expected:**
- Login should work (they're not completely new)
- But they won't be able to use network features
- Needs manual fix via `quick-fix-orphaned-users.sql`

### Edge Case 3: Browser has pending_referral in localStorage
**Scenario:** User stored referral in localStorage but never completed signup

**Expected:**
- Login should still block them
- Register flow should pick up the stored referral

## Rollback Plan

If the OAuth changes cause issues, you can rollback:

### Quick Rollback
1. Remove `?mode=login` from login page Google OAuth redirect
2. Revert auth callback to previous version
3. Redeploy

### Files to Revert
```bash
git checkout HEAD~1 app/(auth)/login/page.tsx
git checkout HEAD~1 app/auth/callback/route.ts
git checkout HEAD~1 app/(auth)/register/page.tsx
```

## Success Criteria

✅ No new orphaned users created (network_position_id IS NULL)
✅ Existing users can log in with Google
✅ New users are blocked from logging in with Google
✅ New users can sign up with Google from register page
✅ Error messages are clear and helpful
✅ Email signup flow still works

## Next Steps After Testing

1. Monitor orphaned user query for 1 week
2. Fix any existing orphaned users with provided scripts
3. Deploy database functions if not already done (FIX-DEPLOYMENT-GUIDE.md)
4. Consider adding alerting for failed position assignments
5. Document this flow for future team members
