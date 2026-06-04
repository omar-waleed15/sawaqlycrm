-- =========================================================================
-- UPDATE: Add payment_date, is_recurring, recurrence to salaries table
--         Create salary_installments table for one-time salary installments
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Add new columns to salaries table
ALTER TABLE public.salaries
  ADD COLUMN IF NOT EXISTS paid_date date,
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recurrence text DEFAULT 'monthly'; -- 'monthly' | 'yearly'

-- 2. Create salary_installments table (mirrors contract_installments pattern)
CREATE TABLE IF NOT EXISTS public.salary_installments (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_id   uuid    NOT NULL REFERENCES public.salaries(id) ON DELETE CASCADE,
  amount      numeric NOT NULL,
  due_date    date,
  paid        boolean NOT NULL DEFAULT false,
  note        text,
  created_at  timestamptz DEFAULT now()
);

-- Enable RLS on salary_installments
ALTER TABLE public.salary_installments ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists then recreate
DROP POLICY IF EXISTS "Owners and sales can do everything on salary_installments" ON public.salary_installments;

CREATE POLICY "Owners and sales can do everything on salary_installments"
  ON public.salary_installments FOR ALL
  USING (public.is_owner_or_sales());
