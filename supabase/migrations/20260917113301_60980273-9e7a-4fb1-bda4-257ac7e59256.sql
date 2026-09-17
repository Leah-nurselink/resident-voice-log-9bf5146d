
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS resident_ref text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS important_preferences text;

-- Backfill names from existing full_name
UPDATE public.residents
SET first_name = COALESCE(first_name, split_part(full_name, ' ', 1)),
    last_name = COALESCE(last_name, NULLIF(regexp_replace(full_name, '^\S+\s*', ''), ''))
WHERE first_name IS NULL OR last_name IS NULL;

-- Human-readable reference
CREATE SEQUENCE IF NOT EXISTS public.resident_ref_seq;

CREATE OR REPLACE FUNCTION public.set_resident_ref()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.resident_ref IS NULL OR NEW.resident_ref = '' THEN
    NEW.resident_ref := 'R-' || lpad(nextval('public.resident_ref_seq')::text, 4, '0');
  END IF;
  IF (NEW.full_name IS NULL OR NEW.full_name = '') AND (NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL) THEN
    NEW.full_name := btrim(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,''));
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.set_resident_ref() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS residents_set_ref ON public.residents;
CREATE TRIGGER residents_set_ref BEFORE INSERT OR UPDATE ON public.residents
FOR EACH ROW EXECUTE FUNCTION public.set_resident_ref();

UPDATE public.residents SET resident_ref = 'R-' || lpad(nextval('public.resident_ref_seq')::text, 4, '0')
WHERE resident_ref IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_ref ON public.residents (resident_ref);
