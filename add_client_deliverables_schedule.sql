-- Add deliverables schedule JSONB column to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS deliverables_schedule JSONB DEFAULT '{"posts":[], "reels":[], "stories":[], "photos":[]}'::jsonb;
