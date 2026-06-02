-- Create storage bucket for content attachments if it doesn't exist
-- This is a one-time setup that should be run in Supabase dashboard

-- To run this in Supabase:
-- 1. Go to Storage in Supabase dashboard
-- 2. Create a new bucket named "content-attachments"
-- 3. Make it PRIVATE (not public)
-- 4. Run the RLS policies below in SQL editor

-- RLS Policies for content-attachments bucket
-- Allow authenticated users to download files they have access to
CREATE POLICY "Allow authenticated users to read content attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'content-attachments' AND
  auth.role() = 'authenticated'
);

-- Allow admins to upload and delete
CREATE POLICY "Allow admins to manage content attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'content-attachments' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Allow admins to delete content attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'content-attachments' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);
