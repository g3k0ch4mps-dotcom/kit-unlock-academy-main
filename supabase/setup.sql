-- ============================================================
-- Kit Unlock Academy - Full Database Setup Script
-- Run this entire script in Supabase SQL Editor
-- ============================================================


-- ============================================================
-- MIGRATION 1: Core enums, tables, RLS, triggers
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'instructor', 'learner');
CREATE TYPE public.kit_category AS ENUM ('robotics', 'iot');
CREATE TYPE public.content_block_type AS ENUM ('text', 'image', 'code', 'diagram', 'video', 'safety_note', 'tip');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'learner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category kit_category NOT NULL DEFAULT 'iot',
  image_url TEXT,
  total_sessions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES public.kits(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  difficulty_level TEXT DEFAULT 'beginner',
  estimated_hours INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  session_order INTEGER NOT NULL DEFAULT 1,
  is_free BOOLEAN DEFAULT false,
  duration_minutes INTEGER DEFAULT 30,
  xp_cost INTEGER DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  block_type content_block_type NOT NULL DEFAULT 'text',
  block_order INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  content TEXT,
  code_language TEXT,
  image_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.unlock_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  kit_id UUID REFERENCES public.kits(id) ON DELETE CASCADE,
  xp_reward INTEGER DEFAULT NULL,
  is_used BOOLEAN DEFAULT false,
  redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE,
  device_fingerprint TEXT,
  ip_address TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT unlock_code_must_have_program_or_kit CHECK (program_id IS NOT NULL OR kit_id IS NOT NULL OR xp_reward IS NOT NULL)
);

CREATE TABLE public.user_program_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  unlock_code_id UUID REFERENCES public.unlock_codes(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, program_id)
);

CREATE TABLE public.session_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  completed BOOLEAN DEFAULT false,
  progress_percentage INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, session_id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlock_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_program_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_progress ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_instructor(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'instructor'))
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'learner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kits_updated_at
  BEFORE UPDATE ON public.kits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_blocks_updated_at
  BEFORE UPDATE ON public.content_blocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- MIGRATION 2: Additional content block types
-- ============================================================

ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'problem';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'solution';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'components';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'circuit_diagram';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'questions';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'feedback';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'introduction';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'simulation';


-- ============================================================
-- MIGRATION 3: Difficulty/category enums, new tables
-- ============================================================

CREATE TYPE public.difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE public.content_category AS ENUM ('robotics', 'iot', 'electronics', 'ai_ml', 'sensors', 'automation');

ALTER TABLE public.kits ADD COLUMN IF NOT EXISTS difficulty_level public.difficulty_level DEFAULT 'beginner';
ALTER TABLE public.kits ADD COLUMN deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS category public.content_category DEFAULT 'robotics';
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS simulation_url TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS xp_cost INTEGER DEFAULT NULL;

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
  certificate_type TEXT NOT NULL DEFAULT 'completion',
  CONSTRAINT cert_must_have_program_or_kit CHECK (program_id IS NOT NULL OR kit_id IS NOT NULL)
);

ALTER TABLE public.unlock_codes ADD COLUMN IF NOT EXISTS kit_id UUID REFERENCES public.kits(id) ON DELETE CASCADE;
ALTER TABLE public.unlock_codes ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT NULL;
ALTER TABLE public.unlock_codes DROP CONSTRAINT IF EXISTS unlock_code_must_have_program_or_kit;
ALTER TABLE public.unlock_codes ADD CONSTRAINT unlock_code_must_have_program_or_kit CHECK (program_id IS NOT NULL OR kit_id IS NOT NULL OR xp_reward IS NOT NULL);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_program_tests_updated_at
  BEFORE UPDATE ON public.program_tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- MIGRATION 4: user_assessments + personalized_content tables
-- ============================================================

CREATE TABLE public.user_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  skill_level TEXT NOT NULL DEFAULT 'beginner',
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, program_id)
);

