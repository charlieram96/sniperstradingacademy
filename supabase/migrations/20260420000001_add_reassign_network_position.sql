-- =============================================
-- Admin "reassign network position" feature
-- Adds audit table + atomic RPC for superadmin+
-- to move leaf users (zero downline) between
-- tree positions.
-- =============================================

-- -----------------------------------------
-- 1. Audit table
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS public.network_position_reassignments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.users(id),
  admin_id                    UUID NOT NULL REFERENCES public.users(id),
  old_position_id             TEXT NOT NULL,
  new_position_id             TEXT NOT NULL,
  old_tree_parent_position_id TEXT,
  new_tree_parent_position_id TEXT NOT NULL,
  old_referred_by             UUID REFERENCES public.users(id),
  new_referred_by             UUID REFERENCES public.users(id),
  reason                      TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_npr_user_id    ON public.network_position_reassignments(user_id);
CREATE INDEX IF NOT EXISTS idx_npr_admin_id   ON public.network_position_reassignments(admin_id);
CREATE INDEX IF NOT EXISTS idx_npr_created_at ON public.network_position_reassignments(created_at DESC);

ALTER TABLE public.network_position_reassignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_reassignments" ON public.network_position_reassignments;
CREATE POLICY "admins_read_reassignments"
  ON public.network_position_reassignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('superadmin', 'superadmin+')
    )
  );
-- No INSERT/UPDATE/DELETE policies: only the SECURITY DEFINER RPC writes here.


