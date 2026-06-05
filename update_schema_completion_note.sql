-- Add completion_note column to tasks table
-- This allows members to write their final thoughts when submitting a task
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_note text;
