-- Add attachments table for content block files (notes, images, code, documents)
CREATE TABLE IF NOT EXISTS public.content_block_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_block_id UUID REFERENCES public.content_blocks(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'document', 'image', 'code'
  file_path TEXT NOT NULL, -- path in Supabase Storage
  file_size_bytes INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_content_block_attachments_block_id
  ON public.content_block_attachments(content_block_id);

-- Enable RLS
ALTER TABLE public.content_block_attachments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read attachments
CREATE POLICY "Allow authenticated users to read attachments"
  ON public.content_block_attachments
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow admins to manage attachments
CREATE POLICY "Allow admins to manage attachments"
  ON public.content_block_attachments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
