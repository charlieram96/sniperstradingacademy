-- ============================================
-- SNIPERS TRADING ACADEMY COMPANY USER SETUP
-- ============================================
-- This creates the root organization user that serves as:
-- 1. Default referral option for new signups
-- 2. Root of the network position tree (L000P0000000001)
-- 3. Company branding for the MLM system
-- ============================================

-- Step 1: Create the company user
INSERT INTO public.users (
  id,
  email,
  name,
  referral_code,
  network_position_id,
  network_level,
  network_position,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- Special UUID for company
  'company@sniperstradingacademy.com',
  'Snipers Trading Academy',
  'SNIPERS',                               -- Easy to remember referral code
  'L000P0000000001',                       -- Root position in network
  0,                                        -- Level 0 (root)
  1,                                        -- Position 1 (first position)
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  referral_code = EXCLUDED.referral_code,
  network_position_id = EXCLUDED.network_position_id,
  network_level = EXCLUDED.network_level,
  network_position = EXCLUDED.network_position,
  updated_at = NOW();

-- Step 2: Verify the company user was created
SELECT
  id,
  email,
  name,
  referral_code,
  network_position_id,
  network_level,
  network_position,
  created_at
FROM public.users
WHERE id = '00000000-0000-0000-0000-000000000000';

-- Step 3: Check if network position functions exist
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'assign_network_position',
    'find_available_slot',
    'calculate_child_positions',
    'format_network_position_id',
    'parse_network_position_id'
  )
ORDER BY routine_name;

-- Step 4: Count users with and without network positions
SELECT
  COUNT(*) FILTER (WHERE network_position_id IS NOT NULL) as users_with_position,
  COUNT(*) FILTER (WHERE network_position_id IS NULL) as users_without_position,
  COUNT(*) as total_users
FROM public.users;

-- Step 5: Verify referral code is unique
SELECT COUNT(*) as duplicate_count
FROM public.users
WHERE referral_code = 'SNIPERS';
-- Should return 1 (only the company user)

-- ============================================
-- NOTES:
-- ============================================
-- After running this script:
-- 1. The company user will be the root of your network
-- 2. All new users can be referred by "SNIPERS" code
-- 3. The default referral API will return this user
-- 4. Network positions will be assigned relative to this root
--
-- If you see errors about missing functions, you need to run:
-- - supabase-network-position-schema.sql
-- ============================================
