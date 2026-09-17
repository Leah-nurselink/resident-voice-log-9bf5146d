
CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title text,
  employment_status text NOT NULL DEFAULT 'employed',
  contracted_hours numeric,
  start_date date,
  leaving_date date,
  phone text,
  restrictions text,
  restriction_tags text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_profiles TO authenticated;
GRANT ALL ON public.staff_profiles TO service_role;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view staff profiles" ON public.staff_profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Rota managers insert staff profiles" ON public.staff_profiles FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers update staff profiles" ON public.staff_profiles FOR UPDATE TO authenticated USING (public.can_write(auth.uid(),'manage_rota')) WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers delete staff profiles" ON public.staff_profiles FOR DELETE TO authenticated USING (public.can_write(auth.uid(),'manage_rota'));

CREATE TABLE public.staff_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  available boolean NOT NULL DEFAULT true,
  from_time time,
  to_time time,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_of_week)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_availability TO authenticated;
GRANT ALL ON public.staff_availability TO service_role;
ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view availability" ON public.staff_availability FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Rota managers insert availability" ON public.staff_availability FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers update availability" ON public.staff_availability FOR UPDATE TO authenticated USING (public.can_write(auth.uid(),'manage_rota')) WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers delete availability" ON public.staff_availability FOR DELETE TO authenticated USING (public.can_write(auth.uid(),'manage_rota'));

CREATE TABLE public.staff_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  level text,
  awarded_date date,
  expiry_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_qualifications TO authenticated;
GRANT ALL ON public.staff_qualifications TO service_role;
ALTER TABLE public.staff_qualifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view qualifications" ON public.staff_qualifications FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Rota managers insert qualifications" ON public.staff_qualifications FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers update qualifications" ON public.staff_qualifications FOR UPDATE TO authenticated USING (public.can_write(auth.uid(),'manage_rota')) WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers delete qualifications" ON public.staff_qualifications FOR DELETE TO authenticated USING (public.can_write(auth.uid(),'manage_rota'));

CREATE TABLE public.staff_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course text NOT NULL,
  completed_date date,
  renewal_due date,
  provider text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_training TO authenticated;
GRANT ALL ON public.staff_training TO service_role;
ALTER TABLE public.staff_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view training" ON public.staff_training FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Rota managers insert training" ON public.staff_training FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers update training" ON public.staff_training FOR UPDATE TO authenticated USING (public.can_write(auth.uid(),'manage_rota')) WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers delete training" ON public.staff_training FOR DELETE TO authenticated USING (public.can_write(auth.uid(),'manage_rota'));

CREATE TABLE public.staff_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill text NOT NULL,
  level text,
  signed_off_by uuid REFERENCES auth.users(id),
  signed_off_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_competencies TO authenticated;
GRANT ALL ON public.staff_competencies TO service_role;
ALTER TABLE public.staff_competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view competencies" ON public.staff_competencies FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Rota managers insert competencies" ON public.staff_competencies FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers update competencies" ON public.staff_competencies FOR UPDATE TO authenticated USING (public.can_write(auth.uid(),'manage_rota')) WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers delete competencies" ON public.staff_competencies FOR DELETE TO authenticated USING (public.can_write(auth.uid(),'manage_rota'));

CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text NOT NULL DEFAULT 'Main house',
  staff_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role app_role,
  cover_required boolean NOT NULL DEFAULT false,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_minutes integer,
  resident_ids uuid[] NOT NULL DEFAULT '{}',
  handover_status text NOT NULL DEFAULT 'not_started',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shifts_date_idx ON public.shifts (shift_date);
CREATE INDEX shifts_staff_idx ON public.shifts (staff_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view shifts" ON public.shifts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Rota managers insert shifts" ON public.shifts FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers update shifts" ON public.shifts FOR UPDATE TO authenticated USING (public.can_write(auth.uid(),'manage_rota') OR staff_user_id = auth.uid()) WITH CHECK (public.can_write(auth.uid(),'manage_rota') OR staff_user_id = auth.uid());
CREATE POLICY "Rota managers delete shifts" ON public.shifts FOR DELETE TO authenticated USING (public.can_write(auth.uid(),'manage_rota'));

CREATE TABLE public.shift_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_absences TO authenticated;
GRANT ALL ON public.shift_absences TO service_role;
ALTER TABLE public.shift_absences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view absences" ON public.shift_absences FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Rota managers insert absences" ON public.shift_absences FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers update absences" ON public.shift_absences FOR UPDATE TO authenticated USING (public.can_write(auth.uid(),'manage_rota')) WITH CHECK (public.can_write(auth.uid(),'manage_rota'));
CREATE POLICY "Rota managers delete absences" ON public.shift_absences FOR DELETE TO authenticated USING (public.can_write(auth.uid(),'manage_rota'));

CREATE TRIGGER staff_profiles_touch BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER staff_availability_touch BEFORE UPDATE ON public.staff_availability FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER staff_qualifications_touch BEFORE UPDATE ON public.staff_qualifications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER staff_training_touch BEFORE UPDATE ON public.staff_training FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER staff_competencies_touch BEFORE UPDATE ON public.staff_competencies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER shifts_touch BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_staff_profiles AFTER INSERT OR UPDATE OR DELETE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_staff_qualifications AFTER INSERT OR UPDATE OR DELETE ON public.staff_qualifications FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_staff_training AFTER INSERT OR UPDATE OR DELETE ON public.staff_training FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_shifts AFTER INSERT OR UPDATE OR DELETE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();

INSERT INTO public.user_permissions (user_id, permission, granted)
SELECT ur.user_id, 'manage_rota', true
FROM public.user_roles ur
WHERE ur.approved = true AND ur.is_active = true AND ur.role IN ('admin','manager','nurse')
ON CONFLICT DO NOTHING;
