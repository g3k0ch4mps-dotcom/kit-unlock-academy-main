-- ============================================================
-- Membership Gate (invite-only access)
-- ------------------------------------------------------------
-- Signing in is necessary but NOT sufficient. An account is one
-- of three states:
--   pending  - account exists but has never redeemed a key  -> sees nothing
--   active   - redeemed a key (or admin-activated)           -> normal access
--   blocked  - admin kill-switch                             -> denied everything
--
-- Enforcement is layered:
--   1. is_member(uid)            -> the single membership predicate
--   2. content_blocks RLS        -> only members read lesson content
--   3. catalog RLS (kits/programs/sessions) -> only members enumerate
--   4. redeem activates          -> first successful redemption flips
--                                   pending -> active
--   5. set_account_status RPC    -> admin block / unblock / activate
--
-- Staff (admin/instructor) always bypass the gate.
-- New accounts are born 'pending'; they only exist via the
-- register-with-key edge function (public sign-up is disabled).
-- ============================================================

-- 1. Account status on profiles -------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS activated_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending', 'active', 'blocked'));

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Backfill: every account that predates the gate is grandfathered in as
-- active (there are only testers today), and staff are always active.
UPDATE public.profiles
   SET status = 'active', activated_at = COALESCE(activated_at, now())
 WHERE status = 'pending';

UPDATE public.profiles p
   SET status = 'active', activated_at = COALESCE(activated_at, now())
 WHERE EXISTS (
   SELECT 1 FROM public.user_roles ur
   WHERE ur.user_id = p.user_id AND ur.role IN ('admin', 'instructor')
 );

-- 2. The membership predicate ---------------------------------
CREATE OR REPLACE FUNCTION public.is_member(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_uid IS NOT NULL
    AND (
      public.is_admin_or_instructor(p_uid)
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = p_uid AND status = 'active'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member(UUID) TO authenticated, anon, service_role;

-- 3. Content access now requires active membership ------------
-- Rewrites can_access_session: a non-staff user must be an active member
-- for ANY content (free or paid). Logged-out visitors keep free preview.
CREATE OR REPLACE FUNCTION public.can_access_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Staff (authoring / preview) always pass
    public.is_admin_or_instructor(auth.uid())
    -- Active members: free, or an active program/session grant
    OR (
      public.is_member(auth.uid())
      AND (
        EXISTS (
          SELECT 1 FROM public.sessions s
          WHERE s.id = p_session_id AND s.is_free = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.sessions s
          JOIN public.user_program_access upa ON upa.program_id = s.program_id
          WHERE s.id = p_session_id
            AND upa.user_id = auth.uid()
            AND (upa.expires_at IS NULL OR upa.expires_at > now())
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_session_access usa
          WHERE usa.session_id = p_session_id
            AND usa.user_id = auth.uid()
            AND (usa.expires_at IS NULL OR usa.expires_at > now())
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_session(UUID) TO authenticated, anon;

-- content_blocks: free preview is for ANONYMOUS visitors only; once you
-- authenticate you must be an active member to read anything.
DROP POLICY IF EXISTS "View free content" ON public.content_blocks;
DROP POLICY IF EXISTS "Users can view free content" ON public.content_blocks;
DROP POLICY IF EXISTS "Users can view unlocked content" ON public.content_blocks;
DROP POLICY IF EXISTS "View accessible content" ON public.content_blocks;

CREATE POLICY "Anon can preview free content" ON public.content_blocks
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = content_blocks.session_id AND s.is_free = true
  ));

CREATE POLICY "Members view accessible content" ON public.content_blocks
  FOR SELECT TO authenticated
  USING (public.can_access_session(content_blocks.session_id));

-- 4. Catalog tables: only members may enumerate ---------------
-- (The public Landing page uses static data, so this doesn't affect marketing.)
DROP POLICY IF EXISTS "Anyone can view kits" ON public.kits;
DROP POLICY IF EXISTS "Members can view kits" ON public.kits;
CREATE POLICY "Members can view kits" ON public.kits
  FOR SELECT TO authenticated USING (public.is_member(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view programs" ON public.programs;
DROP POLICY IF EXISTS "Members can view programs" ON public.programs;
CREATE POLICY "Members can view programs" ON public.programs
  FOR SELECT TO authenticated USING (public.is_member(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view sessions" ON public.sessions;
DROP POLICY IF EXISTS "Members can view sessions" ON public.sessions;
CREATE POLICY "Members can view sessions" ON public.sessions
  FOR SELECT TO authenticated USING (public.is_member(auth.uid()));

-- 5. Redemption activates the account -------------------------
-- Refactor: the heavy lifting moves into redeem_unlock_code_for(code, uid)
-- so BOTH the in-app redeem (auth.uid()) and the register-with-key edge
-- function (service role, explicit uid) share one code path.
CREATE OR REPLACE FUNCTION public.redeem_unlock_code_for(p_code TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             UUID := p_user_id;
  v_code            public.unlock_codes;
  v_access_expires  TIMESTAMPTZ;
  v_program_id      UUID;
  v_session_titles  TEXT[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_code FROM public.unlock_codes WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF EXISTS (SELECT 1 FROM public.code_redemptions
             WHERE unlock_code_id = v_code.id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.uses_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'used_up');
  END IF;

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

  -- Redeeming a key activates a pending account (never un-blocks a blocked one).
  UPDATE public.profiles
     SET status = 'active', activated_at = COALESCE(activated_at, now())
   WHERE user_id = v_uid AND status = 'pending';

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

REVOKE ALL ON FUNCTION public.redeem_unlock_code_for(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_unlock_code_for(TEXT, UUID) TO service_role;

-- The in-app redeem RPC is now a thin wrapper around the shared path.
CREATE OR REPLACE FUNCTION public.redeem_unlock_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN public.redeem_unlock_code_for(p_code, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_unlock_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_unlock_code(TEXT) TO authenticated;

-- 6. Admin block / unblock / activate -------------------------
CREATE OR REPLACE FUNCTION public.set_account_status(
  p_target UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change account status';
  END IF;

  IF p_status NOT IN ('pending', 'active', 'blocked') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  -- Never let an admin lock themselves out
  IF p_target = auth.uid() AND p_status <> 'active' THEN
    RAISE EXCEPTION 'You cannot block or deactivate your own account';
  END IF;

  UPDATE public.profiles SET
    status         = p_status,
    activated_at   = CASE WHEN p_status = 'active'  THEN COALESCE(activated_at, now()) ELSE activated_at END,
    blocked_at     = CASE WHEN p_status = 'blocked' THEN now()      ELSE NULL END,
    blocked_by     = CASE WHEN p_status = 'blocked' THEN auth.uid() ELSE NULL END,
    blocked_reason = CASE WHEN p_status = 'blocked' THEN p_reason   ELSE NULL END
  WHERE user_id = p_target;
END;
$$;

REVOKE ALL ON FUNCTION public.set_account_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_account_status(UUID, TEXT, TEXT) TO authenticated;
