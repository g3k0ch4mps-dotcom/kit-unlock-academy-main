
-- Fix: Allow authenticated users to look up unlock codes by code value for redemption
CREATE POLICY "Authenticated users can look up codes for redemption"
ON public.unlock_codes
FOR SELECT
TO authenticated
USING (true);

-- Add soft-delete column to kits
ALTER TABLE public.kits ADD COLUMN deleted_at timestamptz DEFAULT NULL;
