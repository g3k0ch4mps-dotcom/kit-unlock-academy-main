-- This script contains ONLY the new attachments feature
-- Run this if setup.sql is giving you "already exists" errors

-- Add attachments table for content block files
CREATE TABLE IF NOT EXISTS public.content_block_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_block_id UUID REFERENCES public.content_blocks(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_block_attachments_block_id
  ON public.content_block_attachments(content_block_id);

ALTER TABLE public.content_block_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow authenticated users to read attachments"
  ON public.content_block_attachments
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Allow admins to manage attachments"
  ON public.content_block_attachments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
