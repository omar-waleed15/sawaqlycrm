-- Migration: Alter tasks due_date column to TIMESTAMPTZ to support time selection
ALTER TABLE public.tasks 
  ALTER COLUMN due_date TYPE TIMESTAMPTZ USING due_date::timestamptz;
