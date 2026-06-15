-- =========================================================================
-- ADD: Task Archive Column (for archiving tasks)
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
