
CREATE TABLE public.care_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  domain text NOT NULL,
  activity text NOT NULL,
  notes text,
  days_of_week int[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  window_start time NOT NULL,
  window_end time NOT NULL,
  specific_time time,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_schedules TO authenticated;
GRANT ALL ON public.care_schedules TO service_role;

ALTER TABLE public.care_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view care schedules" ON public.care_schedules
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert care schedules" ON public.care_schedules
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update care schedules" ON public.care_schedules
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete care schedules" ON public.care_schedules
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX idx_care_schedules_resident ON public.care_schedules(resident_id);

CREATE TRIGGER trg_care_schedules_updated
  BEFORE UPDATE ON public.care_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
