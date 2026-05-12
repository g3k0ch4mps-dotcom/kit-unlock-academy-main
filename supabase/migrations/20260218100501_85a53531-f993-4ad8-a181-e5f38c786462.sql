
-- =============================================
-- Fix ALL RLS policies: RESTRICTIVE → PERMISSIVE
-- =============================================

-- ==================== KITS ====================
DROP POLICY IF EXISTS "Admins can manage kits" ON public.kits;
DROP POLICY IF EXISTS "Anyone can view kits" ON public.kits;

CREATE POLICY "Anyone can view kits" ON public.kits
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage kits" ON public.kits
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- ==================== PROGRAMS ====================
DROP POLICY IF EXISTS "Admins can manage programs" ON public.programs;
DROP POLICY IF EXISTS "Anyone can view programs" ON public.programs;

CREATE POLICY "Anyone can view programs" ON public.programs
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage programs" ON public.programs
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- ==================== SESSIONS ====================
DROP POLICY IF EXISTS "Admins can manage sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can view sessions" ON public.sessions;

CREATE POLICY "Anyone can view sessions" ON public.sessions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage sessions" ON public.sessions
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- ==================== CONTENT_BLOCKS ====================
DROP POLICY IF EXISTS "Admins can manage content" ON public.content_blocks;
DROP POLICY IF EXISTS "Users can view free content" ON public.content_blocks;
DROP POLICY IF EXISTS "Users can view unlocked content" ON public.content_blocks;

CREATE POLICY "Users can view free content" ON public.content_blocks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sessions s WHERE s.id = content_blocks.session_id AND s.is_free = true)
  );

CREATE POLICY "Users can view unlocked content" ON public.content_blocks
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN programs p ON p.id = s.program_id
      JOIN user_program_access upa ON upa.program_id = p.id
      WHERE s.id = content_blocks.session_id AND upa.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage content" ON public.content_blocks
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- ==================== UNLOCK_CODES ====================
DROP POLICY IF EXISTS "Admins can manage codes" ON public.unlock_codes;
DROP POLICY IF EXISTS "Admins can view all codes" ON public.unlock_codes;
DROP POLICY IF EXISTS "Authenticated users can look up codes for redemption" ON public.unlock_codes;

CREATE POLICY "Authenticated users can look up codes" ON public.unlock_codes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage codes" ON public.unlock_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can redeem codes" ON public.unlock_codes
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==================== USER_PROGRAM_ACCESS ====================
DROP POLICY IF EXISTS "Users can view their own access" ON public.user_program_access;
DROP POLICY IF EXISTS "System can insert access on code redemption" ON public.user_program_access;

CREATE POLICY "Users can view their own access" ON public.user_program_access
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own access" ON public.user_program_access
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ==================== CERTIFICATES ====================
DROP POLICY IF EXISTS "Admins can manage certificates" ON public.certificates;
DROP POLICY IF EXISTS "Anyone can view certificates by number" ON public.certificates;
DROP POLICY IF EXISTS "Users can view their own certificates" ON public.certificates;

CREATE POLICY "Anyone can view certificates by number" ON public.certificates
  FOR SELECT USING (true);

CREATE POLICY "Users can view their own certificates" ON public.certificates
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage certificates" ON public.certificates
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- ==================== PROGRAM_TESTS ====================
DROP POLICY IF EXISTS "Admins can manage tests" ON public.program_tests;
DROP POLICY IF EXISTS "Anyone can view tests" ON public.program_tests;

CREATE POLICY "Anyone can view tests" ON public.program_tests
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage tests" ON public.program_tests
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- ==================== PROJECTS ====================
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can view projects" ON public.projects;

CREATE POLICY "Anyone can view projects" ON public.projects
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage projects" ON public.projects
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));

-- ==================== PROFILES ====================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ==================== USER_ROLES ====================
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==================== USER_ASSESSMENTS ====================
DROP POLICY IF EXISTS "Users can view their own assessments" ON public.user_assessments;
DROP POLICY IF EXISTS "Users can insert their own assessments" ON public.user_assessments;
DROP POLICY IF EXISTS "Users can update their own assessments" ON public.user_assessments;
DROP POLICY IF EXISTS "Admins can view all assessments" ON public.user_assessments;

CREATE POLICY "Users can view their own assessments" ON public.user_assessments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assessments" ON public.user_assessments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assessments" ON public.user_assessments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all assessments" ON public.user_assessments
  FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

-- ==================== TEST_ATTEMPTS ====================
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.test_attempts;
DROP POLICY IF EXISTS "Users can create their own attempts" ON public.test_attempts;
DROP POLICY IF EXISTS "Users can update their own attempts" ON public.test_attempts;
DROP POLICY IF EXISTS "Admins can view all attempts" ON public.test_attempts;

CREATE POLICY "Users can view their own attempts" ON public.test_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attempts" ON public.test_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts" ON public.test_attempts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attempts" ON public.test_attempts
  FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

-- ==================== SESSION_PROGRESS ====================
DROP POLICY IF EXISTS "Users can manage their own progress" ON public.session_progress;

CREATE POLICY "Users can manage their own progress" ON public.session_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==================== PERSONALIZED_CONTENT ====================
DROP POLICY IF EXISTS "Users can view their own personalized content" ON public.personalized_content;
DROP POLICY IF EXISTS "Users can insert their own personalized content" ON public.personalized_content;
DROP POLICY IF EXISTS "Users can delete their own personalized content" ON public.personalized_content;
DROP POLICY IF EXISTS "Admins can view all personalized content" ON public.personalized_content;

CREATE POLICY "Users can view their own personalized content" ON public.personalized_content
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personalized content" ON public.personalized_content
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personalized content" ON public.personalized_content
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all personalized content" ON public.personalized_content
  FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));
