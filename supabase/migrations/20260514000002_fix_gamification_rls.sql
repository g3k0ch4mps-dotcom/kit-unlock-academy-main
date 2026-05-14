-- Ensure RLS policies exist for gamification tables
-- Run this if client-side SELECTs return 403 (RLS blocking reads)

-- ============ user_xp ============
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own XP" ON public.user_xp;
CREATE POLICY "Users can view own XP" ON public.user_xp
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert XP" ON public.user_xp;
CREATE POLICY "System can insert XP" ON public.user_xp
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can update own XP" ON public.user_xp;
CREATE POLICY "System can update own XP" ON public.user_xp
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ xp_transactions ============
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.xp_transactions;
CREATE POLICY "Users can view own transactions" ON public.xp_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert transactions" ON public.xp_transactions;
CREATE POLICY "System can insert transactions" ON public.xp_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ user_streaks ============
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own streak" ON public.user_streaks;
CREATE POLICY "Users can view own streak" ON public.user_streaks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert streak" ON public.user_streaks;
CREATE POLICY "System can insert streak" ON public.user_streaks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can update own streak" ON public.user_streaks;
CREATE POLICY "System can update own streak" ON public.user_streaks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ daily_logins ============
ALTER TABLE public.daily_logins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own logins" ON public.daily_logins;
CREATE POLICY "Users can view own logins" ON public.daily_logins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own login" ON public.daily_logins;
CREATE POLICY "Users can insert own login" ON public.daily_logins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
