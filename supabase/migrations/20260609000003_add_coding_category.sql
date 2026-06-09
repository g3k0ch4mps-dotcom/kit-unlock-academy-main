-- ============================================================
-- Add a new "coding" content category.
--
-- content_category is the enum used by programs and projects:
--   ('robotics', 'iot', 'electronics', 'ai_ml', 'sensors', 'automation')
-- Adds 'coding' so programs/projects can be classified as coding courses.
-- (kit_category is a separate, kit-only enum and is intentionally left as-is.)
-- ============================================================

ALTER TYPE public.content_category ADD VALUE IF NOT EXISTS 'coding';
