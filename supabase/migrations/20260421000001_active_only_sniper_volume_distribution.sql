-- =============================================
-- distribute_to_upline_batch: only ACTIVE ancestors receive sniper volume
-- Previously distributed to the top 9 ancestors regardless of is_active.
-- Now skips inactive users and continues up the chain to find 9 active ones.
-- If fewer than 9 active ancestors exist, distributes to whoever exists.
-- =============================================

CREATE OR REPLACE FUNCTION public.distribute_to_upline_batch(p_user_id uuid, p_amount numeric)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    user_position_id   TEXT;
    distribution_count INTEGER;
BEGIN
    SELECT network_position_id INTO user_position_id
    FROM public.users
    WHERE id = p_user_id;

    IF user_position_id IS NULL THEN
        RETURN 0;
    END IF;

    -- First 9 ACTIVE ancestors (closest first). Inactive ancestors are skipped
    -- and do not consume a slot; the walk continues further up the chain.
    WITH active_ancestors AS (
        SELECT uc.user_id
        FROM public.get_upline_chain(user_position_id) uc
        JOIN public.users u ON u.id = uc.user_id
        WHERE uc.user_id <> p_user_id
          AND u.is_active = TRUE
        ORDER BY uc.network_level DESC
        LIMIT 9
    )
    UPDATE public.users
    SET sniper_volume_current_month = sniper_volume_current_month + p_amount
    WHERE id IN (SELECT user_id FROM active_ancestors);

    GET DIAGNOSTICS distribution_count = ROW_COUNT;

    RETURN distribution_count;
END;
$function$;
