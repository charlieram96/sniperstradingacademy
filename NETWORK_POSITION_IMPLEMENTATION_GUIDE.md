# Network Position System Implementation Guide

## Overview

This guide explains the global ternary tree network position system that has been implemented for your MLM platform. The system assigns each user a unique position in a global tree structure and handles automatic placement, commission distribution, and structure tracking.

## What Has Been Implemented

### 1. Database Schema (`supabase-network-position-schema.sql`)

**New Columns Added to `users` table:**
- `network_position_id` (TEXT, UNIQUE) - Global position ID (e.g., "L000P0000000001")
- `network_level` (INTEGER) - Extracted level for faster queries
- `network_position` (BIGINT) - Extracted position for faster queries
- `tree_parent_network_position_id` (TEXT) - The actual tree parent
- `is_active` (BOOLEAN) - Payment/membership status
- `last_payment_date` (TIMESTAMP)
- `inactive_since` (TIMESTAMP) - When user became inactive

**New Table: `vacant_positions`**
- Tracks positions freed when users lose their spot after 90 days of inactivity

**Key Database Functions:**
- `parse_network_position_id()` - Parse position ID into level and position
- `format_network_position_id()` - Create formatted position ID
- `calculate_child_positions()` - Get 3 child positions for any parent
- `get_parent_position()` - Calculate parent from child position
- `find_available_slot()` - Breadth-first search for first available position
- `get_upline_chain()` - Get all ancestors for commission distribution
- `assign_network_position()` - Assign position to new user
- `count_direct_referrals()` - Count direct referrals for withdrawal eligibility
- `count_network_size()` - Count total and active members in network
- `calculate_user_monthly_earnings()` - Calculate monthly earnings with commission rate
- `distribute_to_upline()` - Distribute contributions to upline chain
- `get_downline_contributors()` - Get all contributors in user's network
- `cleanup_inactive_users()` - Remove users inactive > 90 days

### 2. TypeScript Utilities (`lib/network-positions.ts`)

Client-side utilities for:
- Parsing and formatting network position IDs
- Calculating child/parent positions
- Structure completion calculations
- Commission rate calculations
- Withdrawal eligibility checks
- Position hierarchy operations

### 3. API Endpoints

**`POST /api/network/assign-position`**
- Assigns network position to a user after signup
- Called automatically during registration

**`GET /api/network/position?userId=xxx`**
- Get detailed position information for a user
- Returns: position details, referrer info, tree parent info

**`GET /api/network/stats?userId=xxx`**
- Get comprehensive network statistics
- Returns: network size, structures, earnings, withdrawal eligibility

**`GET /api/network/upline?userId=xxx`**
- Get complete upline chain (all ancestors)
- Returns: All users from current user to root

### 4. Updated Registration Flow

**Email Signup (`app/(auth)/register/page.tsx`):**
1. User enters referral code
2. User completes signup form
3. User record created via Supabase Auth
4. Referral relationship established
5. Network position assigned via API call

**OAuth Signup (`app/(auth)/complete-signup/page.tsx`):**
1. User signs in with Google
2. Referral info retrieved from localStorage
3. User record created
4. Referral relationship established
5. Network position assigned via API call

### 5. Updated Commission System

**Monthly Commission Cron (`app/api/cron/monthly-commissions/route.ts`):**
- Uses `calculate_user_monthly_earnings()` instead of old `calculate_team_pool()`
- Checks withdrawal eligibility (3 direct referrals per structure)
- Distributes earnings based on commission rate (10%-16%)
- Records detailed commission metadata

### 6. Updated Team Page

**Team Dashboard (`app/(dashboard)/team/page.tsx`):**
- Displays network position IDs
- Shows network statistics from API
- Distinguishes between direct referrals and tree children
- Shows structure completion progress

## Network Position ID Format

### Format Specification
```
L{level:3digits}P{position:10digits}
```

### Examples
- Root user: `L000P0000000001`
- Level 1, Position 1: `L001P0000000001`
- Level 5, Position 190: `L005P0000000190`

### Position Calculation Formula

