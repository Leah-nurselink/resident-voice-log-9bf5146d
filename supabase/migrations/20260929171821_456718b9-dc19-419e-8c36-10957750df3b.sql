ALTER TABLE public.care_plans
  ADD COLUMN IF NOT EXISTS ai_draft jsonb,
  ADD COLUMN IF NOT EXISTS ai_draft_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_draft_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;