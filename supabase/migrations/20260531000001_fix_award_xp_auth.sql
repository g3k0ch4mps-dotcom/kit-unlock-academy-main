-- C-1: Add caller authorization to award_xp (SECURITY DEFINER)
-- Previously: any authenticated user could award arbitrary XP to ANY account via
-- the PostgREST RPC endpoint, because p_user_id was caller-supplied and never
-- checked against auth.uid(). This mirrors the guard already present in
-- reset_session_xp (migration 20260522000001).

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

  -- Caller may only award XP to themselves, unless they are an admin/instructor
  IF auth.uid() != p_user_id AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'instructor')
  ) THEN
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
