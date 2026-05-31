-- H-2: Stop exposing the entire unlock_codes table to every authenticated user.
-- Previously a blanket "USING (true)" SELECT policy let any logged-in user
-- enumerate every code (and redeem them). Replace it with a SECURITY DEFINER
-- lookup that only returns a code the caller already knows the value of.

DROP POLICY IF EXISTS "Authenticated users can look up codes" ON public.unlock_codes;

CREATE OR REPLACE FUNCTION public.lookup_unlock_code(p_code TEXT)
RETURNS TABLE(
  id UUID,
  program_id UUID,
  kit_id UUID,
  xp_reward INTEGER,
  is_used BOOLEAN,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT uc.id, uc.program_id, uc.kit_id, uc.xp_reward, uc.is_used, uc.expires_at
  FROM public.unlock_codes uc
  WHERE uc.code = p_code;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_unlock_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_unlock_code(TEXT) TO authenticated;