-- -----------------------------------------
-- 2. RPC: reassign_network_position
-- -----------------------------------------
CREATE OR REPLACE FUNCTION public.reassign_network_position(
  p_user_id                     UUID,
  p_new_tree_parent_position_id TEXT,
  p_slot                        INTEGER,
  p_new_referred_by             UUID,
  p_admin_id                    UUID,
  p_reason                      TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_admin_role           TEXT;
  v_target               RECORD;
  v_parent               RECORD;
  v_new_level            INTEGER;
  v_new_position         BIGINT;
  v_new_position_id      TEXT;
  v_downline_count       INTEGER;
  v_sponsor_pos_id       TEXT;
  v_ancestor_check       TEXT;
  v_walk_level           INTEGER;
  v_walk_position        BIGINT;
  v_sponsor_found        BOOLEAN := FALSE;
  v_ancestor             RECORD;
  v_old_sponsor          UUID;
  v_sponsor_changed      BOOLEAN;
  v_final_referred_by    UUID;
BEGIN
  -- (1) Admin role: must be superadmin+
  SELECT role::TEXT INTO v_admin_role
  FROM public.users WHERE id = p_admin_id;

  IF v_admin_role IS DISTINCT FROM 'superadmin+' THEN
    RETURN jsonb_build_object('success', FALSE, 'error_code', 'FORBIDDEN');
  END IF;

  -- (2) Self-reassign guard
  IF p_user_id = p_admin_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error_code', 'SELF_REASSIGN');
  END IF;

  -- (3) Lock and fetch target user
  SELECT id,
         network_position_id,
         network_level,
         network_position,
         tree_parent_network_position_id,
         referred_by,
         is_active,
         total_network_count
  INTO v_target
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error_code', 'TARGET_NOT_FOUND');
  END IF;

  -- (4) Zero-downline requirement (direct children AND total_network_count)
  SELECT COUNT(*) INTO v_downline_count
  FROM public.users
  WHERE tree_parent_network_position_id = v_target.network_position_id;

  IF v_downline_count > 0 OR COALESCE(v_target.total_network_count, 0) > 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error_code', 'USER_HAS_DOWNLINE');
  END IF;

  -- (5) Slot validity
  IF p_slot NOT IN (1, 2, 3) THEN
    RETURN jsonb_build_object('success', FALSE, 'error_code', 'INVALID_SLOT');
  END IF;

  -- (6) New parent exists
  SELECT id, network_position_id, network_level, network_position
  INTO v_parent
  FROM public.users
  WHERE network_position_id = p_new_tree_parent_position_id;

  IF v_parent.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error_code', 'PARENT_NOT_FOUND');
  END IF;

  -- (7) Compute new position
  v_new_level       := v_parent.network_level + 1;
  v_new_position    := (v_parent.network_position - 1) * 3 + p_slot;
  v_new_position_id := public.format_network_position_id(v_new_level, v_new_position);

  -- (8) No-op: same position (same parent + slot as current) is rejected.
  -- Must come BEFORE the occupancy check, since the "occupant" is the user themselves.
  IF v_new_position_id = v_target.network_position_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error_code', 'NOOP');
  END IF;

  -- (9) Slot occupancy
  IF public.is_position_occupied(v_new_level, v_new_position) THEN
    RETURN jsonb_build_object('success', FALSE, 'error_code', 'SLOT_OCCUPIED');
  END IF;

  -- Sponsor change detection (null p_new_referred_by means "leave unchanged")
  v_sponsor_changed := p_new_referred_by IS NOT NULL
    AND p_new_referred_by IS DISTINCT FROM v_target.referred_by;

  -- (10) Sponsor must be on the ancestor chain of the new position (inclusive of new parent)
  IF v_sponsor_changed THEN
    SELECT network_position_id INTO v_sponsor_pos_id
    FROM public.users WHERE id = p_new_referred_by;

    IF v_sponsor_pos_id IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'error_code', 'SPONSOR_NOT_ANCESTOR');
    END IF;

    v_walk_level     := v_parent.network_level;
    v_walk_position  := v_parent.network_position;
    v_ancestor_check := v_parent.network_position_id;

    LOOP
      IF v_ancestor_check = v_sponsor_pos_id THEN
        v_sponsor_found := TRUE;
        EXIT;
      END IF;
      IF v_walk_level <= 0 THEN
        EXIT;
      END IF;
      v_walk_position  := public.get_parent_position(v_walk_position);
      v_walk_level     := v_walk_level - 1;
      v_ancestor_check := public.format_network_position_id(v_walk_level, v_walk_position);
    END LOOP;

    IF NOT v_sponsor_found THEN
      RETURN jsonb_build_object('success', FALSE, 'error_code', 'SPONSOR_NOT_ANCESTOR');
    END IF;
  END IF;

  -- (11) Decrement counters on OLD upline chain (before moving)
  FOR v_ancestor IN
    SELECT user_id
    FROM public.get_upline_chain(v_target.network_position_id)
    WHERE user_id IS NOT NULL
      AND user_id <> p_user_id
  LOOP
    UPDATE public.users
    SET total_network_count  = GREATEST(0, total_network_count - 1),
        active_network_count = CASE
          WHEN v_target.is_active THEN GREATEST(0, active_network_count - 1)
          ELSE active_network_count
        END
    WHERE id = v_ancestor.user_id;
  END LOOP;

  -- (12) Apply the move on the target user
  v_old_sponsor       := v_target.referred_by;
  v_final_referred_by := CASE
                           WHEN v_sponsor_changed THEN p_new_referred_by
                           ELSE v_target.referred_by
                         END;

  UPDATE public.users
  SET network_position_id             = v_new_position_id,
      network_level                   = v_new_level,
      network_position                = v_new_position,
      tree_parent_network_position_id = p_new_tree_parent_position_id,
      referred_by                     = v_final_referred_by
  WHERE id = p_user_id;

  -- (13) Increment counters on NEW upline chain
  FOR v_ancestor IN
    SELECT user_id
    FROM public.get_upline_chain(v_new_position_id)
    WHERE user_id IS NOT NULL
      AND user_id <> p_user_id
  LOOP
    UPDATE public.users
    SET total_network_count  = total_network_count + 1,
        active_network_count = CASE
          WHEN v_target.is_active THEN active_network_count + 1
          ELSE active_network_count
        END
    WHERE id = v_ancestor.user_id;
  END LOOP;

  -- (14) Sponsor deltas: direct_referrals_count and active_direct_referrals_count
  IF v_sponsor_changed THEN
    IF v_old_sponsor IS NOT NULL THEN
      UPDATE public.users
      SET direct_referrals_count = GREATEST(0, direct_referrals_count - 1),
          active_direct_referrals_count = CASE
            WHEN v_target.is_active THEN GREATEST(0, active_direct_referrals_count - 1)
            ELSE active_direct_referrals_count
          END
      WHERE id = v_old_sponsor;

      -- Re-evaluate qualification for old sponsor (active count may have dropped)
      PERFORM public.check_qualification_status(v_old_sponsor);
    END IF;

    UPDATE public.users
    SET direct_referrals_count = direct_referrals_count + 1,
        active_direct_referrals_count = CASE
          WHEN v_target.is_active THEN active_direct_referrals_count + 1
          ELSE active_direct_referrals_count
        END
    WHERE id = p_new_referred_by;

    -- Re-evaluate qualification for new sponsor
    PERFORM public.check_qualification_status(p_new_referred_by);
  END IF;

  -- (15) Audit row
  INSERT INTO public.network_position_reassignments (
    user_id, admin_id,
    old_position_id, new_position_id,
    old_tree_parent_position_id, new_tree_parent_position_id,
    old_referred_by, new_referred_by,
    reason
  ) VALUES (
    p_user_id, p_admin_id,
    v_target.network_position_id, v_new_position_id,
    v_target.tree_parent_network_position_id, p_new_tree_parent_position_id,
    v_old_sponsor, v_final_referred_by,
    p_reason
  );

  -- (16) Success envelope
  RETURN jsonb_build_object(
    'success',         TRUE,
    'new_position_id', v_new_position_id,
    'new_level',       v_new_level,
    'new_position',    v_new_position,
    'sponsor_changed', v_sponsor_changed,
    'old_state', jsonb_build_object(
      'position_id',             v_target.network_position_id,
      'level',                   v_target.network_level,
      'position',                v_target.network_position,
      'tree_parent_position_id', v_target.tree_parent_network_position_id,
      'referred_by',             v_target.referred_by
    ),
    'new_state', jsonb_build_object(
      'position_id',             v_new_position_id,
      'level',                   v_new_level,
      'position',                v_new_position,
      'tree_parent_position_id', p_new_tree_parent_position_id,
      'referred_by',             v_final_referred_by
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reassign_network_position(UUID, TEXT, INTEGER, UUID, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reassign_network_position(UUID, TEXT, INTEGER, UUID, UUID, TEXT) TO authenticated;
