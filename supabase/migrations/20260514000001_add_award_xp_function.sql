-- Create a SECURITY DEFINER function to award XP bypassing RLS
-- The client calls this via supabase.rpc()
-- All XP math happens server-side to avoid client/server desync

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
  v_current_total INTEGER;
  v_new_total INTEGER;
  v_new_level INTEGER;
  v_result JSONB;
BEGIN
  -- Get current XP (0 if no row yet)
  SELECT COALESCE(total_xp, 0) INTO v_current_total
  FROM public.user_xp
  WHERE user_id = p_user_id;

  -- If no row, insert; else update
  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (p_user_id, p_amount, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = public.user_xp.total_xp + p_amount,
    level = public.user_xp.level,
    updated_at = now()
  RETURNING total_xp, level INTO v_new_total, v_new_level;

  -- Fix level (inline calculation to avoid needing a separate DB function)
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
