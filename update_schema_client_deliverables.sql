-- Add content deliverables fields to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS num_posts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_reels integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_stories integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_photos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deliverables text;
