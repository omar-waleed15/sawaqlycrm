-- Migration: Create content_ideas table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS content_ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT CHECK (content_type IN ('post', 'story', 'reel', 'photos', 'video', 'carousel', 'other')),
  drive_link TEXT,
  content_description TEXT,
  rating TEXT NOT NULL DEFAULT 'medium' CHECK (rating IN ('good', 'medium', 'bad')),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for creator_id lookups
CREATE INDEX IF NOT EXISTS idx_content_ideas_creator_id ON content_ideas(creator_id);

-- Index for rating filter
CREATE INDEX IF NOT EXISTS idx_content_ideas_rating ON content_ideas(rating);

-- RLS: Enable row-level security
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;

-- Policy: Service role (backend) has full access
-- (The backend uses supabaseAdmin which bypasses RLS automatically)

-- Optional: Allow authenticated users to read (the API layer enforces owner-only)
CREATE POLICY "Authenticated users can read content ideas"
  ON content_ideas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert content ideas"
  ON content_ideas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Authenticated users can update own content ideas"
  ON content_ideas FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Authenticated users can delete own content ideas"
  ON content_ideas FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id);
