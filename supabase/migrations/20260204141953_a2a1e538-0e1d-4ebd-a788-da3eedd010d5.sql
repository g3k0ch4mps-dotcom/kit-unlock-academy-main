-- Add new content block types for the structured learning format
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'problem';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'solution';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'components';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'circuit_diagram';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'questions';
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'feedback';