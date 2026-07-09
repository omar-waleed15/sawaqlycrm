CREATE TABLE IF NOT EXISTS public.client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;

-- Helper function: checks if user is owner/team_leader/account_manager
CREATE OR REPLACE FUNCTION public.is_chat_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'team_leader', 'account_manager')
  );
$$;

-- RLS Policies
DROP POLICY IF EXISTS "Staff can read all client messages" ON public.client_messages;
CREATE POLICY "Staff can read all client messages"
  ON public.client_messages FOR SELECT
  USING (public.is_chat_staff());

DROP POLICY IF EXISTS "Staff can insert client messages" ON public.client_messages;
CREATE POLICY "Staff can insert client messages"
  ON public.client_messages FOR INSERT
  WITH CHECK (public.is_chat_staff() AND auth.uid() = sender_id);

DROP POLICY IF EXISTS "Clients can read own messages" ON public.client_messages;
CREATE POLICY "Clients can read own messages"
  ON public.client_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = client_messages.client_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clients can insert own messages" ON public.client_messages;
CREATE POLICY "Clients can insert own messages"
  ON public.client_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = client_id AND user_id = auth.uid()
    )
  );

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS client_messages_client_id_created_at_idx ON public.client_messages(client_id, created_at ASC);
