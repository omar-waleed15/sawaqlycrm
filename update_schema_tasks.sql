-- =========================================================================
-- UPDATE: Add Content Details & Asset fields to tasks table
-- Copy and paste this into the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS drive_link text,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS content_description text;
