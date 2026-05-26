-- Add missing indexes for query-heavy columns
-- These reduce sequential scans as the database grows

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
