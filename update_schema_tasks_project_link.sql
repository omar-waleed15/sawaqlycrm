-- =========================================================================
-- UPDATE: Link Tasks to Projects instead of Clients
-- Run this script in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
