-- ============================================================
-- Harden content_blocks access at the DATABASE level (RLS)
-- ------------------------------------------------------------
-- The old SELECT policies only checked user_program_access and
-- ignored (a) per-session grants from module-scoped codes and
-- (b) access expiry — so expired/ungranted users could still read
-- a session's content via the API, bypassing the UI gate.
--
-- This replaces them with a single source of truth:
--   can_access_session(session_id) = free OR active program grant
--   OR active per-session grant OR admin/instructor.
-- "active" = expires_at IS NULL or in the future.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admins / instructors can always read (authoring, preview)
    public.is_admin_or_instructor(auth.uid())
    -- Free sessions are open
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = p_session_id AND s.is_free = true
    )
    -- Active whole-program grant
    OR EXISTS (
      SELECT 1
      FROM public.sessions s
      JOIN public.user_program_access upa ON upa.program_id = s.program_id
      WHERE s.id = p_session_id
        AND upa.user_id = auth.uid()
        AND (upa.expires_at IS NULL OR upa.expires_at > now())
    )
    -- Active per-session grant (module-scoped codes)
    OR EXISTS (
      SELECT 1
      FROM public.user_session_access usa
      WHERE usa.session_id = p_session_id
        AND usa.user_id = auth.uid()
        AND (usa.expires_at IS NULL OR usa.expires_at > now())
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_session(UUID) TO authenticated, anon;

-- Replace the old SELECT policies
DROP POLICY IF EXISTS "Users can view free content" ON public.content_blocks;
DROP POLICY IF EXISTS "Users can view unlocked content" ON public.content_blocks;
DROP POLICY IF EXISTS "View free content" ON public.content_blocks;
DROP POLICY IF EXISTS "View accessible content" ON public.content_blocks;

-- Free content stays publicly previewable (incl. logged-out visitors)
CREATE POLICY "View free content" ON public.content_blocks
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = content_blocks.session_id AND s.is_free = true
  ));

-- Authenticated users: only content they have active access to
CREATE POLICY "View accessible content" ON public.content_blocks
  FOR SELECT TO authenticated
  USING (public.can_access_session(content_blocks.session_id));

-- "Admins can manage content" (FOR ALL) is left intact.
