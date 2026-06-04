-- =========================================================================
-- UPDATE: Finance & Clients Schema Setup
-- Copy and paste this into the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Create CLIENTS Table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  created_at timestamptz DEFAULT now()
);

-- 2. Create PROJECTS Table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active', -- 'planning' | 'active' | 'completed' | 'on_hold'
  budget numeric DEFAULT 0,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now()
);

-- 3. Create CONTRACTS / RENEWALS Table
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  is_recurring boolean NOT NULL DEFAULT true,
  billing_cycle text NOT NULL DEFAULT 'monthly', -- 'monthly' | 'quarterly' | 'yearly' | 'one_time'
  status text NOT NULL DEFAULT 'active', -- 'active' | 'expired' | 'cancelled'
  start_date date,
  renewal_date date,
  created_at timestamptz DEFAULT now()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- 5. Drop Policies if they exist (to allow safe re-runs)
DROP POLICY IF EXISTS "Owners can do everything on clients" ON public.clients;
DROP POLICY IF EXISTS "Owners can do everything on projects" ON public.projects;
DROP POLICY IF EXISTS "Owners can do everything on contracts" ON public.contracts;

-- 6. Create Admin/Owner CRUD Policies (Only admins can access these tables)
CREATE POLICY "Owners can do everything on clients"
  ON public.clients FOR ALL
  USING (public.is_owner());

CREATE POLICY "Owners can do everything on projects"
  ON public.projects FOR ALL
  USING (public.is_owner());

CREATE POLICY "Owners can do everything on contracts"
  ON public.contracts FOR ALL
  USING (public.is_owner());

-- 7. Add is_recurring column to existing contracts table (safe to run on existing DBs)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT true;

-- 8. Add pipeline_stage column to existing clients table (safe to run on existing DBs)
--    Stages: new_lead | contacted | meeting_scheduled | proposal_sent | negotiation | won | lost
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'new_lead';
