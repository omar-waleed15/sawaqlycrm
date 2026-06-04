-- =========================================================================
-- ADD: Task Publish Date (for scheduling completed tasks)
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS publish_date date;
