-- Migration: Add timer fields to task_assignees junction table
ALTER TABLE public.task_assignees 
  ADD COLUMN IF NOT EXISTS total_time_spent INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMPTZ DEFAULT NULL;
