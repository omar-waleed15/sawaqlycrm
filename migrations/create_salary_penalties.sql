-- =========================================================================
-- CREATE: Salary Penalties Table and RLS Policies
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Create salary_penalties table
CREATE TABLE IF NOT EXISTS public.salary_penalties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_id   UUID NOT NULL REFERENCES public.salaries(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  notes       TEXT,              -- Reason/cause for the penalty
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.salary_penalties ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Owners can do everything, others blocked
DROP POLICY IF EXISTS "Owners can do everything on salary_penalties" ON public.salary_penalties;
CREATE POLICY "Owners can do everything on salary_penalties"
  ON public.salary_penalties FOR ALL
  USING (public.is_owner());
