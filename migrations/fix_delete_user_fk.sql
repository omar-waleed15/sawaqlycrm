-- =========================================================================
-- FIX: Allow User Deletion by Setting Task Foreign Keys to NULL
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Drop existing tasks table constraints on profiles
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_creator_id_fkey,
  DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;

-- 2. Re-create the constraints with ON DELETE SET NULL
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT tasks_assignee_id_fkey
    FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
