-- =========================================================================
-- ADD SUBMITTED_AT TO TASK_ASSIGNEES
-- Run this in Supabase SQL Editor to support submission timestamp tracking
-- =========================================================================

ALTER TABLE public.task_assignees 
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
