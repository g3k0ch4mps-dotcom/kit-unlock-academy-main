-- ============================================================
-- Unlock Codes v2
-- ------------------------------------------------------------
-- - scope: a code unlocks a whole PROGRAM or specific SESSIONS
-- - rolling, per-student access expiry (access_days)
-- - single-use / multi-use / unlimited (max_uses + uses_count)
-- - atomic, server-side redemption (redeem_unlock_code)
--
-- Backward compatible: existing codes default to scope='program',
-- single-use (max_uses=1), permanent access (access_days NULL).
-- Existing access rows stay permanent (expires_at NULL).
-- ============================================================

-- 1. Extend the code "template" --------------------------------
ALTER TABLE public.unlock_codes
  ADD COLUMN IF NOT EXISTS scope       TEXT NOT NULL DEFAULT 'program',
  ADD COLUMN IF NOT EXISTS access_days INTEGER,                 -- NULL = permanent
  ADD COLUMN IF NOT EXISTS max_uses    INTEGER DEFAULT 1,       -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS uses_count  INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.unlock_codes DROP CONSTRAINT IF EXISTS unlock_codes_scope_check;
ALTER TABLE public.unlock_codes
  ADD CONSTRAINT unlock_codes_scope_check CHECK (scope IN ('program', 'sessions'));

-- Seed uses_count from the legacy is_used flag
UPDATE public.unlock_codes SET uses_count = 1 WHERE is_used = true AND uses_count = 0;

