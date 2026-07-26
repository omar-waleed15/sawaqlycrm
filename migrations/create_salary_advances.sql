-- =========================================================================
-- CREATE: Salary Advances Table and RLS Policies
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Create salary_advances table
CREATE TABLE IF NOT EXISTS public.salary_advances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_id   UUID NOT NULL REFERENCES public.salaries(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  notes       TEXT,              -- Reason or description for the advance
  date        DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Owners and Sales can do everything
DROP POLICY IF EXISTS "Owners and sales can do everything on salary_advances" ON public.salary_advances;
CREATE POLICY "Owners and sales can do everything on salary_advances"
  ON public.salary_advances FOR ALL
  USING (public.is_owner_or_sales());
