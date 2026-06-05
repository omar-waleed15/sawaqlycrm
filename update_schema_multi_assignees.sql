-- =========================================================================
-- MULTI-ASSIGNEE TASKS MIGRATION
-- Adds task_assignees junction table for individual tracking per member
-- Also sets up 24-hour auto-delete for chat comments
-- Run this in Supabase SQL Editor
-- =========================================================================

-- 1. Create task_assignees junction table
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'todo',       -- 'todo' | 'in_progress' | 'submitted' | 'revision' | 'completed'
  submission_link TEXT,                       -- individual submission URL
  completion_note TEXT,                       -- individual final thoughts
  feedback TEXT,                              -- admin feedback per assignee
  assigned_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- 2. Enable RLS on task_assignees
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies for task_assignees
CREATE POLICY "Owners can do everything on task_assignees"
  ON public.task_assignees FOR ALL
  USING (public.is_owner());

CREATE POLICY "Members can read their assignments"
  ON public.task_assignees FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Members can update their assignments"
  ON public.task_assignees FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Update tasks member RLS policies to use junction table
DROP POLICY IF EXISTS "Members can read assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members can update their assigned tasks" ON public.tasks;

CREATE POLICY "Members can read assigned tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.task_assignees
      WHERE task_assignees.task_id = tasks.id AND task_assignees.user_id = auth.uid()
    )
  );

-- 5. Update comments RLS policies to use junction table
DROP POLICY IF EXISTS "Members can read comments on assigned tasks" ON public.comments;
DROP POLICY IF EXISTS "Members can insert comments on assigned tasks" ON public.comments;

CREATE POLICY "Members can read comments on assigned tasks"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.task_assignees
      WHERE task_assignees.task_id = comments.task_id AND task_assignees.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert comments on assigned tasks"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.task_assignees
      WHERE task_assignees.task_id = comments.task_id AND task_assignees.user_id = auth.uid()
    )
  );

-- 6. Migrate existing data from tasks.assignee_id into task_assignees
INSERT INTO public.task_assignees (task_id, user_id, status, submission_link, completion_note, feedback)
SELECT id, assignee_id, status, submission_link, completion_note, feedback
FROM public.tasks
WHERE assignee_id IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- 7. (OPTIONAL) Auto-delete comments older than 24 hours using pg_cron
-- Uncomment the lines below ONLY if pg_cron is enabled on your Supabase plan:
--
-- SELECT cron.schedule(
--   'delete-expired-comments',
--   '*/30 * * * *',
--   $$DELETE FROM public.comments WHERE created_at < now() - interval '24 hours'$$
-- );
