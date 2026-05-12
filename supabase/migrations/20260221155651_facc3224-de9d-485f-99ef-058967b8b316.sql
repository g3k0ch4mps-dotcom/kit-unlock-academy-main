
-- Table to store session quiz attempts and scores
CREATE TABLE public.session_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.sessions(id),
  program_id UUID NOT NULL REFERENCES public.programs(id),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.session_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own quiz attempts
CREATE POLICY "Users can view their own session quiz attempts"
ON public.session_quiz_attempts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own quiz attempts
CREATE POLICY "Users can create their own session quiz attempts"
ON public.session_quiz_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own quiz attempts
CREATE POLICY "Users can update their own session quiz attempts"
ON public.session_quiz_attempts
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all session quiz attempts"
ON public.session_quiz_attempts
FOR SELECT
USING (is_admin_or_instructor(auth.uid()));

-- Add certificate_type column to certificates table
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS certificate_type TEXT NOT NULL DEFAULT 'completion';
