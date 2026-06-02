-- ============================================================
-- Migration: AI Chat System + Profile Self-Healing
-- ============================================================

-- 1. Chat messages table (strict per-user isolation)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON public.chat_messages(user_id, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can ONLY see their own messages — no admin override (privacy by design)
CREATE POLICY "Users can view own chat messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages" ON public.chat_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- 2. ensure_user_profile: self-heals after a DB reset without touching auth.users
--    Called from the frontend when a signed-in user has no profile/role.
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name)
  SELECT
    au.id,
    au.email,
    COALESCE(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      au.email
    )
  FROM auth.users au
  WHERE au.id = auth.uid()
  ON CONFLICT (user_id) DO NOTHING;

  -- Only insert learner role if the user has NO role at all.
  -- Admins/instructors set by set_user_role will not be overwritten.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'learner')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
