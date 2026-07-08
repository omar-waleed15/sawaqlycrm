-- 1. Add user_id column to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Add Select policies on clients table for clients
CREATE POLICY "Clients can view their own client record"
  ON public.clients FOR SELECT
  USING (user_id = auth.uid());

-- 3. Add Select policies on client_faq table for clients
CREATE POLICY "Clients can view their own FAQs"
  ON public.client_faq FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- 4. Add Select policies on client_content_plans table for clients (restricted to approved/published only)
CREATE POLICY "Clients can view their own approved or published content plans"
  ON public.client_content_plans FOR SELECT
  USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    AND status IN ('approved', 'published')
  );

-- 5. Add Select policies on client_reports table for clients
CREATE POLICY "Clients can view their own performance reports"
  ON public.client_reports FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