For any parent at position P:
- Child 1: `(P - 1) × 3 + 1`
- Child 2: `(P - 1) × 3 + 2`
- Child 3: `(P - 1) × 3 + 3`

Example: Parent at position 190
- Child 1: (190-1) × 3 + 1 = 568
- Child 2: (190-1) × 3 + 2 = 569
- Child 3: (190-1) × 3 + 3 = 570

## How Placement Works

### New User Signup Flow

1. **User selects referrer** by entering referral code
2. **System finds available slot** in referrer's network:
   - Starts at referrer's position
   - Checks level 1 (3 positions directly below referrer)
   - If full, checks level 2 (9 positions)
   - Continues breadth-first up to 6 levels deep
   - First empty position is assigned
3. **Two relationships are stored:**
   - `referred_by` → Who used whose referral code (for tracking direct referrals)
   - `tree_parent_network_position_id` → Actual parent in tree structure
4. **User receives unique network position ID**

### Example Scenario

Alice (L005P0000000190) has:
- 3 people directly below her (Level 6, positions 568, 569, 570)
- Bob is at position 569

Alice refers Emma:
- Level 6 below Alice is full (positions 568-570 occupied)
- System checks Level 7
- Level 7 positions for Alice's subtree: 1704-1710
- Position 1704 is empty
- Emma gets L007P0000001704
- Emma's tree parent is whoever is at L006P0000000568 (position 1704's parent)
- Emma's direct referrer is Alice

## Commission Structure

### How Commissions Work

Each active user contributes $199/month to **ALL** their ancestors in the upline chain.

### Commission Rates by Structure

- **Structure 1** (1-1,092 members): 10% commission
- **Structure 2** (1,093-2,184 members): 11% commission
- **Structure 3** (2,185-3,276 members): 12% commission
- **Structure 4** (3,277-4,368 members): 13% commission
- **Structure 5** (4,369-5,460 members): 14% commission
- **Structure 6** (5,461-6,552 members): 15% commission

### Withdrawal Requirements

To withdraw earnings from your structures:
- **1 completed structure**: Need 3 direct referrals
- **2 completed structures**: Need 6 direct referrals
- **3 completed structures**: Need 9 direct referrals
- **4 completed structures**: Need 12 direct referrals
- **5 completed structures**: Need 15 direct referrals
- **6 completed structures**: Need 18 direct referrals

### Example Calculation

User has:
- 50 active members in network
- 2 completed structures
- 7 direct referrals

Calculation:
- Monthly contribution: 50 × $199 = $9,950
- Commission rate: 11% (structure 2)
- Gross earnings: $9,950 × 0.11 = $1,094.50
- Can withdraw: YES (has 7 direct referrals, needs 6)
- Monthly payout: $1,094.50

## Deployment Steps

### 1. Database Migration

**There are TWO migration files to run in order:**

#### Step 1a: Run Main Migration
```bash
# Run in Supabase SQL Editor
# File: supabase-network-position-schema.sql
```
This adds:
- New network position columns
- All core functions
- Vacant positions table
- Indexes

#### Step 1b: Run Cleanup Migration
```bash
# Run in Supabase SQL Editor (AFTER step 1a)
# File: supabase-network-position-cleanup.sql
```
This removes:
- Old `direct_referral_slots` column (redundant)
- Old `member_slots` table (redundant)
- Adds helper functions for tree children

**IMPORTANT:** Existing users will have NULL network positions after migration.

### 2. Clear Test Data (CRITICAL!)

```sql
-- ONLY run this if you're ready to start fresh with the principal user
DELETE FROM public.commissions;
DELETE FROM public.payments;
DELETE FROM public.referrals;
DELETE FROM public.subscriptions;
DELETE FROM public.users WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'your-admin-email@example.com');

-- Or, if you want to delete ALL users:
DELETE FROM public.commissions;
DELETE FROM public.payments;
DELETE FROM public.referrals;
DELETE FROM public.subscriptions;
DELETE FROM public.users;
```

### 3. Create Principal User

The first user to sign up will automatically be assigned `L000P0000000001` (the root position).

**To create the principal user manually:**

