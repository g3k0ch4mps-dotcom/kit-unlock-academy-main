-- Add new enum for difficulty levels
CREATE TYPE public.difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');

-- Add new enum for extended categories
CREATE TYPE public.content_category AS ENUM ('robotics', 'iot', 'electronics', 'ai_ml', 'sensors', 'automation');

-- Add new content block types for introduction and simulation
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'introduction';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'simulation';

-- Modify kits table - add difficulty_level
ALTER TABLE public.kits 
ADD COLUMN IF NOT EXISTS difficulty_level public.difficulty_level DEFAULT 'beginner';

-- Modify programs table - make kit_id nullable, add new columns
ALTER TABLE public.programs 
ALTER COLUMN kit_id DROP NOT NULL;

ALTER TABLE public.programs 
ADD COLUMN IF NOT EXISTS category public.content_category DEFAULT 'robotics',
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;

-- Modify sessions table - add simulation_url
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS simulation_url TEXT;

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  difficulty_level public.difficulty_level DEFAULT 'beginner',
  category public.content_category DEFAULT 'robotics',
  image_url TEXT,
  components JSONB DEFAULT '[]'::jsonb,
  circuit_diagram_url TEXT,
  code TEXT,
  code_language TEXT DEFAULT 'cpp',
  simulation_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create program_tests table
CREATE TABLE IF NOT EXISTS public.program_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  kit_id UUID REFERENCES public.kits(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  passing_score INTEGER NOT NULL DEFAULT 70,
  time_limit_mins INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT test_must_have_program_or_kit CHECK (program_id IS NOT NULL OR kit_id IS NOT NULL)
);

-- Create test_attempts table
CREATE TABLE IF NOT EXISTS public.test_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  test_id UUID NOT NULL REFERENCES public.program_tests(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create certificates table
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  kit_id UUID REFERENCES public.kits(id) ON DELETE SET NULL,
  test_attempt_id UUID REFERENCES public.test_attempts(id) ON DELETE SET NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  certificate_url TEXT,
  score INTEGER,
  learner_name TEXT NOT NULL,
  program_title TEXT NOT NULL,
  CONSTRAINT cert_must_have_program_or_kit CHECK (program_id IS NOT NULL OR kit_id IS NOT NULL)
);

-- Modify unlock_codes table - add kit_id as alternative, make program_id nullable
ALTER TABLE public.unlock_codes 
ALTER COLUMN program_id DROP NOT NULL;

ALTER TABLE public.unlock_codes 
ADD COLUMN IF NOT EXISTS kit_id UUID REFERENCES public.kits(id) ON DELETE CASCADE;

-- Add constraint to ensure either program_id or kit_id is set
ALTER TABLE public.unlock_codes
ADD CONSTRAINT unlock_code_must_have_program_or_kit 
CHECK (program_id IS NOT NULL OR kit_id IS NOT NULL);

-- Enable RLS on new tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Anyone can view projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Admins can manage projects" ON public.projects FOR ALL USING (is_admin_or_instructor(auth.uid()));

-- Program tests policies
CREATE POLICY "Anyone can view tests" ON public.program_tests FOR SELECT USING (true);
CREATE POLICY "Admins can manage tests" ON public.program_tests FOR ALL USING (is_admin_or_instructor(auth.uid()));

-- Test attempts policies
CREATE POLICY "Users can view their own attempts" ON public.test_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own attempts" ON public.test_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own attempts" ON public.test_attempts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts" ON public.test_attempts FOR SELECT USING (is_admin_or_instructor(auth.uid()));

-- Certificates policies
CREATE POLICY "Users can view their own certificates" ON public.certificates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage certificates" ON public.certificates FOR ALL USING (is_admin_or_instructor(auth.uid()));
CREATE POLICY "Anyone can view certificates by number" ON public.certificates FOR SELECT USING (true);

-- Create updated_at triggers for new tables
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_program_tests_updated_at
BEFORE UPDATE ON public.program_tests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create certificates storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for certificates bucket
CREATE POLICY "Certificates are publicly viewable" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'certificates');

CREATE POLICY "Admins can upload certificates" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'certificates' AND is_admin_or_instructor(auth.uid()));

CREATE POLICY "System can upload certificates" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'certificates');