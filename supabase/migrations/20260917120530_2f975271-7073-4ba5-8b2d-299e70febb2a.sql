ALTER TABLE public.communication_tasks
  ALTER COLUMN communication_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS recommendation_id uuid REFERENCES public.ai_recommendations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'communication',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS communication_tasks_status_due_idx ON public.communication_tasks (status, due_date);
CREATE INDEX IF NOT EXISTS communication_tasks_recommendation_idx ON public.communication_tasks (recommendation_id);