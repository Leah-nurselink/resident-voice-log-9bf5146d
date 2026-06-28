
ALTER TABLE public.daily_notes
  ADD COLUMN IF NOT EXISTS audio_quality numeric,
  ADD COLUMN IF NOT EXISTS transcript_confidence numeric,
  ADD COLUMN IF NOT EXISTS signal_level numeric,
  ADD COLUMN IF NOT EXISTS noise_level numeric,
  ADD COLUMN IF NOT EXISTS duration_sec numeric,
  ADD COLUMN IF NOT EXISTS time_saved_seconds integer,
  ADD COLUMN IF NOT EXISTS segments jsonb;
