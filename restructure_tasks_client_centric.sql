-- =========================================================================
-- RESTRUCTURE: CLIENT-CENTRIC TASKS & AUTOMATED DELIVERABLES
-- Run this script in the Supabase SQL Editor
-- =========================================================================

-- 1. Add client_id column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- 2. Add deliverable tracking columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_deliverable BOOLEAN DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deliverable_type TEXT; -- 'post' | 'reel' | 'story' | 'photo'
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deliverable_month DATE; -- YYYY-MM-01

-- 3. Migrate existing tasks data (map task.project_id -> project.client_id -> task.client_id)
UPDATE public.tasks t
SET client_id = p.client_id
FROM public.projects p
WHERE t.project_id = p.id AND t.client_id IS NULL;

-- 4. Set is_deliverable = true for existing tasks that have drive_link or content_type
UPDATE public.tasks
SET is_deliverable = true,
    deliverable_type = content_type,
    deliverable_month = DATE_TRUNC('month', COALESCE(due_date, created_at::date))::date
WHERE content_type IS NOT NULL AND content_type IN ('post', 'reel', 'story', 'photo') AND is_deliverable = false;
