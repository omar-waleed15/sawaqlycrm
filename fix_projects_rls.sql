-- =========================================================================
-- FIX: Projects RLS Policy for Sales Accounts
-- The "projects" table only allows owners to perform operations.
-- Sales accounts need INSERT/SELECT/UPDATE access to create projects
-- when closing deals (close-won flow).
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- Step 1: Drop existing policies on projects (safe re-run)
DROP POLICY IF EXISTS "Owners can do everything on projects" ON public.projects;
DROP POLICY IF EXISTS "Sales can manage own projects" ON public.projects;

-- Step 2: Recreate owner policy with explicit WITH CHECK
CREATE POLICY "Owners can do everything on projects"
  ON public.projects FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Step 3: Create a helper function to check if user is owner or sales
-- (Reuse existing one if it exists, otherwise create)
CREATE OR REPLACE FUNCTION public.is_owner_or_sales()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'sales', 'team_leader', 'account_manager')
  );
$$;

-- Step 4: Allow sales (and TL/AM) to read all projects
DROP POLICY IF EXISTS "Authorized roles can read projects" ON public.projects;
CREATE POLICY "Authorized roles can read projects"
  ON public.projects FOR SELECT
  USING (public.is_owner_or_sales());

-- Step 5: Allow sales (and TL/AM) to insert projects
DROP POLICY IF EXISTS "Authorized roles can insert projects" ON public.projects;
CREATE POLICY "Authorized roles can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (public.is_owner_or_sales());

-- Step 6: Allow sales (and TL/AM) to update projects
DROP POLICY IF EXISTS "Authorized roles can update projects" ON public.projects;
CREATE POLICY "Authorized roles can update projects"
  ON public.projects FOR UPDATE
  USING (public.is_owner_or_sales())
  WITH CHECK (public.is_owner_or_sales());
