-- Remove duplicated questions JSONB from session_quiz_attempts
-- The same data already lives in session_quizzes.questions
-- No client-side code reads this column (confirmed by codebase audit)

ALTER TABLE public.session_quiz_attempts DROP COLUMN IF EXISTS questions;
