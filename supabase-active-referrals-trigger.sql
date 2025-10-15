-- ============================================
-- TRIGGER: Active Direct Referrals Count
-- ============================================
-- Automatically updates active_direct_referrals_count when:
-- - User becomes active (is_active changes FALSE → TRUE)
-- - User becomes inactive (is_active changes TRUE → FALSE)
-- ============================================

-- ============================================
-- FUNCTION: Update Active Direct Referrals Count
-- ============================================

CREATE OR REPLACE FUNCTION update_active_direct_referrals_count()
RETURNS TRIGGER AS $$
DECLARE
    v_referrer_id UUID;
    v_new_active_count INTEGER;
    v_was_qualified BOOLEAN;
    v_is_qualified BOOLEAN;
BEGIN
    -- Only proceed if is_active status changed
    IF (TG_OP = 'UPDATE' AND OLD.is_active = NEW.is_active) OR NEW.referred_by IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the referrer ID
    v_referrer_id := NEW.referred_by;

    -- Recalculate active direct referrals count for the referrer
    -- Count all direct referrals where is_active = TRUE
    SELECT COUNT(*)
    INTO v_new_active_count
    FROM users
    WHERE referred_by = v_referrer_id
    AND is_active = TRUE;

    -- Update the referrer's active_direct_referrals_count
    UPDATE users
    SET active_direct_referrals_count = v_new_active_count
    WHERE id = v_referrer_id
    RETURNING qualified_at IS NOT NULL INTO v_was_qualified;

    -- Check if qualification status should change
    v_is_qualified := v_new_active_count >= 3;

    -- If user just qualified (wasn't before, is now)
    IF NOT v_was_qualified AND v_is_qualified THEN
        UPDATE users
        SET qualified_at = TIMEZONE('utc', NOW())
        WHERE id = v_referrer_id;

        RAISE NOTICE 'User % qualified with % active direct referrals!', v_referrer_id, v_new_active_count;
    END IF;

    -- Log the change
    IF TG_OP = 'UPDATE' THEN
        IF NEW.is_active AND NOT OLD.is_active THEN
            RAISE NOTICE 'User % became ACTIVE - referrer % active count: %', NEW.id, v_referrer_id, v_new_active_count;
        ELSIF NOT NEW.is_active AND OLD.is_active THEN
            RAISE NOTICE 'User % became INACTIVE - referrer % active count: %', NEW.id, v_referrer_id, v_new_active_count;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: On is_active Change
-- ============================================

DROP TRIGGER IF EXISTS trigger_update_active_direct_referrals ON public.users;

CREATE TRIGGER trigger_update_active_direct_referrals
AFTER UPDATE OF is_active ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_active_direct_referrals_count();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION update_active_direct_referrals_count() IS
    'Maintains active_direct_referrals_count by recalculating when a user''s is_active status changes. Also checks and updates qualification status (need 3 active referrals).';

COMMENT ON TRIGGER trigger_update_active_direct_referrals ON public.users IS
    'Fires when is_active changes. Updates referrer''s active_direct_referrals_count and checks qualification.';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓✓✓ ACTIVE REFERRALS TRIGGER DEPLOYED ✓✓✓';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Trigger will now:';
    RAISE NOTICE '  ✓ Track active_direct_referrals_count automatically';
    RAISE NOTICE '  ✓ Update when user becomes active/inactive';
    RAISE NOTICE '  ✓ Auto-qualify users with 3+ active referrals';
    RAISE NOTICE '';
    RAISE NOTICE 'How it works:';
    RAISE NOTICE '  - User pays $500 → is_active = TRUE → referrer''s active count +1';
    RAISE NOTICE '  - User stops paying → is_active = FALSE → referrer''s active count -1';
    RAISE NOTICE '  - Referrer hits 3 active → qualified_at timestamp set';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Run migrate-referral-counts.sql to backfill counts';
    RAISE NOTICE '  2. Test by activating/deactivating a user';
    RAISE NOTICE '  3. Check referrer''s active_direct_referrals_count';
END $$;
