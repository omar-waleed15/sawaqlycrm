-- =========================================================================
-- FIX: Task Creator Permissions & RLS Policies
-- Allows non-owner task creators (e.g. Sales reps) to view, edit, and assign
-- tasks they created.
-- =========================================================================

-- 1. Allow creators to read tasks they created
CREATE POLICY "Users can read tasks they created"
  ON public.tasks FOR SELECT
  USING (creator_id = auth.uid());

-- 2. Allow creators to update tasks they created
CREATE POLICY "Users can update tasks they created"
  ON public.tasks FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- 3. Allow creators to manage task_assignees for tasks they created
CREATE POLICY "Creators can manage task_assignees"
  ON public.task_assignees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_assignees.task_id AND tasks.creator_id = auth.uid()
    )
  );
