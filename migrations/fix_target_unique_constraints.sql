-- =========================================================================
-- FIX: Add UNIQUE(user_id, month) constraints to task_targets and sales_targets
-- This resolves the "there is no unique or exclusion constraint matching the ON CONFLICT specification" error.
-- =========================================================================

ALTER TABLE public.task_targets DROP CONSTRAINT IF EXISTS task_targets_user_id_month_key;
ALTER TABLE public.task_targets ADD CONSTRAINT task_targets_user_id_month_key UNIQUE (user_id, month);

ALTER TABLE public.sales_targets DROP CONSTRAINT IF EXISTS sales_targets_user_id_month_key;
ALTER TABLE public.sales_targets ADD CONSTRAINT sales_targets_user_id_month_key UNIQUE (user_id, month);
