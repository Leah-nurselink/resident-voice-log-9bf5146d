ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS recording_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_consent_date date,
  ADD COLUMN IF NOT EXISTS recording_consent_notes text,
  ADD COLUMN IF NOT EXISTS transcription_enabled boolean NOT NULL DEFAULT true;