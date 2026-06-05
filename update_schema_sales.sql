-- =========================================================================
-- UPDATE: Sales Dashboard, Targets & Lead Call Logs
-- Run this script in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Add sales columns to clients and contracts
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS meeting_date TIMESTAMPTZ;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create sales_targets table
CREATE TABLE IF NOT EXISTS public.sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month)
);

-- 3. Create sales_call_logs table
CREATE TABLE IF NOT EXISTS public.sales_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sales_rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes TEXT,
  outcome TEXT NOT NULL DEFAULT 'contacted', -- 'not_called' | 'no_answer' | 'interested' | 'not_interested' | 'meeting_scheduled' | 'negotiation' | 'won' | 'lost'
  call_date TIMESTAMPTZ DEFAULT now()
);

-- 4. Add client_id to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 5. Enable RLS on new tables
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_call_logs ENABLE ROW LEVEL SECURITY;

-- 6. Setup RLS policies

-- sales_targets policies
DROP POLICY IF EXISTS "Users can read own sales targets" ON public.sales_targets;
CREATE POLICY "Users can read own sales targets"
  ON public.sales_targets FOR SELECT
  USING (user_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "Owners can manage sales targets" ON public.sales_targets;
CREATE POLICY "Owners can manage sales targets"
  ON public.sales_targets FOR ALL
  USING (public.is_owner());

-- sales_call_logs policies
DROP POLICY IF EXISTS "Reps can manage own call logs" ON public.sales_call_logs;
CREATE POLICY "Reps can manage own call logs"
  ON public.sales_call_logs FOR ALL
  USING (sales_rep_id = auth.uid() OR public.is_owner());

-- Update clients policies to allow sales representatives to see and manage their own leads
DROP POLICY IF EXISTS "Owners can do everything on clients" ON public.clients;
CREATE POLICY "Owners can do everything on clients"
  ON public.clients FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Sales can manage own clients" ON public.clients;
CREATE POLICY "Sales can manage own clients"
  ON public.clients FOR ALL
  USING (sales_rep_id = auth.uid() OR public.is_owner())
  WITH CHECK (sales_rep_id = auth.uid() OR public.is_owner());

-- Update contracts policies to allow sales representatives to manage their own closed contracts
DROP POLICY IF EXISTS "Owners can do everything on contracts" ON public.contracts;
CREATE POLICY "Owners can do everything on contracts"
  ON public.contracts FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Sales can manage own contracts" ON public.contracts;
CREATE POLICY "Sales can manage own contracts"
  ON public.contracts FOR ALL
  USING (sales_rep_id = auth.uid() OR public.is_owner())
  WITH CHECK (sales_rep_id = auth.uid() OR public.is_owner());
