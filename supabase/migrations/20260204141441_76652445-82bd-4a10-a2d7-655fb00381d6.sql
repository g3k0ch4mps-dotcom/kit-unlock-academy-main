-- Create storage bucket for kit images
INSERT INTO storage.buckets (id, name, public)
VALUES ('kit-images', 'kit-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to view kit images
CREATE POLICY "Anyone can view kit images"
ON storage.objects FOR SELECT
USING (bucket_id = 'kit-images');

-- Allow admins to upload kit images
CREATE POLICY "Admins can upload kit images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kit-images' AND is_admin_or_instructor(auth.uid()));

-- Allow admins to update kit images
CREATE POLICY "Admins can update kit images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'kit-images' AND is_admin_or_instructor(auth.uid()));

-- Allow admins to delete kit images
CREATE POLICY "Admins can delete kit images"
ON storage.objects FOR DELETE
USING (bucket_id = 'kit-images' AND is_admin_or_instructor(auth.uid()));