ALTER TABLE public.pain_assessments
  ADD COLUMN IF NOT EXISTS intervention text,
  ADD COLUMN IF NOT EXISTS response text,
  ADD COLUMN IF NOT EXISTS response_at timestamptz;

ALTER TABLE public.wounds
  ADD COLUMN IF NOT EXISTS review_date date;

ALTER TABLE public.daily_notes
  ADD COLUMN IF NOT EXISTS category text;

CREATE TABLE IF NOT EXISTS public.handovers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift text NOT NULL DEFAULT 'day',
  shift_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  prepared_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.handovers TO authenticated;
GRANT ALL ON public.handovers TO service_role;

ALTER TABLE public.handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view handovers" ON public.handovers
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can create handovers" ON public.handovers
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update handovers" ON public.handovers
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER handovers_touch_updated_at
  BEFORE UPDATE ON public.handovers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER handovers_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.handovers
  FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();

CREATE INDEX IF NOT EXISTS handovers_date_idx ON public.handovers (shift_date DESC);