ALTER TABLE public.user_assessments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_user_assessments_updated_at
  BEFORE UPDATE ON public.user_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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


-- ============================================================
-- MIGRATION 5: session_quiz_attempts table
-- ============================================================

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

ALTER TABLE public.session_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Remove duplicated questions column (same data lives in session_quizzes.questions)
ALTER TABLE public.session_quiz_attempts DROP COLUMN IF EXISTS questions;


-- ============================================================
-- MIGRATION 6: Final RLS policies (all tables)
-- ============================================================

-- KITS
CREATE POLICY "Anyone can view kits" ON public.kits FOR SELECT USING (true);
CREATE POLICY "Admins can manage kits" ON public.kits FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- PROGRAMS
CREATE POLICY "Anyone can view programs" ON public.programs FOR SELECT USING (true);
CREATE POLICY "Admins can manage programs" ON public.programs FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- SESSIONS
CREATE POLICY "Anyone can view sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Admins can manage sessions" ON public.sessions FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- CONTENT BLOCKS
CREATE POLICY "Users can view free content" ON public.content_blocks FOR SELECT
  USING (EXISTS (SELECT 1 FROM sessions s WHERE s.id = content_blocks.session_id AND s.is_free = true));
CREATE POLICY "Users can view unlocked content" ON public.content_blocks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sessions s
    JOIN programs p ON p.id = s.program_id
    JOIN user_program_access upa ON upa.program_id = p.id
    WHERE s.id = content_blocks.session_id AND upa.user_id = auth.uid()
  ));
CREATE POLICY "Admins can manage content" ON public.content_blocks FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- UNLOCK CODES
CREATE POLICY "Authenticated users can look up codes" ON public.unlock_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage codes" ON public.unlock_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Users can redeem codes" ON public.unlock_codes;
CREATE POLICY "Users can redeem codes" ON public.unlock_codes
  FOR UPDATE TO authenticated
  USING (is_used = false)
  WITH CHECK (is_used = true AND redeemed_by = auth.uid());

-- USER PROGRAM ACCESS
CREATE POLICY "Users can view their own access" ON public.user_program_access FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own access" ON public.user_program_access FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- SESSION PROGRESS
CREATE POLICY "Users can manage their own progress" ON public.session_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all progress" ON public.session_progress FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid())) WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- PROFILES
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- USER ROLES
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PROJECTS
CREATE POLICY "Anyone can view projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Admins can manage projects" ON public.projects FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- PROGRAM TESTS
CREATE POLICY "Anyone can view tests" ON public.program_tests FOR SELECT USING (true);
CREATE POLICY "Admins can manage tests" ON public.program_tests FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- TEST ATTEMPTS
CREATE POLICY "Users can view their own attempts" ON public.test_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own attempts" ON public.test_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own attempts" ON public.test_attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts" ON public.test_attempts FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

-- CERTIFICATES
CREATE POLICY "Anyone can view certificates by number" ON public.certificates FOR SELECT USING (true);
CREATE POLICY "Users can view their own certificates" ON public.certificates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage certificates" ON public.certificates FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- USER ASSESSMENTS
CREATE POLICY "Users can view their own assessments" ON public.user_assessments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own assessments" ON public.user_assessments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own assessments" ON public.user_assessments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all assessments" ON public.user_assessments FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

-- PERSONALIZED CONTENT
CREATE POLICY "Users can view their own personalized content" ON public.personalized_content FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own personalized content" ON public.personalized_content FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own personalized content" ON public.personalized_content FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all personalized content" ON public.personalized_content FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

-- SESSION QUIZ ATTEMPTS
CREATE POLICY "Users can view their own session quiz attempts" ON public.session_quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own session quiz attempts" ON public.session_quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own session quiz attempts" ON public.session_quiz_attempts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all session quiz attempts" ON public.session_quiz_attempts FOR SELECT USING (public.is_admin_or_instructor(auth.uid()));

