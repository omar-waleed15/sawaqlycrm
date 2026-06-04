-- =========================================================================
-- FIX: Explicitly name the foreign key constraints on salaries table
-- so Supabase PostgREST can resolve the relationship unambiguously.
-- Run this in the Supabase SQL Editor if the salaries table already exists.
-- =========================================================================

-- Re-create salaries table with explicit FK constraint names
-- (only needed if auto-naming didn't produce salaries_user_id_fkey)

-- Check what the actual constraint names are:
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conrelid = 'public.salaries'::regclass
  AND contype = 'f';

-- If constraints are not named salaries_user_id_fkey / salaries_created_by_fkey,
-- rename them:
-- ALTER TABLE public.salaries RENAME CONSTRAINT <old_name> TO salaries_user_id_fkey;
-- ALTER TABLE public.salaries RENAME CONSTRAINT <old_name> TO salaries_created_by_fkey;

-- OR: Drop and re-add with explicit names:
-- ALTER TABLE public.salaries DROP CONSTRAINT <auto_name_for_user_id>;
-- ALTER TABLE public.salaries ADD CONSTRAINT salaries_user_id_fkey
--   FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ALTER TABLE public.salaries DROP CONSTRAINT <auto_name_for_created_by>;
-- ALTER TABLE public.salaries ADD CONSTRAINT salaries_created_by_fkey
--   FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
