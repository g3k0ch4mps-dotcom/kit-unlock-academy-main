-- ============================================================
-- Migration: Split Instructor vs Admin permissions
--
-- Instructors (trainers) are CONTENT AUTHORS: kits, programs, projects,
-- session content, tests, quizzes, certificates. Those tables are already
-- guarded by is_admin_or_instructor(), so no loosening is needed there.
--
-- Admins additionally own the GOVERNANCE / COMMERCE / SECURITY surfaces.
-- Several of those were still using is_admin_or_instructor(), which would let
-- an instructor reach them by calling the API directly even though the UI tab
-- is hidden. This migration locks them to admins only:
--   * Store economy        (store_items)
--   * Device monitoring     (user_devices view-all)
--   * Cross-user XP changes (award_xp / reset_session_xp)
--
-- Already admin-only (left unchanged): unlock_codes management, role
-- management (user_roles + set_user_role), and device revoke.
-- ============================================================

-- 1. Store items: management + viewing inactive items => admin only
DROP POLICY IF EXISTS "Admins can manage store items" ON public.store_items;
CREATE POLICY "Admins can manage store items" ON public.store_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active store items" ON public.store_items;
CREATE POLICY "Anyone can view active store items" ON public.store_items
  FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

-- 2. Device monitoring: view-all => admin only (revoke is already admin only)
DROP POLICY IF EXISTS "Admins can view all devices" ON public.user_devices;
CREATE POLICY "Admins can view all devices" ON public.user_devices
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Cross-user XP award => admin only.
--    Everyone may still award XP to THEMSELVES (normal quiz/session flow);
--    only admins may award XP to another account.
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total INTEGER;
  v_new_level INTEGER;
  v_result JSONB;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Caller may only award XP to themselves, unless they are an admin
  IF auth.uid() != p_user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Reject non-positive amounts and absurd ceilings (defense in depth)
  IF p_amount <= 0 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'Invalid XP amount';
  END IF;

  -- Insert or increment the running total
  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (p_user_id, p_amount, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = public.user_xp.total_xp + p_amount,
    level = public.user_xp.level,
    updated_at = now()
  RETURNING total_xp, level INTO v_new_total, v_new_level;

  -- Recompute level from the new total
  v_new_level := 1;
  IF v_new_total >= 3000 THEN v_new_level := 10;
  ELSIF v_new_total >= 2300 THEN v_new_level := 9;
  ELSIF v_new_total >= 1700 THEN v_new_level := 8;
  ELSIF v_new_total >= 1200 THEN v_new_level := 7;
  ELSIF v_new_total >= 800 THEN v_new_level := 6;
  ELSIF v_new_total >= 500 THEN v_new_level := 5;
  ELSIF v_new_total >= 300 THEN v_new_level := 4;
  ELSIF v_new_total >= 150 THEN v_new_level := 3;
  ELSIF v_new_total >= 50 THEN v_new_level := 2;
  END IF;

  UPDATE public.user_xp SET level = v_new_level WHERE user_id = p_user_id;

  -- Record the transaction
  INSERT INTO public.xp_transactions (user_id, amount, reason, reference_type, reference_id)
  VALUES (p_user_id, p_amount, p_reason, p_reference_type, p_reference_id);

  v_result := jsonb_build_object(
    'total_xp', v_new_total,
    'level', v_new_level
  );

  RETURN v_result;
END;
$$;

-- 4. Cross-user XP reset => admin only.
--    Everyone may still reset their OWN session XP; only admins may reset
--    another account's XP.
CREATE OR REPLACE FUNCTION public.reset_session_xp(
  p_user_id UUID,
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total INTEGER;
  v_new_level INTEGER;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF auth.uid() != p_user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM public.xp_transactions
  WHERE user_id = p_user_id
    AND reference_type = 'session'
    AND reference_id = p_session_id;

  DELETE FROM public.xp_transactions
  WHERE user_id = p_user_id
    AND reference_type = 'session_quiz'
    AND reference_id = p_session_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_new_total
  FROM public.xp_transactions
  WHERE user_id = p_user_id;

  v_new_level := 1;
  IF v_new_total >= 3000 THEN v_new_level := 10;
  ELSIF v_new_total >= 2300 THEN v_new_level := 9;
  ELSIF v_new_total >= 1700 THEN v_new_level := 8;
  ELSIF v_new_total >= 1200 THEN v_new_level := 7;
  ELSIF v_new_total >= 800 THEN v_new_level := 6;
  ELSIF v_new_total >= 500 THEN v_new_level := 5;
  ELSIF v_new_total >= 300 THEN v_new_level := 4;
  ELSIF v_new_total >= 150 THEN v_new_level := 3;
  ELSIF v_new_total >= 50 THEN v_new_level := 2;
  END IF;

  UPDATE public.user_xp
  SET total_xp = v_new_total, level = v_new_level, updated_at = now()
  WHERE user_id = p_user_id;

  v_result := jsonb_build_object(
    'total_xp', v_new_total,
    'level', v_new_level
  );

  RETURN v_result;
END;
$$;