-- SESSION QUIZZES (predefined quizzes per session)
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

CREATE POLICY "Anyone can view session quizzes" ON public.session_quizzes FOR SELECT USING (true);
CREATE POLICY "Admins can manage session quizzes" ON public.session_quizzes FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- USER DEVICES (fingerprint tracking)
CREATE TABLE public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fingerprint TEXT NOT NULL,
  device_label TEXT DEFAULT 'Unknown device',
  ip_address TEXT,
  last_sign_in_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  sign_in_count INTEGER DEFAULT 1,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_fingerprint ON public.user_devices(fingerprint);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices" ON public.user_devices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own devices" ON public.user_devices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own devices" ON public.user_devices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all devices" ON public.user_devices
  FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));
CREATE POLICY "Admins can revoke devices" ON public.user_devices
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));


-- ============================================================
-- MIGRATION 7: Storage buckets
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('kit-images', 'kit-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view kit images" ON storage.objects;
CREATE POLICY "Anyone can view kit images" ON storage.objects FOR SELECT USING (bucket_id = 'kit-images');
DROP POLICY IF EXISTS "Admins can upload kit images" ON storage.objects;
CREATE POLICY "Admins can upload kit images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kit-images' AND is_admin_or_instructor(auth.uid()));
DROP POLICY IF EXISTS "Admins can update kit images" ON storage.objects;
CREATE POLICY "Admins can update kit images" ON storage.objects FOR UPDATE USING (bucket_id = 'kit-images' AND is_admin_or_instructor(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete kit images" ON storage.objects;
CREATE POLICY "Admins can delete kit images" ON storage.objects FOR DELETE USING (bucket_id = 'kit-images' AND is_admin_or_instructor(auth.uid()));

DROP POLICY IF EXISTS "Certificates are publicly viewable" ON storage.objects;
CREATE POLICY "Certificates are publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'certificates');
DROP POLICY IF EXISTS "System can upload certificates" ON storage.objects;
CREATE POLICY "System can upload certificates" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'certificates');

-- ============================================================
-- MIGRATION 8: Gamification (XP, Streaks, Badges, Store)
-- ============================================================

-- XP & Levels
CREATE TABLE public.user_xp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id ON public.xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_created_at ON public.xp_transactions(created_at);

-- Login Streaks
CREATE TABLE public.user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.daily_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  login_date DATE NOT NULL,
  xp_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, login_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_logins_user_id ON public.daily_logins(user_id);

-- Badges
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  xp_required INTEGER,
  criteria JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, badge_id)
);

-- Store & Redemption
CREATE TABLE public.store_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  xp_cost INTEGER NOT NULL,
  image_url TEXT,
  stock INTEGER DEFAULT -1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.store_items(id) ON DELETE CASCADE NOT NULL,
  xp_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  fulfilled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_redemptions_user_id ON public.redemptions(user_id);

-- RLS: user_xp
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own XP" ON public.user_xp
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert XP" ON public.user_xp
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can update own XP" ON public.user_xp
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all XP" ON public.user_xp
  FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

-- RLS: xp_transactions
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.xp_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert transactions" ON public.xp_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions" ON public.xp_transactions
  FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

-- RLS: user_streaks
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streak" ON public.user_streaks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert streak" ON public.user_streaks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can update own streak" ON public.user_streaks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all streaks" ON public.user_streaks
  FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

-- RLS: daily_logins
ALTER TABLE public.daily_logins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logins" ON public.daily_logins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own login" ON public.daily_logins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS: badges
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges" ON public.badges
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage badges" ON public.badges
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- RLS: user_badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own badges" ON public.user_badges
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert badge" ON public.user_badges
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all badges" ON public.user_badges
  FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

-- RLS: store_items
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active store items" ON public.store_items
  FOR SELECT TO authenticated USING (is_active = true OR public.is_admin_or_instructor(auth.uid()));
