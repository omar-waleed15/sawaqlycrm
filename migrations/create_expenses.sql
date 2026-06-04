-- =========================================================================
-- CREATE: Expenses & Salaries Tables and RLS Policies
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- Create helper function if it doesn't exist
CREATE OR REPLACE FUNCTION public.is_owner_or_sales()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'sales')
  );
$$;

-- 1. Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL, -- 'ads' | 'software' | 'office' | 'freelancer' | 'salary' | 'other'
  date date NOT NULL,
  note text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence text, -- 'monthly' | 'yearly'
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Create salaries table
CREATE TABLE IF NOT EXISTS public.salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  month date NOT NULL, -- First day of the month, e.g., '2026-06-01'
  paid boolean NOT NULL DEFAULT false,
  note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_month UNIQUE (user_id, month)
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Owners and sales can do everything on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Owners and sales can do everything on salaries" ON public.salaries;

-- Create Policies
CREATE POLICY "Owners and sales can do everything on expenses"
  ON public.expenses FOR ALL
  USING (public.is_owner_or_sales());

CREATE POLICY "Owners and sales can do everything on salaries"
  ON public.salaries FOR ALL
  USING (public.is_owner_or_sales());
