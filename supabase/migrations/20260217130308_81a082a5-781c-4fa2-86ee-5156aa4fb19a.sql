
-- Store per-program user assessments
CREATE TABLE public.user_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  skill_level TEXT NOT NULL DEFAULT 'beginner', -- beginner, intermediate, advanced
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, program_id)
);

ALTER TABLE public.user_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assessments"
  ON public.user_assessments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assessments"
  ON public.user_assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assessments"
  ON public.user_assessments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all assessments"
  ON public.user_assessments FOR SELECT
  USING (is_admin_or_instructor(auth.uid()));

CREATE TRIGGER update_user_assessments_updated_at
  BEFORE UPDATE ON public.user_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cache personalized session content per user
CREATE TABLE public.personalized_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  original_block_id UUID NOT NULL REFERENCES public.content_blocks(id) ON DELETE CASCADE,
  personalized_text TEXT NOT NULL,
  skill_level TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, original_block_id)
);

ALTER TABLE public.personalized_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own personalized content"
  ON public.personalized_content FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personalized content"
  ON public.personalized_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personalized content"
  ON public.personalized_content FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all personalized content"
  ON public.personalized_content FOR SELECT
  USING (is_admin_or_instructor(auth.uid()));
