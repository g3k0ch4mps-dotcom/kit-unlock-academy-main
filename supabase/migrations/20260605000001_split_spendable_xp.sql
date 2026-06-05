-- ============================================================
-- Split XP into lifetime (rank/level) vs spendable (currency)
-- ------------------------------------------------------------
-- total_xp     -> LIFETIME XP. Drives level & badges. Only ever
--                 increases (via award_xp). Spending never lowers it.
-- spendable_xp -> SPENDABLE balance. Earned alongside lifetime XP,
--                 spent to unlock sessions and redeem store items.
--
-- This lets learners spend points to unlock the next module
-- (Hack-The-Box style) without demoting their level or losing
-- badges, and keeps the store and module-unlock economies on the
-- same wallet.
-- ============================================================

-- 1. New spendable balance column
ALTER TABLE public.user_xp
  ADD COLUMN IF NOT EXISTS spendable_xp INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing total_xp already reflects past spending, so seed
-- the spendable wallet with the current balance.
UPDATE public.user_xp SET spendable_xp = total_xp WHERE spendable_xp = 0;

-- 2. award_xp now credits BOTH wallets and returns the spendable balance.
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
  v_new_spendable INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Caller may only award XP to themselves, unless admin/instructor
  IF auth.uid() != p_user_id AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'instructor')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_amount <= 0 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'Invalid XP amount';
  END IF;

  -- Credit both the lifetime total and the spendable wallet
  INSERT INTO public.user_xp (user_id, total_xp, spendable_xp, level, updated_at)
  VALUES (p_user_id, p_amount, p_amount, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = public.user_xp.total_xp + p_amount,
    spendable_xp = public.user_xp.spendable_xp + p_amount,
    level = public.user_xp.level,
    updated_at = now()
  RETURNING total_xp, spendable_xp, level INTO v_new_total, v_new_spendable, v_new_level;

  -- Level is derived from LIFETIME xp so spending never demotes
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

  INSERT INTO public.xp_transactions (user_id, amount, reason, reference_type, reference_id)
  VALUES (p_user_id, p_amount, p_reason, p_reference_type, p_reference_id);

  RETURN jsonb_build_object(
    'total_xp', v_new_total,
    'spendable_xp', v_new_spendable,
    'level', v_new_level
  );
END;
$$;

-- 3. spend_xp: atomic check-and-deduct against the spendable wallet only.
--    Lifetime total_xp & level are untouched, so spending never demotes.
CREATE OR REPLACE FUNCTION public.spend_xp(
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
  v_spendable INTEGER;
  v_total INTEGER;
  v_level INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- A learner may only spend their own XP (admins may act on anyone)
  IF auth.uid() != p_user_id AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'instructor')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'Invalid XP amount';
  END IF;

  -- Lock the row so the balance check and deduction are atomic
  SELECT spendable_xp, total_xp, level
    INTO v_spendable, v_total, v_level
  FROM public.user_xp
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_spendable < p_amount THEN
    RAISE EXCEPTION 'Insufficient XP';
  END IF;

  UPDATE public.user_xp
  SET spendable_xp = spendable_xp - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING spendable_xp INTO v_spendable;

  INSERT INTO public.xp_transactions (user_id, amount, reason, reference_type, reference_id)
  VALUES (p_user_id, -p_amount, p_reason, p_reference_type, p_reference_id);

  RETURN jsonb_build_object(
    'total_xp', v_total,
    'spendable_xp', v_spendable,
    'level', v_level
  );
END;
$$;

-- 4. reset_session_xp recomputes BOTH wallets from the transaction ledger.
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
  v_new_spendable INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Remove all ledger entries tied to this session (earns AND the unlock spend)
  DELETE FROM public.xp_transactions
  WHERE user_id = p_user_id
    AND reference_type IN ('session', 'session_quiz')
    AND reference_id = p_session_id;

  -- Lifetime XP = sum of positive entries; spendable = net of all entries
  SELECT COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0),
         COALESCE(SUM(amount), 0)
    INTO v_new_total, v_new_spendable
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
  SET total_xp = v_new_total,
      spendable_xp = v_new_spendable,
      level = v_new_level,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'total_xp', v_new_total,
    'spendable_xp', v_new_spendable,
    'level', v_new_level
  );
END;
$$;
