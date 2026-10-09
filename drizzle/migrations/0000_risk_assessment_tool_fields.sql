ALTER TABLE public.risk_assessments
  ADD COLUMN IF NOT EXISTS tool text,
  ADD COLUMN IF NOT EXISTS tool_version text,
  ADD COLUMN IF NOT EXISTS inputs jsonb,
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS band text;
NOTIFY pgrst, 'reload schema';