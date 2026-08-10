-- Migration: Create Social Media Accounts and Analytics Tables

CREATE TABLE IF NOT EXISTS client_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'youtube', 'linkedin')),
  account_id TEXT NOT NULL,
  account_name TEXT,
  meta_page_id TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  access_token TEXT,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, platform, account_id)
);

CREATE TABLE IF NOT EXISTS client_social_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  record_date DATE NOT NULL,
  reach INT DEFAULT 0,
  impressions INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares INT DEFAULT 0,
  followers_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, account_id, platform, record_date)
);

CREATE TABLE IF NOT EXISTS client_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  post_id TEXT NOT NULL,
  caption TEXT,
  media_url TEXT,
  permalink TEXT,
  like_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  views_count INT DEFAULT 0,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, platform, post_id)
);

-- Enable RLS if applicable or grant permissions
ALTER TABLE client_social_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_social_analytics_daily DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_social_posts DISABLE ROW LEVEL SECURITY;

