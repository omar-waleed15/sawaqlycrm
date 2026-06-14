-- =========================================================================
-- ADD RATING COLUMN TO TASK ASSIGNEES
-- Adds rating (1-10) to the task_assignees junction table.
-- =========================================================================

ALTER TABLE public.task_assignees
  ADD COLUMN IF NOT EXISTS rating integer CHECK (rating >= 1 AND rating <= 10);
