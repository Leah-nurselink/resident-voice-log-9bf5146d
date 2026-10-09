-- Validated clinical risk-assessment tools (Waterlow, MUST, GULP, Falls MFRA).
-- Additive only: existing risk_assessments rows and columns are untouched.
--
-- Adds:
--   * a 'dehydration' value to the risk_assessment_type enum (for GULP)
--   * structured, auditable storage on risk_assessments:
--       tool          which validated tool produced this row
--       tool_version  the scoring version used (for audit when thresholds change)
--       inputs        the exact answers entered (JSONB) so the score is reproducible
--       score         computed total (NULL for Falls — NICE CG161 is unscored)
--       band          precise tool band label, e.g. 'High risk (15-19)'
--   (the existing `type`, `level`, `factors`, `controls`, `review_date` stay as-is;
--    `level` continues to drive the current low/medium/high badges.)

-- 1) New risk type for dehydration (GULP). Safe to re-run.
ALTER TYPE public.risk_assessment_type ADD VALUE IF NOT EXISTS 'dehydration';

-- 2) Structured storage columns (all nullable so legacy rows remain valid).
ALTER TABLE public.risk_assessments
  ADD COLUMN IF NOT EXISTS tool         text,
  ADD COLUMN IF NOT EXISTS tool_version text,
  ADD COLUMN IF NOT EXISTS inputs       jsonb,
  ADD COLUMN IF NOT EXISTS score        integer,
  ADD COLUMN IF NOT EXISTS band         text;

COMMENT ON COLUMN public.risk_assessments.tool         IS 'Validated tool: waterlow | must | gulp | falls_mfra (NULL for legacy free-form rows)';
COMMENT ON COLUMN public.risk_assessments.tool_version IS 'Scoring version string from src/lib/risk-tools.ts, for audit';
COMMENT ON COLUMN public.risk_assessments.inputs       IS 'Exact answers entered, so the score is reproducible';
COMMENT ON COLUMN public.risk_assessments.score        IS 'Computed total; NULL for Falls (NICE CG161 is unscored)';
COMMENT ON COLUMN public.risk_assessments.band         IS 'Precise tool band label, e.g. High risk (15-19)';
