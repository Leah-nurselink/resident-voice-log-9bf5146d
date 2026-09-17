CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  name text NOT NULL,
  form text,
  dose text,
  route text,
  frequency_text text,
  times time[] NOT NULL DEFAULT '{}',
  days_of_week int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  is_prn boolean NOT NULL DEFAULT false,
  prn_indication text,
  prn_min_interval_minutes int,
  prn_max_doses_24h int,
  indication text,
  instructions text,
  start_date date,
  end_date date,
  review_date date,
  prescriber text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','stopped')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view medications" ON public.medications
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Permitted staff can add medications" ON public.medications
  FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(), 'manage_medications'));
CREATE POLICY "Permitted staff can edit medications" ON public.medications
  FOR UPDATE TO authenticated USING (public.can_write(auth.uid(), 'manage_medications'))
  WITH CHECK (public.can_write(auth.uid(), 'manage_medications'));
CREATE POLICY "Permitted staff can remove medications" ON public.medications
  FOR DELETE TO authenticated USING (public.can_write(auth.uid(), 'manage_medications'));

CREATE INDEX medications_resident_idx ON public.medications(resident_id, status);
CREATE INDEX medications_review_idx ON public.medications(review_date) WHERE review_date IS NOT NULL;

CREATE TRIGGER medications_touch BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_medications AFTER INSERT OR UPDATE OR DELETE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();

CREATE TABLE public.medication_administrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  scheduled_time time,
  status text NOT NULL CHECK (status IN ('given','refused','omitted','not_available','other')),
  reason text,
  action_taken text,
  dose_given text,
  administered_by uuid REFERENCES auth.users(id),
  administered_at timestamptz NOT NULL DEFAULT now(),
  effectiveness text,
  effectiveness_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.medication_administrations TO authenticated;
GRANT ALL ON public.medication_administrations TO service_role;
ALTER TABLE public.medication_administrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view administrations" ON public.medication_administrations
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Permitted staff can record administrations" ON public.medication_administrations
  FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(), 'administer_medication'));
CREATE POLICY "Permitted staff can amend administrations" ON public.medication_administrations
  FOR UPDATE TO authenticated USING (public.can_write(auth.uid(), 'administer_medication'))
  WITH CHECK (public.can_write(auth.uid(), 'administer_medication'));

CREATE UNIQUE INDEX medication_admin_slot_idx
  ON public.medication_administrations(medication_id, scheduled_date, scheduled_time)
  WHERE scheduled_time IS NOT NULL;
CREATE INDEX medication_admin_resident_idx
  ON public.medication_administrations(resident_id, administered_at DESC);

CREATE TRIGGER medication_admin_touch BEFORE UPDATE ON public.medication_administrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_medication_admin AFTER INSERT OR UPDATE OR DELETE ON public.medication_administrations
  FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();