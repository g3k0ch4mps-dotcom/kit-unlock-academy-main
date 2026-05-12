-- ============================================================
-- MIGRATION 8: session_quizzes table (predefined per-session quizzes)
-- ============================================================

CREATE TABLE public.session_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Session Quiz',
  questions JSONB NOT NULL DEFAULT '[]',
  passing_score INTEGER NOT NULL DEFAULT 70,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.session_quizzes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view session quizzes" ON public.session_quizzes FOR SELECT USING (true);
CREATE POLICY "Admins can manage session quizzes" ON public.session_quizzes FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));
