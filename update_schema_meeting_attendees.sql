-- Add meeting_attendees and meeting_notes to clients table for in-person meeting team invites
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS meeting_attendees UUID[] DEFAULT '{}';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS meeting_notes TEXT;
