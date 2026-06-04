-- =========================================================================
-- UPDATE: Add feedback and progress_note fields to tasks table
-- Run this script in the Supabase SQL Editor.
-- =========================================================================

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS feedback text,
ADD COLUMN IF NOT EXISTS progress_note text;
