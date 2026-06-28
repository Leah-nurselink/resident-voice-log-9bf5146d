ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS next_of_kin_secondary text,
  ADD COLUMN IF NOT EXISTS next_of_kin_secondary_relationship text,
  ADD COLUMN IF NOT EXISTS next_of_kin_secondary_phone text;