-- =========================================================================
-- FIX: Database RLS Policies for Inserts & Upserts (including Sales Targets)
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. SALES TARGETS
DROP POLICY IF EXISTS "Users can read own sales targets" ON public.sales_targets;
DROP POLICY IF EXISTS "Owners can manage sales targets" ON public.sales_targets;
DROP POLICY IF EXISTS "Owners can do everything on sales_targets" ON public.sales_targets;

CREATE POLICY "Owners can do everything on sales_targets"
  ON public.sales_targets FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "Users can read own sales targets"
  ON public.sales_targets FOR SELECT
  USING (user_id = auth.uid() OR public.is_owner());


-- 2. SALES CALL LOGS
DROP POLICY IF EXISTS "Reps can manage own call logs" ON public.sales_call_logs;

CREATE POLICY "Reps can manage own call logs"
  ON public.sales_call_logs FOR ALL
  USING (sales_rep_id = auth.uid() OR public.is_owner())
  WITH CHECK (sales_rep_id = auth.uid() OR public.is_owner());


-- 3. CLIENTS
DROP POLICY IF EXISTS "Owners can do everything on clients" ON public.clients;

CREATE POLICY "Owners can do everything on clients"
  ON public.clients FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());


-- 4. CONTRACTS
DROP POLICY IF EXISTS "Owners can do everything on contracts" ON public.contracts;

CREATE POLICY "Owners can do everything on contracts"
  ON public.contracts FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());


-- 5. PROJECTS
DROP POLICY IF EXISTS "Owners can do everything on projects" ON public.projects;

CREATE POLICY "Owners can do everything on projects"
  ON public.projects FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());


-- 6. EXPENSES & SALARIES
DROP POLICY IF EXISTS "Owners and sales can do everything on expenses" ON public.expenses;
CREATE POLICY "Owners and sales can do everything on expenses"
  ON public.expenses FOR ALL
  USING (public.is_owner_or_sales())
  WITH CHECK (public.is_owner_or_sales());

DROP POLICY IF EXISTS "Owners and sales can do everything on salaries" ON public.salaries;
CREATE POLICY "Owners and sales can do everything on salaries"
  ON public.salaries FOR ALL
  USING (public.is_owner_or_sales())
  WITH CHECK (public.is_owner_or_sales());
