-- =========================================================================
-- ALTER: Add extended profile fields to public.profiles
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS national_id TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;
