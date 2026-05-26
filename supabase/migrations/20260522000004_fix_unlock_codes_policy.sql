-- Restrict unlock_codes UPDATE to only allow redeeming an unused code for yourself
-- Previously: USING (true) WITH CHECK (true) — any user could modify any row

DROP POLICY IF EXISTS "Users can redeem codes" ON public.unlock_codes;

CREATE POLICY "Users can redeem codes" ON public.unlock_codes
  FOR UPDATE
  TO authenticated
  USING (is_used = false)
  WITH CHECK (
    is_used = true
    AND redeemed_by = auth.uid()
  );
