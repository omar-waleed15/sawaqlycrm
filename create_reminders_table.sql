-- 1. Create REMINDERS Table
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- 3. Define Policies
DROP POLICY IF EXISTS "Users can create reminders" ON public.reminders;
CREATE POLICY "Users can create reminders"
  ON public.reminders FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can read their own sent or received reminders" ON public.reminders;
CREATE POLICY "Users can read their own sent or received reminders"
  ON public.reminders FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Receivers can update read/done status" ON public.reminders;
CREATE POLICY "Receivers can update read/done status"
  ON public.reminders FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Senders can delete their reminders" ON public.reminders;
CREATE POLICY "Senders can delete their reminders"
  ON public.reminders FOR DELETE
  USING (auth.uid() = sender_id);
