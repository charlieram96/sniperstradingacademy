# Setup Instructions: Snipers Trading Academy Default Referral & Network Positions

## What Was Changed

### 1. Created Company User SQL Script
**File:** `setup-company-user.sql`
- Creates "Snipers Trading Academy" as the root organization user
- Assigns root network position: `L000P0000000001`
- Sets referral code: `SNIPERS`
- Includes diagnostic queries to verify setup

### 2. Updated Default Referral API
**File:** `app/api/referral/default/route.ts`
- Now returns "Snipers Trading Academy" as the default referral
- Falls back to first user if company user doesn't exist
- Users will see the company name when signing up

### 3. Enhanced Network Position Assignment
**File:** `app/api/network/assign-position/route.ts`
- Added detailed console logging for debugging
- Extended time window to 60 minutes in development (10 min in production)
- Returns detailed error messages with hints
- Logs all position assignment attempts

### 4. Improved Signup Error Logging
**File:** `app/(auth)/register/page.tsx`
- Added comprehensive console logging for position assignment
- Logs success/failure of network position API calls
- Captures and displays error details in browser console
- Won't block signup if position assignment fails

### 5. Created Diagnostic Tool
**File:** `app/api/debug/check-network-setup/route.ts`
- Checks if network position functions exist
- Verifies company user exists
- Counts users with/without positions
- Provides actionable recommendations
- Access at: `http://localhost:3000/api/debug/check-network-setup`

---

## Setup Steps (IN ORDER)

### Step 1: Run Database Migrations

Open Supabase Dashboard → SQL Editor and run these files **in order**:

**A. First, ensure network position functions exist:**
```sql
-- Check if you've already run this:
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'assign_network_position';

-- If empty, run the ENTIRE file:
-- supabase-network-position-schema.sql
```

**B. Then, create the company user:**
```bash
# Open and run: setup-company-user.sql
```

This will:
- Create Snipers Trading Academy organization user
- Set it as the root of your network
- Verify the setup was successful

### Step 2: Verify Setup

**Visit the diagnostic endpoint:**
```
http://localhost:3000/api/debug/check-network-setup
```

You should see:
- ✅ Network position functions exist
- ✅ Company user exists
- ✅ Position statistics

### Step 3: Test Signup Flow

1. **Go to:** `http://localhost:3000/register`

2. **Expected behavior:**
   - You should see "Snipers Trading Academy" as the default referrer
   - The referral code field should show `SNIPERS`

3. **Create a test account:**
   - Enter email, name, password
   - Click "Create account"
   - Verify email via the verification link

4. **Check browser console (F12):**
   - Look for: `"Attempting to assign network position..."`
   - Look for: `"Network position assigned successfully:"`
   - Should show position ID like: `L001P0000000002`

5. **Verify in Supabase:**
```sql
-- Check the new user has a position
SELECT
  name,
  email,
  network_position_id,
  network_level,
  network_position,
  referred_by
FROM users
WHERE email = 'your-test-email@example.com';

-- Should show:
-- network_position_id: L001P0000000002 (or similar)
-- network_level: 1
-- network_position: 2, 3, or 4 (first 3 positions under root)
-- referred_by: 00000000-0000-0000-0000-000000000000 (company user ID)
```

### Step 4: Check Referral Code Display

1. **Login with your test account**
2. **Go to:** `http://localhost:3000/referrals`
3. **Expected:**
   - Your referral code should be displayed
   - No longer blank!

---

## Troubleshooting

### Problem: Referral code is still blank

**Check browser console on /referrals page:**
```
Error fetching user data: { ... }
```

**Solution:**
Run this SQL to check RLS policies:
```sql
-- Check if user can read their own data
SELECT * FROM users WHERE id = auth.uid();
```

If empty, RLS policy might be blocking. Run:
```sql
-- Ensure users can read their own data
CREATE POLICY IF NOT EXISTS "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);
```

### Problem: Network position not being assigned

**Check the diagnostic endpoint first:**
```
http://localhost:3000/api/debug/check-network-setup
```

**Common issues:**

1. **Functions don't exist:**
   - Run `supabase-network-position-schema.sql`

2. **Time window expired:**
   - In development, you have 60 minutes
   - Create a fresh test account

3. **Company user doesn't exist:**
   - Run `setup-company-user.sql`

4. **Check browser console during signup:**
   - Look for errors in console log
   - Check the `/api/network/assign-position` response

**Detailed error logging:**
All errors are now logged in browser console with:
- Error message
- Error details
- Hints from database

### Problem: "User must have been created within last X minutes"

**Solution:**
- Create a new test account (old accounts can't be assigned positions)
- OR temporarily increase the window in code
- OR manually assign position via SQL:

```sql
SELECT assign_network_position(
  'user-id-here'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid -- Company user ID
);
```

---

## Expected Results

After completing setup:

1. ✅ Default referral shows "Snipers Trading Academy"
2. ✅ New signups automatically get network position assigned
3. ✅ Referral codes display on /referrals page
4. ✅ Network hierarchy is maintained
5. ✅ Browser console shows detailed logging
6. ✅ Diagnostic endpoint confirms all systems operational

---

## Next Steps

1. Run the SQL migrations
2. Test signup with a new account
3. Check the diagnostic endpoint
4. Verify referral code displays
5. Test the full flow from signup to dashboard

---

## Files Modified

**Created:**
- `setup-company-user.sql` - Company user creation script
- `app/api/debug/check-network-setup/route.ts` - Diagnostic tool

**Modified:**
- `app/api/referral/default/route.ts` - Returns company user
- `app/api/network/assign-position/route.ts` - Better error handling
- `app/(auth)/register/page.tsx` - Enhanced logging

**Build Status:** ✅ Successful

---

## Support

If issues persist:
1. Check browser console for errors
2. Visit diagnostic endpoint
3. Check Supabase logs
4. Verify all migrations were run in order
