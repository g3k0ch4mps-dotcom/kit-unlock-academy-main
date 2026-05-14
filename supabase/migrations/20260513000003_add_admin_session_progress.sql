-- Add admin/instructor override for session_progress so admins can reset learner sessions

DROP POLICY IF EXISTS "Admins can manage all progress" ON public.session_progress;

CREATE POLICY "Admins can manage all progress" ON public.session_progress
  FOR ALL TO authenticated
  USING (public.is_admin_or_instructor(auth.uid()))
  WITH CHECK (public.is_admin_or_instructor(auth.uid()));
