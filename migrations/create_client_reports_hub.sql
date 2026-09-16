-- Migration: Create Client Reports Hub (Daily Logs & Enhanced Monthly Reports)

-- 1. Create client_daily_logs table for daily timestamped updates
CREATE TABLE IF NOT EXISTS public.client_daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning fast daily queries
CREATE INDEX IF NOT EXISTS idx_client_daily_logs_date_client ON public.client_daily_logs (log_date, client_id);
CREATE INDEX IF NOT EXISTS idx_client_daily_logs_client_created ON public.client_daily_logs (client_id, created_at DESC);

-- Disable RLS for compatibility with existing service_role setup
ALTER TABLE public.client_daily_logs DISABLE ROW LEVEL SECURITY;

-- 2. Enhance client_reports table for monthly reports
ALTER TABLE public.client_reports 
ADD COLUMN IF NOT EXISTS meta_insights_image_url TEXT,
ADD COLUMN IF NOT EXISTS ads_screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS ad_spend NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS roas NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Ensure RLS is disabled or open for service role
ALTER TABLE public.client_reports DISABLE ROW LEVEL SECURITY;
