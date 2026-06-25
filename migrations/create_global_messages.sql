-- =========================================================================
-- CREATE GLOBAL MESSAGES TABLE WITH RLS
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.global_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.global_messages ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (to allow safe re-runs)
DROP POLICY IF EXISTS "Anyone authenticated can read global messages" ON public.global_messages;
DROP POLICY IF EXISTS "Anyone authenticated can insert global messages" ON public.global_messages;

-- Create Policies
CREATE POLICY "Anyone authenticated can read global messages"
  ON public.global_messages FOR SELECT
  USING (auth.uid() is not null);

CREATE POLICY "Anyone authenticated can insert global messages"
  ON public.global_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);
