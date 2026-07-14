-- =========================================================================
-- CREATE PERSONAL NOTES & TODO CHECKLISTS TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.personal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text DEFAULT '',
  type text NOT NULL DEFAULT 'text', -- 'text' or 'todo'
  todo_items jsonb DEFAULT '[]'::jsonb, -- Array format: [{"id": "...", "text": "...", "completed": false}]
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists to avoid errors on duplicate run
DROP POLICY IF EXISTS "Users can manage their own personal notes" ON public.personal_notes;

-- Create policy so that users can only select, insert, update, or delete their own notes
CREATE POLICY "Users can manage their own personal notes"
  ON public.personal_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
