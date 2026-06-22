-- =========================================================================
-- CREATE: Task Targets Table and RLS Policies
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Create task_targets table
CREATE TABLE IF NOT EXISTS public.task_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_tasks INTEGER NOT NULL DEFAULT 0,  -- number of tasks to complete
  month VARCHAR(7) NOT NULL,                -- 'YYYY-MM'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.task_targets ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Owners can do everything
DROP POLICY IF EXISTS "Owners can do everything on task_targets" ON public.task_targets;
CREATE POLICY "Owners can do everything on task_targets"
  ON public.task_targets FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- 4. Policy: Users can read their own targets
DROP POLICY IF EXISTS "Users can read own task targets" ON public.task_targets;
CREATE POLICY "Users can read own task targets"
  ON public.task_targets FOR SELECT
  USING (user_id = auth.uid() OR public.is_owner());
