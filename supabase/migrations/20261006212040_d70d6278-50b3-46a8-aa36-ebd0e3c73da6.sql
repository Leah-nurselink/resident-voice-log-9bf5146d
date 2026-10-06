ALTER TABLE public.pain_assessments
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'abbey',
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS can_self_report text,
  ADD COLUMN IF NOT EXISTS self_score integer,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS onset text,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS modifiers text,
  ADD COLUMN IF NOT EXISTS observations jsonb,
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS interventions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS during_personal_care boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reassess_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS parent_assessment_id uuid REFERENCES public.pain_assessments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS medication_administration_id uuid REFERENCES public.medication_administrations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pain_parent_idx ON public.pain_assessments(parent_assessment_id);