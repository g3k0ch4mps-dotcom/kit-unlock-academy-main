-- SECURITY DEFINER function to reset session XP bypassing RLS
-- Admin calls this when resetting a learner's session

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
  -- Delete XP transactions for this session
  DELETE FROM public.xp_transactions
  WHERE user_id = p_user_id
    AND reference_type = 'session'
    AND reference_id = p_session_id;

  DELETE FROM public.xp_transactions
  WHERE user_id = p_user_id
    AND reference_type = 'session_quiz'
    AND reference_id = p_session_id;

  -- Recalculate total XP from remaining transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_new_total
  FROM public.xp_transactions
  WHERE user_id = p_user_id;

  -- Calculate level
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

  -- Update user_xp
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
