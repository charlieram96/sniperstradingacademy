-- ============================================
-- ORPHANED USER DETECTION SCRIPT
-- ============================================
-- This script helps identify users who were created
-- but don't have network positions assigned
-- ============================================

-- Find users without network positions
SELECT
    id,
    email,
    name,
    created_at,
    referred_by,
    network_position_id,
    CASE
        WHEN referred_by IS NULL THEN 'No referrer (should be root?)'
        ELSE 'Has referrer but no position'
    END as issue_type,
    EXTRACT(DAY FROM (NOW() - created_at)) as days_ago
FROM public.users
WHERE network_position_id IS NULL
ORDER BY created_at DESC;

-- Count orphaned users by time period
SELECT
    COUNT(*) as total_orphaned,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as last_24h,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_week,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_month
FROM public.users
WHERE network_position_id IS NULL;

-- Check if referrers have positions
SELECT
    u.id as orphaned_user_id,
    u.email as orphaned_user_email,
    u.referred_by as referrer_id,
    r.email as referrer_email,
    r.network_position_id as referrer_position_id,
    CASE
        WHEN r.network_position_id IS NULL THEN 'Referrer also has no position'
        ELSE 'Referrer has position'
    END as referrer_status
FROM public.users u
LEFT JOIN public.users r ON u.referred_by = r.id
WHERE u.network_position_id IS NULL
ORDER BY u.created_at DESC;

-- Summary stats
SELECT
    'Total Users' as metric,
    COUNT(*) as count
FROM public.users
UNION ALL
SELECT
    'Users with Positions' as metric,
    COUNT(*) as count
FROM public.users
WHERE network_position_id IS NOT NULL
UNION ALL
SELECT
    'Users without Positions (Orphaned)' as metric,
    COUNT(*) as count
FROM public.users
WHERE network_position_id IS NULL
UNION ALL
SELECT
    'Root Users (Level 0)' as metric,
    COUNT(*) as count
FROM public.users
WHERE network_level = 0;
