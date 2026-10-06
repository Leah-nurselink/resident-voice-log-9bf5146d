ALTER TABLE public.pain_assessments
  ADD COLUMN IF NOT EXISTS facial_analysis_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS facial_indicators jsonb,
  ADD COLUMN IF NOT EXISTS facial_quality numeric,
  ADD COLUMN IF NOT EXISTS facial_model text,
  ADD COLUMN IF NOT EXISTS facial_consent_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS context_rest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS context_movement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;