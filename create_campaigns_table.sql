-- =========================================================================
-- CREATE CAMPAIGNS TABLE FOR WAPILOT CAMPAIGNS METADATA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wapilot_campaign_id integer NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'sending', 'paused', 'completed'
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Create policy so that all authenticated users can view/manage campaigns
DROP POLICY IF EXISTS "Allow authenticated users all access to campaigns" ON public.campaigns;
CREATE POLICY "Allow authenticated users all access to campaigns"
  ON public.campaigns FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
