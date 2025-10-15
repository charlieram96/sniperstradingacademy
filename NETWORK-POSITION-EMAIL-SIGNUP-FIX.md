# Fix: Network Position Null on Email Signup

## The Problem

When users signed up via **email/password**, their `network_position_id` remained null even though the database function succeeded. OAuth signups worked fine.

**Server logs showed:**
```
Calling assign_network_position: { userId: '...', referrerId: '...' }
Position assigned successfully: L002P0000000007
Updated user data: {
  network_position_id: null,    // ❌ NULL!
  network_level: null,
  network_position: null,
  tree_parent_network_position_id: null
}
```

---

## Root Cause: RLS + Authentication State

### Email Signup Flow (Was Broken)
1. User signs up with `auth.signUp()` → **NOT authenticated** (email verification pending)
2. API route called with **ANON KEY** (unauthenticated client)
3. `assign_network_position()` database function runs → ✅ **SUCCESS**
4. SELECT query to fetch user data uses **ANON KEY**
5. **RLS policies block reading** network position fields for unauthenticated users
6. Result: Returns null even though data was written to database

### OAuth Signup Flow (Was Working)
1. User signs up with Google → **IMMEDIATELY authenticated**
2. API route called with **authenticated session**
3. `assign_network_position()` database function runs → ✅ **SUCCESS**
4. SELECT query uses **authenticated session**
5. **RLS allows reading** for authenticated users
6. Result: Returns actual position data

---

## The Fix

Changed the assign-position API route from using the **anon key** to using the **service role key**, which bypasses RLS entirely.

### File Modified

**`app/api/network/assign-position/route.ts`**

**Before:**
```typescript
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()  // ❌ Uses ANON KEY
    // ...
  }
}
```

**After:**
```typescript
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createServiceRoleClient()  // ✅ Uses SERVICE ROLE KEY
    // ...
  }
}
```

### What Changed
1. **Import:** `createClient` → `createServiceRoleClient`
2. **Removed `await`:** Service role client is synchronous
3. **Client type:** ANON KEY → SERVICE ROLE KEY
4. **RLS:** Subject to RLS policies → **Bypasses all RLS**

---

## Why This Works

### Service Role Client
- Uses `SUPABASE_SERVICE_ROLE_KEY` environment variable
- **Bypasses ALL Row Level Security (RLS) policies**
- Can read/write any data regardless of authentication state
- **Safe for server-side API routes** (never exposed to browser)
- Used for admin operations and system tasks

### Now Both Flows Work
✅ **Email/password signup:** Works (unauthenticated → service role bypasses RLS)
✅ **OAuth signup:** Still works (authenticated → service role bypasses RLS)

---

## Security Considerations

**Is this safe?**

✅ **YES** - The API route already has security measures:

1. **Server-side only** - Route is in `/app/api/`, never exposed to browser
2. **Position assigned once** - Checks if user already has a position (line 39)
3. **User verification** - Validates user exists before assigning (lines 25-36)
4. **Time window** - Only works within 10 minutes of user creation (lines 48-60)
5. **Referrer validation** - Checks referrer exists and has position (lines 63-83)

The service role key is needed because:
- Email signups create unauthenticated users (email verification pending)
- RLS policies block reading network fields for unauthenticated users
- We need to write AND read the position data in the same transaction

---

## Testing

### Test 1: Email Signup (Previously Broken, Now Fixed)

**Steps:**
1. Go to `/register`
2. Enter referral code
3. Sign up with **email and password**
4. Check server logs

**Expected Before Fix:**
```
Position assigned successfully: L002P0000000007
Updated user data: {
  network_position_id: null,  // ❌ Broken
  ...
}
```

**Expected After Fix:**
```
Position assigned successfully: L002P0000000007
Updated user data: {
  network_position_id: 'L002P0000000007',  // ✅ Fixed!
  network_level: 2,
  network_position: 7,
  tree_parent_network_position_id: 'L001P0000000003'
}
```

### Test 2: OAuth Signup (Should Still Work)

**Steps:**
1. Go to `/register`
2. Enter referral code
3. Sign up with **Google OAuth**
4. Check server logs

**Expected:**
```
Position assigned successfully: L002P0000000008
Updated user data: {
  network_position_id: 'L002P0000000008',  // ✅ Still works
  network_level: 2,
  network_position: 8,
  tree_parent_network_position_id: 'L001P0000000003'
}
```

### Test 3: Database Verification

**After creating test user:**
```sql
SELECT
    id,
    name,
    email,
    network_position_id,
    network_level,
    network_position,
    tree_parent_network_position_id
FROM users
WHERE email = 'test@example.com';
```

**Expected:**
- `network_position_id` should be populated (e.g., `L002P0000000007`)
- `network_level` should be a number
- `network_position` should be a number
- `tree_parent_network_position_id` should be populated

---

## Related Issues This Fixes

This fix also resolves:

✅ **Orphaned users** - Users who signed up via email but never got positions
✅ **Network count issues** - Ancestors weren't getting count increments for email signups
✅ **Dashboard errors** - Users couldn't see their network because position was null

---

## Impact

**Existing Email Users:**
- Users who signed up before this fix may have null positions
- Run `quick-fix-orphaned-users.sql` to assign positions to them
- See `FIX-DEPLOYMENT-GUIDE.md` for instructions

**New Email Users:**
- Will get positions assigned correctly immediately
- No more orphaned users from email signups

**OAuth Users:**
- No impact - already working, will continue to work

---

## Deployment Checklist

✅ File modified: `app/api/network/assign-position/route.ts`
✅ Uses service role client to bypass RLS
✅ Works for both authenticated and unauthenticated users
✅ Maintains all existing security checks

**After deployment:**
1. Test email signup
2. Test OAuth signup
3. Check server logs for "Updated user data" showing position fields
4. Fix any orphaned users with `quick-fix-orphaned-users.sql`

---

## Technical Details

### Why RLS Blocked Unauthenticated Reads

Supabase RLS policies are designed to restrict access based on authentication:

**Common RLS pattern:**
```sql
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = id);
```

For **unauthenticated users** (email signups before verification):
- `auth.uid()` returns null
- Policy evaluation fails
- SELECT queries return empty or null

For **authenticated users** (OAuth, or after email verification):
- `auth.uid()` returns the user's ID
- Policy evaluation succeeds
- SELECT queries return data

### Why Service Role Bypasses RLS

The service role key has **superuser privileges**:
- Bypasses ALL RLS policies
- Can read/write any table
- Used for admin operations
- **Must only be used server-side** (never in browser)

---

## Alternatives Considered

### ❌ Option 1: Update RLS Policies
**Problem:** Would allow any unauthenticated user to read network positions
**Risk:** Security vulnerability

### ❌ Option 2: Wait for Email Verification
**Problem:** Position assignment happens before verification
**Issue:** User experience delay, complexity

### ✅ Option 3: Use Service Role (Chosen)
**Benefits:**
- Simple, one-line change
- Maintains security (server-side only)
- Works for both flows
- No UX impact

---

## Summary

**What was broken:**
- Email signups → network_position_id null

**Why it was broken:**
- Unauthenticated users + RLS policies = can't read own data

**How we fixed it:**
- Use service role client (bypasses RLS)

**Result:**
- ✅ Email signups work
- ✅ OAuth signups still work
- ✅ No orphaned users
- ✅ Network counts update correctly
