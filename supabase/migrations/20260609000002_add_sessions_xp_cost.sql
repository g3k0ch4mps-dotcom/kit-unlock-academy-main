-- ============================================================
-- Add the missing sessions.xp_cost column.
--
-- The column was defined in supabase/setup.sql but never captured in a
-- migration, so projects provisioned via `supabase db push` (rather than by
-- running setup.sql) never got it. The Session Content Editor writes xp_cost
-- on every create/update, so inserts were failing with:
--   400  42703  column sessions.xp_cost does not exist
--
-- xp_cost = spendable XP a learner must pay to unlock the session.
-- NULL / 0 means no XP is required.
-- ============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS xp_cost INTEGER DEFAULT NULL;
