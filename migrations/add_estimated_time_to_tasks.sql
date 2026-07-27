-- Migration: Add estimated_time_minutes column to tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimated_time_minutes INTEGER DEFAULT NULL;
