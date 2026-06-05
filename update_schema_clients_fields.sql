-- =========================================================================
-- UPDATE: Add Start Date, Address, and Content Plan Link to Clients Table
-- Run this script in the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS content_plan_link TEXT;
