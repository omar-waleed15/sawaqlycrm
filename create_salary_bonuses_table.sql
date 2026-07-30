-- =========================================================================
-- CREATE SALARY_BONUSES TABLE
-- Run this in Supabase SQL Editor to support the Salary Bonus feature
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.salary_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_id UUID REFERENCES public.salaries(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
