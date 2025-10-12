-- ============================================
-- ROUND-ROBIN: assign_network_position
-- ============================================
-- Updated to use round-robin distribution across 3 branches
-- Ensures even spreading of referrals
-- ============================================

CREATE OR REPLACE FUNCTION public.assign_network_position(
    p_user_id UUID,
    p_referrer_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    new_position_id TEXT;
    new_level INTEGER;
    new_position BIGINT;
    parent_pos_id TEXT;
    referrer_pos_id TEXT;
    referrer_last_branch INTEGER;
    next_branch INTEGER;
    slot_info RECORD;
    ancestors_updated INTEGER;
BEGIN
    -- Check if this is the first user (principal user / root)
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE network_position_id IS NOT NULL) THEN
        -- This is the root user
        new_position_id := 'L000P0000000001';
        new_level := 0;
        new_position := 1;
        parent_pos_id := NULL;

        RAISE NOTICE 'Assigning ROOT position to user %', p_user_id;
    ELSE
        -- Get referrer's position and last referral branch
        IF p_referrer_id IS NULL THEN
            RAISE EXCEPTION 'Referrer is required for non-root users';
        END IF;

        SELECT
            network_position_id,
            COALESCE(last_referral_branch, 1)  -- Default to 1 if NULL
        INTO referrer_pos_id, referrer_last_branch
        FROM public.users
        WHERE id = p_referrer_id;

        IF referrer_pos_id IS NULL THEN
            RAISE EXCEPTION 'Referrer % does not have a network position', p_referrer_id;
        END IF;

        -- Calculate next branch in rotation: 1 → 2 → 3 → 1
        next_branch := (referrer_last_branch % 3) + 1;

        RAISE NOTICE 'Referrer % last branch: %, next branch: %',
            p_referrer_id, referrer_last_branch, next_branch;

        -- Find available slot starting from next_branch
        -- This will try next_branch first, then fallback to other branches if full
        SELECT * INTO slot_info
        FROM public.find_available_slot(
            referrer_pos_id,
            100,  -- max_depth
            next_branch  -- start from this branch
        )
        LIMIT 1;

        IF slot_info IS NULL THEN
            RAISE EXCEPTION 'No available slots in referrer structure (all branches full to depth 100)';
        END IF;

        new_level := slot_info.available_level;
        new_position := slot_info.available_position;
        parent_pos_id := slot_info.parent_position_id;
        new_position_id := public.format_network_position_id(new_level, new_position);

        RAISE NOTICE 'Assigned position % in branch % (tried branch %)',
            new_position_id, slot_info.assigned_branch, next_branch;

        -- Update referrer's last_referral_branch to the branch that was actually used
        -- This could be different from next_branch if there was a fallback
        UPDATE public.users
        SET last_referral_branch = slot_info.assigned_branch
        WHERE id = p_referrer_id;

        RAISE NOTICE 'Updated referrer % last_referral_branch to %',
            p_referrer_id, slot_info.assigned_branch;
    END IF;

    -- Update user with network position
    UPDATE public.users
    SET
        network_position_id = new_position_id,
        network_level = new_level,
        network_position = new_position,
        tree_parent_network_position_id = parent_pos_id
    WHERE id = p_user_id;

    -- INCREMENT TOTAL NETWORK COUNT FOR ALL ANCESTORS
    BEGIN
        SELECT public.increment_upchain_total_count(p_user_id) INTO ancestors_updated;
        RAISE NOTICE 'Network position assigned: %. Updated % ancestors total count.',
            new_position_id, ancestors_updated;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Position assigned but count update failed: %', SQLERRM;
    END;

    RETURN new_position_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENT
-- ============================================

COMMENT ON FUNCTION public.assign_network_position(UUID, UUID) IS
    'Assigns network position using round-robin distribution across 3 branches. Ensures even spreading of referrals. Automatically increments total_network_count for all ancestors.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Test round-robin assignment
-- Assign multiple users under the same referrer and watch branch rotation

/*
-- Example test:
DO $$
DECLARE
    referrer_id UUID := (SELECT id FROM public.users WHERE email = 'sniperstacademy@gmail.com');
    new_user_ids UUID[];
    i INTEGER;
BEGIN
    -- Create 6 test users to see full rotation (1→2→3→1→2→3)
    FOR i IN 1..6 LOOP
        -- Create a new user (simplified - in production use auth.users)
        INSERT INTO public.users (id, email, name)
        VALUES (gen_random_uuid(), 'roundrobin_test_' || i || '@example.com', 'RR Test ' || i)
        RETURNING id INTO new_user_ids[i];

        -- Assign position
        RAISE NOTICE '===== Assigning user % =====', i;
        PERFORM public.assign_network_position(new_user_ids[i], referrer_id);
    END LOOP;

    -- Show results
    RAISE NOTICE '===== Results =====';
    SELECT
        email,
        network_position_id,
        network_level,
        network_position
    FROM public.users
    WHERE id = ANY(new_user_ids)
    ORDER BY created_at;
END $$;
*/

-- Check branch distribution for a referrer
/*
SELECT
    u.network_position_id,
    u.email,
    CASE
        WHEN u.network_position % 3 = 1 THEN 'Branch 1'
        WHEN u.network_position % 3 = 2 THEN 'Branch 2'
        WHEN u.network_position % 3 = 0 THEN 'Branch 3'
    END as branch,
    COUNT(*) OVER (PARTITION BY
        CASE
            WHEN u.network_position % 3 = 1 THEN 1
            WHEN u.network_position % 3 = 2 THEN 2
            ELSE 3
        END
    ) as branch_count
FROM public.users u
WHERE u.tree_parent_network_position_id = 'L000P0000000001'  -- Direct children of root
ORDER BY u.network_position;
*/

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'assign_network_position updated with round-robin distribution!' as message;
