-- Fix kits RLS: convert restrictive policies to permissive so admins can actually edit/delete

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage kits" ON public.kits;
DROP POLICY IF EXISTS "Anyone can view kits" ON public.kits;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Admins can manage kits"
ON public.kits
FOR ALL
TO authenticated
USING (public.is_admin_or_instructor(auth.uid()))
WITH CHECK (public.is_admin_or_instructor(auth.uid()));

CREATE POLICY "Anyone can view kits"
ON public.kits
FOR SELECT
TO authenticated, anon
USING (true);

-- Also fix programs table (same issue)
DROP POLICY IF EXISTS "Admins can manage programs" ON public.programs;
DROP POLICY IF EXISTS "Anyone can view programs" ON public.programs;

CREATE POLICY "Admins can manage programs"
ON public.programs
FOR ALL
TO authenticated
USING (public.is_admin_or_instructor(auth.uid()))
WITH CHECK (public.is_admin_or_instructor(auth.uid()));

CREATE POLICY "Anyone can view programs"
ON public.programs
FOR SELECT
TO authenticated, anon
USING (true);

-- Fix certificates table
DROP POLICY IF EXISTS "Admins can manage certificates" ON public.certificates;
DROP POLICY IF EXISTS "Anyone can view certificates by number" ON public.certificates;
DROP POLICY IF EXISTS "Users can view their own certificates" ON public.certificates;

CREATE POLICY "Admins can manage certificates"
ON public.certificates
FOR ALL
TO authenticated
USING (public.is_admin_or_instructor(auth.uid()))
WITH CHECK (public.is_admin_or_instructor(auth.uid()));

CREATE POLICY "Anyone can view certificates by number"
ON public.certificates
FOR SELECT
USING (true);

CREATE POLICY "Users can view their own certificates"
ON public.certificates
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix content_blocks table
DROP POLICY IF EXISTS "Admins can manage content" ON public.content_blocks;
DROP POLICY IF EXISTS "Users can view free content" ON public.content_blocks;
DROP POLICY IF EXISTS "Users can view unlocked content" ON public.content_blocks;

CREATE POLICY "Admins can manage content"
ON public.content_blocks
FOR ALL
TO authenticated
USING (public.is_admin_or_instructor(auth.uid()))
WITH CHECK (public.is_admin_or_instructor(auth.uid()));

CREATE POLICY "Users can view free content"
ON public.content_blocks
FOR SELECT
USING (EXISTS (SELECT 1 FROM sessions s WHERE s.id = content_blocks.session_id AND s.is_free = true));

CREATE POLICY "Users can view unlocked content"
ON public.content_blocks
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM sessions s
  JOIN programs p ON p.id = s.program_id
  JOIN user_program_access upa ON upa.program_id = p.id
  WHERE s.id = content_blocks.session_id AND upa.user_id = auth.uid()
));

-- Fix sessions table
DROP POLICY IF EXISTS "Admins can manage sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can view sessions" ON public.sessions;

CREATE POLICY "Admins can manage sessions"
ON public.sessions
FOR ALL
TO authenticated
USING (public.is_admin_or_instructor(auth.uid()))
WITH CHECK (public.is_admin_or_instructor(auth.uid()));

CREATE POLICY "Anyone can view sessions"
ON public.sessions
FOR SELECT
TO authenticated, anon
USING (true);

-- Fix program_tests table
DROP POLICY IF EXISTS "Admins can manage tests" ON public.program_tests;
DROP POLICY IF EXISTS "Anyone can view tests" ON public.program_tests;

CREATE POLICY "Admins can manage tests"
ON public.program_tests
FOR ALL
TO authenticated
USING (public.is_admin_or_instructor(auth.uid()))
WITH CHECK (public.is_admin_or_instructor(auth.uid()));

CREATE POLICY "Anyone can view tests"
ON public.program_tests
FOR SELECT
TO authenticated, anon
USING (true);

-- Fix projects table
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can view projects" ON public.projects;

CREATE POLICY "Admins can manage projects"
ON public.projects
FOR ALL
TO authenticated
USING (public.is_admin_or_instructor(auth.uid()))
WITH CHECK (public.is_admin_or_instructor(auth.uid()));

CREATE POLICY "Anyone can view projects"
ON public.projects
FOR SELECT
TO authenticated, anon
USING (true);

-- Fix unlock_codes table
DROP POLICY IF EXISTS "Admins can manage codes" ON public.unlock_codes;
DROP POLICY IF EXISTS "Admins can view all codes" ON public.unlock_codes;

CREATE POLICY "Admins can manage codes"
ON public.unlock_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all codes"
ON public.unlock_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));