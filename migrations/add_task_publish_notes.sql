-- =========================================================================
-- ADD: Task Publish Notes (for content scheduling notes)
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS publish_notes text;
