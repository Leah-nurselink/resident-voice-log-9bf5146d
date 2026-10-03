ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS stock_count integer,
  ADD COLUMN IF NOT EXISTS stock_counted_at timestamptz,
  ADD COLUMN IF NOT EXISTS controlled_drug boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cycle_start_date date,
  ADD COLUMN IF NOT EXISTS cycle_end_date date,
  ADD COLUMN IF NOT EXISTS cycle_quantity integer;
ALTER TABLE public.medication_administrations
  ADD COLUMN IF NOT EXISTS count_before integer,
  ADD COLUMN IF NOT EXISTS count_after integer;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS medical_history text;

CREATE TABLE public.medication_stock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  kind text NOT NULL,
  quantity integer,
  count_before integer,
  count_after integer,
  notes text,
  recorded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.medication_stock_events TO authenticated;
GRANT ALL ON public.medication_stock_events TO service_role;
ALTER TABLE public.medication_stock_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read stock events" ON public.medication_stock_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Medication staff add stock events" ON public.medication_stock_events FOR INSERT TO authenticated
  WITH CHECK (public.can_write(auth.uid(), 'give_medications') OR public.can_write(auth.uid(), 'manage_medications'));
CREATE TRIGGER audit_medication_stock_events AFTER INSERT ON public.medication_stock_events FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();