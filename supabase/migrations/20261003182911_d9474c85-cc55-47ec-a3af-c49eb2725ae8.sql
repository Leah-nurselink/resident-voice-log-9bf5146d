CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  incident_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  location text,
  description text NOT NULL,
  immediate_action text,
  injuries text,
  witnesses text,
  people_notified text,
  safeguarding_concern boolean NOT NULL DEFAULT false,
  reported_by uuid DEFAULT auth.uid(),
  reporter_name text,
  status text NOT NULL DEFAULT 'open',
  manager_review text,
  root_cause text,
  lessons_learned text,
  follow_up_actions text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incidents_status_chk CHECK (status IN ('open','under_review','closed')),
  CONSTRAINT incidents_severity_chk CHECK (severity IN ('low','moderate','high','critical'))
);
GRANT SELECT, INSERT, UPDATE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view incidents" ON public.incidents FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff report incidents" ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND reported_by = auth.uid() AND status = 'open');
CREATE POLICY "Managers review incidents" ON public.incidents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE OR REPLACE FUNCTION public.validate_incident_close()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'closed' AND (NEW.manager_review IS NULL OR btrim(NEW.manager_review) = '') THEN
    RAISE EXCEPTION 'A manager review is required before closing an incident';
  END IF;
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    NEW.closed_at := now(); NEW.closed_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER incidents_validate BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.validate_incident_close();
CREATE TRIGGER incidents_touch BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_incidents AFTER INSERT OR UPDATE OR DELETE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();