-- 2. Which sessions a scope='sessions' code unlocks ------------
CREATE TABLE IF NOT EXISTS public.unlock_code_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_code_id UUID REFERENCES public.unlock_codes(id) ON DELETE CASCADE NOT NULL,
  session_id     UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (unlock_code_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_unlock_code_sessions_code ON public.unlock_code_sessions(unlock_code_id);

-- 3. Per-student, per-session access grant (the heart of v2) ----
CREATE TABLE IF NOT EXISTS public.user_session_access (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id     UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  source         TEXT NOT NULL DEFAULT 'code',   -- 'code' | 'xp' | 'admin'
  unlock_code_id UUID REFERENCES public.unlock_codes(id) ON DELETE SET NULL,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,                    -- NULL = permanent
  UNIQUE (user_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_user_session_access_user ON public.user_session_access(user_id);

-- 4. Whole-program grants can now expire too -------------------
ALTER TABLE public.user_program_access
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;  -- NULL = permanent

-- 5. Redemption ledger (audit + per-user dedupe + multi-use count)
CREATE TABLE IF NOT EXISTS public.code_redemptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_code_id    UUID REFERENCES public.unlock_codes(id) ON DELETE CASCADE NOT NULL,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  redeemed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_expires_at TIMESTAMPTZ,
  UNIQUE (unlock_code_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_code_redemptions_user ON public.code_redemptions(user_id);

-- 6. RLS -------------------------------------------------------
ALTER TABLE public.unlock_code_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_session_access  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_redemptions     ENABLE ROW LEVEL SECURITY;

-- Admins manage the code->session links; the redeem RPC (SECURITY DEFINER) reads them.
DROP POLICY IF EXISTS "Admins manage code sessions" ON public.unlock_code_sessions;
CREATE POLICY "Admins manage code sessions" ON public.unlock_code_sessions
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- Users read their own grants; grants are written only by the RPC or admins.
DROP POLICY IF EXISTS "Users view own session access" ON public.user_session_access;
CREATE POLICY "Users view own session access" ON public.user_session_access
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins manage session access" ON public.user_session_access;
CREATE POLICY "Admins manage session access" ON public.user_session_access
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

DROP POLICY IF EXISTS "Users view own redemptions" ON public.code_redemptions;
CREATE POLICY "Users view own redemptions" ON public.code_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all redemptions" ON public.code_redemptions;
CREATE POLICY "Admins view all redemptions" ON public.code_redemptions
  FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

-- 7. Atomic redemption ----------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_unlock_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             UUID := auth.uid();
  v_code            public.unlock_codes;
  v_access_expires  TIMESTAMPTZ;
  v_program_id      UUID;
  v_session_titles  TEXT[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Lock the code row so use-counting is race-free for multi-use codes
  SELECT * INTO v_code FROM public.unlock_codes WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Redemption window: a hard stop on the code itself
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  -- One redemption per user
  IF EXISTS (SELECT 1 FROM public.code_redemptions
             WHERE unlock_code_id = v_code.id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  -- Uses exhausted? (max_uses NULL = unlimited)
  IF v_code.max_uses IS NOT NULL AND v_code.uses_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'used_up');
  END IF;

  -- Rolling per-student access window
  v_access_expires := CASE
    WHEN v_code.access_days IS NOT NULL
    THEN now() + (v_code.access_days::text || ' days')::interval
    ELSE NULL
  END;

  IF v_code.scope = 'sessions' THEN
    INSERT INTO public.user_session_access (user_id, session_id, source, unlock_code_id, expires_at)
    SELECT v_uid, ucs.session_id, 'code', v_code.id, v_access_expires
    FROM public.unlock_code_sessions ucs
    WHERE ucs.unlock_code_id = v_code.id
    ON CONFLICT (user_id, session_id) DO UPDATE SET
      -- extend access: keep permanent if either side is permanent, else the later date
      expires_at = CASE
        WHEN user_session_access.expires_at IS NULL OR EXCLUDED.expires_at IS NULL THEN NULL
        ELSE GREATEST(user_session_access.expires_at, EXCLUDED.expires_at)
      END,
      source = 'code',
      unlock_code_id = EXCLUDED.unlock_code_id,
      granted_at = now();

    SELECT s.program_id, array_agg(s.title ORDER BY s.session_order)
      INTO v_program_id, v_session_titles
    FROM public.unlock_code_sessions ucs
    JOIN public.sessions s ON s.id = ucs.session_id
    WHERE ucs.unlock_code_id = v_code.id
    GROUP BY s.program_id
    LIMIT 1;
  ELSE
    v_program_id := v_code.program_id;
    IF v_program_id IS NULL AND v_code.kit_id IS NOT NULL THEN
      SELECT id INTO v_program_id FROM public.programs WHERE kit_id = v_code.kit_id LIMIT 1;
    END IF;

    IF v_program_id IS NOT NULL THEN
      INSERT INTO public.user_program_access (user_id, program_id, unlock_code_id, expires_at)
      VALUES (v_uid, v_program_id, v_code.id, v_access_expires)
      ON CONFLICT (user_id, program_id) DO UPDATE SET
        expires_at = CASE
          WHEN user_program_access.expires_at IS NULL OR EXCLUDED.expires_at IS NULL THEN NULL
          ELSE GREATEST(user_program_access.expires_at, EXCLUDED.expires_at)
        END,
        unlock_code_id = EXCLUDED.unlock_code_id;
    END IF;
  END IF;

  -- Optional XP reward
  IF v_code.xp_reward IS NOT NULL AND v_code.xp_reward > 0 THEN
    PERFORM public.award_xp(v_uid, v_code.xp_reward, 'Redeemed code: ' || v_code.code, 'redeem_code', v_code.id);
  END IF;

  INSERT INTO public.code_redemptions (unlock_code_id, user_id, access_expires_at)
  VALUES (v_code.id, v_uid, v_access_expires);

  UPDATE public.unlock_codes SET
    uses_count  = uses_count + 1,
    is_used     = CASE WHEN max_uses IS NOT NULL AND uses_count + 1 >= max_uses THEN true ELSE is_used END,
    redeemed_by = COALESCE(redeemed_by, v_uid),
    redeemed_at = COALESCE(redeemed_at, now())
  WHERE id = v_code.id;

  RETURN jsonb_build_object(
    'ok', true,
    'scope', v_code.scope,
    'program_id', v_program_id,
    'session_titles', COALESCE(to_jsonb(v_session_titles), '[]'::jsonb),
    'xp_reward', v_code.xp_reward,
    'access_expires_at', v_access_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_unlock_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_unlock_code(TEXT) TO authenticated;
