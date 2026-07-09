-- Update scheduled_date column in contents table to include time (TIMESTAMPTZ)
ALTER TABLE public.contents ALTER COLUMN scheduled_date TYPE TIMESTAMPTZ;
