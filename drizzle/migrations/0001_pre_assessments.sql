CREATE TABLE public.pre_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision text CHECK (decision IN ('accepted','accepted_conditions','further_assessment','declined')),
  decision_rationale text,
  assessor_id uuid,
  assessor_name text,
  assessor_role text,
  assessed_on date,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pre_assessments_resident_idx ON public.pre_assessments(resident_id, version DESC);
GRANT SELECT, INSERT, UPDATE ON public.pre_assessments TO authenticated;
GRANT ALL ON public.pre_assessments TO service_role;
ALTER TABLE public.pre_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read pre_assessments" ON public.pre_assessments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert pre_assessments" ON public.pre_assessments FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND status <> 'approved');
CREATE POLICY "Staff update pre_assessments" ON public.pre_assessments FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_pre_assessment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Signed-off pre-assessments are locked. Start a new version.';
  END IF;
  IF NEW.status = 'approved' THEN
    IF NOT (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'md') OR public.has_role(auth.uid(),'nurse')) THEN
      RAISE EXCEPTION 'Only a manager or clinical lead can sign off a pre-assessment.';
    END IF;
    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER guard_pre_assessments BEFORE UPDATE ON public.pre_assessments FOR EACH ROW EXECUTE FUNCTION public.guard_pre_assessment();
CREATE TRIGGER audit_pre_assessments AFTER INSERT OR UPDATE OR DELETE ON public.pre_assessments FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();