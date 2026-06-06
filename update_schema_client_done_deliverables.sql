-- Add deliverable progress tracking columns to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS done_posts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS done_reels integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS done_stories integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS done_photos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS done_other boolean DEFAULT false;