CREATE POLICY "Admins can manage store items" ON public.store_items
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- RLS: redemptions
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions" ON public.redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own redemption" ON public.redemptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage redemptions" ON public.redemptions
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- Seed badges
INSERT INTO public.badges (name, description, icon, xp_required, criteria) VALUES
  ('First Steps', 'Complete your first session', '👣', NULL, '{"type": "session_completed", "count": 1}'),
  ('Quiz Whiz', 'Pass your first session quiz', '🧠', NULL, '{"type": "quiz_passed", "count": 1}'),
  ('Streak Starter', 'Reach a 3-day login streak', '🔥', NULL, '{"type": "streak", "count": 3}'),
  ('Dedicated Learner', 'Reach a 7-day login streak', '⭐', NULL, '{"type": "streak", "count": 7}'),
  ('Century', 'Earn 100 total XP', '💯', 100, '{"type": "xp_total", "count": 100}'),
  ('Scholar', 'Earn 500 total XP', '🎓', 500, '{"type": "xp_total", "count": 500}'),
  ('Program Complete', 'Complete an entire program', '🏆', NULL, '{"type": "program_completed", "count": 1}')
ON CONFLICT DO NOTHING;


-- ============================================================
-- MIGRATION 9: XP Functions (SECURITY DEFINER bypass RLS)
-- ============================================================

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
  SELECT COALESCE(total_xp, 0) INTO v_current_total
  FROM public.user_xp
  WHERE user_id = p_user_id;

  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (p_user_id, p_amount, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = public.user_xp.total_xp + p_amount,
    level = public.user_xp.level,
    updated_at = now()
  RETURNING total_xp, level INTO v_new_total, v_new_level;

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

  v_result := jsonb_build_object(
    'total_xp', v_new_total,
    'level', v_new_level
  );

  RETURN v_result;
END;
$$;


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
  v_new_level INTEGER;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF auth.uid() != p_user_id AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'instructor')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM public.xp_transactions
  WHERE user_id = p_user_id
    AND reference_type = 'session'
    AND reference_id = p_session_id;

  DELETE FROM public.xp_transactions
  WHERE user_id = p_user_id
    AND reference_type = 'session_quiz'
    AND reference_id = p_session_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_new_total
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
  SET total_xp = v_new_total, level = v_new_level, updated_at = now()
  WHERE user_id = p_user_id;

  v_result := jsonb_build_object(
    'total_xp', v_new_total,
    'level', v_new_level
  );

  RETURN v_result;
END;
$$;


-- ============================================================
-- MIGRATION 10: Missing performance indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sessions_program_order
  ON public.sessions(program_id, session_order);
CREATE INDEX IF NOT EXISTS idx_content_blocks_session_order
  ON public.content_blocks(session_id, block_order);
CREATE INDEX IF NOT EXISTS idx_session_progress_user_session
  ON public.session_progress(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_user_program_access_user
  ON public.user_program_access(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user
  ON public.test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user
  ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number
  ON public.certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_unlock_codes_code
  ON public.unlock_codes(code);
CREATE INDEX IF NOT EXISTS idx_session_quiz_attempts_user_session
  ON public.session_quiz_attempts(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_date
  ON public.xp_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logins_user_date
  ON public.daily_logins(user_id, login_date);
CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_programs_kit
  ON public.programs(kit_id);


-- ============================================================
-- MIGRATION 11: Content block attachments for learning materials
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_block_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_block_id UUID REFERENCES public.content_blocks(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_block_attachments_block_id
  ON public.content_block_attachments(content_block_id);

ALTER TABLE public.content_block_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read attachments"
  ON public.content_block_attachments
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admins to manage attachments"
  ON public.content_block_attachments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );


-- ============================================================
-- POST-SETUP: Admin user (customize the UUID for your admin)
-- ============================================================

-- Uncomment and replace the UUID after creating your admin account:
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('your-admin-user-id-here', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;
