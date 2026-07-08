-- =========================================================================
-- CLOSED CLIENTS: FAQ, Content Plans, Ideas/Calendar, Performance Reports
-- Run this script in the Supabase SQL Editor
-- =========================================================================

-- 1. Template Questions / FAQ per client
CREATE TABLE IF NOT EXISTS public.client_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Content Plans per client
CREATE TABLE IF NOT EXISTS public.client_content_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT,            -- 'post' | 'reel' | 'story' | 'photo' | 'video' | 'carousel'
  status TEXT DEFAULT 'draft',  -- 'draft' | 'approved' | 'published'
  scheduled_date DATE,
  drive_link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Ideas / Calendar entries per client
CREATE TABLE IF NOT EXISTS public.client_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  is_scheduled BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#6366f1',
  status TEXT DEFAULT 'idea',  -- 'idea' | 'scheduled' | 'done'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Performance Reports per client (monthly snapshots)
CREATE TABLE IF NOT EXISTS public.client_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,   -- YYYY-MM-01
  views INT DEFAULT 0,
  interactions INT DEFAULT 0,
  messages INT DEFAULT 0,
  num_posts INT DEFAULT 0,
  num_reels INT DEFAULT 0,
  num_stories INT DEFAULT 0,
  num_photos INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, report_month)
);

-- =========================================================================
-- Enable RLS
-- =========================================================================
ALTER TABLE public.client_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- RLS Policies (same pattern as existing tables)
-- =========================================================================

-- client_faq
CREATE POLICY "Owners can do everything on client_faq"
  ON public.client_faq FOR ALL
  USING (public.is_owner());

CREATE POLICY "Authenticated users can read client_faq"
  ON public.client_faq FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- client_content_plans
CREATE POLICY "Owners can do everything on client_content_plans"
  ON public.client_content_plans FOR ALL
  USING (public.is_owner());

CREATE POLICY "Authenticated users can read client_content_plans"
  ON public.client_content_plans FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- client_ideas
CREATE POLICY "Owners can do everything on client_ideas"
  ON public.client_ideas FOR ALL
  USING (public.is_owner());

CREATE POLICY "Authenticated users can read client_ideas"
  ON public.client_ideas FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- client_reports
CREATE POLICY "Owners can do everything on client_reports"
  ON public.client_reports FOR ALL
  USING (public.is_owner());

CREATE POLICY "Authenticated users can read client_reports"
  ON public.client_reports FOR SELECT
  USING (auth.uid() IS NOT NULL);