1. Sign up normally through the registration page
2. The system will detect no existing network positions and assign level 0

### 4. Environment Variables

Ensure these are set in your environment:

```env
# Existing variables
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For cron job authentication
CRON_SECRET=your-cron-secret

# Optional: For admin notifications
ADMIN_EMAIL=admin@yourdomain.com
```

### 5. Test the System

1. **Create test principal user:**
   - Sign up as the first user
   - Verify network_position_id = "L000P0000000001"

2. **Create second user:**
   - Sign up with principal user's referral code
   - Verify network_position_id = "L001P0000000001"

3. **Test position assignment API:**
   ```bash
   curl http://localhost:3000/api/network/position?userId=USER_ID_HERE
   ```

4. **Test stats API:**
   ```bash
   curl http://localhost:3000/api/network/stats?userId=USER_ID_HERE
   ```

5. **Test commission calculation:**
   ```sql
   SELECT * FROM calculate_user_monthly_earnings('user-id-here');
   ```

## Monitoring and Maintenance

### Check Network Integrity

```sql
-- Verify all users have network positions
SELECT COUNT(*) FROM users WHERE network_position_id IS NULL;

-- Check for duplicate positions (should return 0)
SELECT network_position_id, COUNT(*)
FROM users
WHERE network_position_id IS NOT NULL
GROUP BY network_position_id
HAVING COUNT(*) > 1;

-- View network size distribution
SELECT network_level, COUNT(*)
FROM users
WHERE network_position_id IS NOT NULL
GROUP BY network_level
ORDER BY network_level;
```

### Inactive User Cleanup

Set up a monthly cron job to clean up inactive users:

```sql
-- Manual execution
SELECT * FROM cleanup_inactive_users();

-- Or schedule via Supabase Edge Functions
```

### Performance Monitoring

Monitor these queries for performance:
- `find_available_slot()` - Should complete < 100ms for networks up to 10k users
- `get_upline_chain()` - Should complete < 50ms
- `calculate_user_monthly_earnings()` - Should complete < 200ms

## Troubleshooting

### Issue: User doesn't get assigned a position

**Check:**
1. Does the referrer have a network position?
2. Is the referrer's network full (6 levels deep)?
3. Check browser console for API errors

**Fix:**
```sql
-- Manually assign position
SELECT assign_network_position('user-id', 'referrer-id');
```

### Issue: Position calculation seems wrong

**Check:**
```sql
-- Verify position formula
SELECT calculate_child_positions(190); -- Should return [568, 569, 570]

-- Verify parent calculation
SELECT get_parent_position(569); -- Should return 190
```

### Issue: Commission calculation is incorrect

**Check:**
```sql
-- Get detailed earnings breakdown
SELECT * FROM calculate_user_monthly_earnings('user-id');

-- Verify network size
SELECT * FROM count_network_size('L005P0000000190');

-- Check upline chain
SELECT * FROM get_upline_chain('L005P0000000190');
```

## Next Steps

1. **Run the database migration** in Supabase
2. **Clear all test users** (IMPORTANT!)
3. **Create the principal user** (first signup)
4. **Test with a few users** to verify placement algorithm
5. **Monitor performance** as network grows
6. **Set up inactive user cleanup** cron job
7. **Add frontend enhancements** to display network tree visualization

## Additional Features to Consider

1. **Network Tree Visualization**
   - Interactive tree diagram showing user's network
   - Clickable nodes to view member details
   - Color coding for active/inactive members

2. **Real-time Position Tracking**
   - WebSocket updates when new members join
   - Live structure completion progress

3. **Advanced Analytics**
   - Network growth over time
   - Conversion rates by level
   - Earnings projections

4. **Admin Dashboard**
   - View entire network tree
   - Search for positions
   - Manual position adjustment tools

## Support

If you encounter issues or need clarification:

1. Check the verification queries at the end of `supabase-network-position-schema.sql`
2. Review the TypeScript utilities in `lib/network-positions.ts`
3. Test API endpoints individually using curl or Postman
4. Check Supabase logs for database errors

---

**Created:** 2025-10-03
**Version:** 1.0
