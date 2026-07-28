-- =========================================================================
-- CLIENT ONBOARDING / DIRECTORY SCHEMA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.client_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  
  current_step INT DEFAULT 1,
  completed_steps INT[] DEFAULT '{}',
  
  client_overview JSONB DEFAULT '{}'::jsonb,
  brand_assets JSONB DEFAULT '{}'::jsonb,
  business_discovery JSONB DEFAULT '{}'::jsonb,
  target_audience JSONB DEFAULT '{}'::jsonb,
  competitor_analysis JSONB DEFAULT '{}'::jsonb,
  social_media_audit JSONB DEFAULT '{}'::jsonb,
  content_strategy JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_onboarding ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view and update onboarding
CREATE POLICY "Anyone authenticated can view client_onboarding"
  ON public.client_onboarding FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone authenticated can insert client_onboarding"
  ON public.client_onboarding FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone authenticated can update client_onboarding"
  ON public.client_onboarding FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone authenticated can delete client_onboarding"
  ON public.client_onboarding FOR DELETE
  USING (auth.uid() IS NOT NULL);
