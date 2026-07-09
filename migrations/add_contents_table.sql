-- =========================================================================
-- CREATE: Contents Table for Content Hub
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT,
  caption TEXT,
  description TEXT,
  content_type TEXT NOT NULL,      -- 'post' | 'photo' | 'reel' | 'story'
  sound TEXT,                      -- optional audio track title
  drive_link TEXT,                 -- optional Google Drive link
  status TEXT DEFAULT 'draft',     -- 'draft' | 'published'
  media_urls JSONB DEFAULT '[]'::jsonb, -- array of uploaded file public URLs
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Privileged roles can manage contents" ON public.contents;
DROP POLICY IF EXISTS "Authenticated users can read contents" ON public.contents;

-- Owner, team_leader, moderation, and account_manager can manage everything
CREATE POLICY "Privileged roles can manage contents"
  ON public.contents FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('owner', 'team_leader', 'moderation', 'account_manager'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('owner', 'team_leader', 'moderation', 'account_manager'));

-- Authenticated users (including members/clients) can read
CREATE POLICY "Authenticated users can read contents"
  ON public.contents FOR SELECT
  TO authenticated
  USING (true);
