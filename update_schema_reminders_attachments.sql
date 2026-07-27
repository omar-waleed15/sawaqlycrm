-- Migration: Add attachments and review_link columns to public.reminders
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS review_link TEXT;
