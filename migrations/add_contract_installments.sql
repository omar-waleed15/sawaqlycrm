-- =========================================================================
-- ADD: Contract Installments Support
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Create the installments table
CREATE TABLE IF NOT EXISTS public.contract_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.contract_installments ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policy if re-running
DROP POLICY IF EXISTS "Owners can do everything on contract_installments" ON public.contract_installments;
DROP POLICY IF EXISTS "Authenticated users can manage contract_installments" ON public.contract_installments;

-- 4. Allow access for all authenticated users (Express handles role-based access)
CREATE POLICY "Authenticated users can manage contract_installments"
  ON public.contract_installments FOR ALL
  USING (auth.uid() IS NOT NULL);
