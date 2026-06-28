
-- Pain assessments (Abbey Pain Scale)
CREATE TABLE public.pain_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  assessed_by uuid REFERENCES auth.users(id),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  -- Abbey Pain Scale domain scores (0-3 each)
  vocalisation int NOT NULL DEFAULT 0 CHECK (vocalisation BETWEEN 0 AND 3),
  facial_expression int NOT NULL DEFAULT 0 CHECK (facial_expression BETWEEN 0 AND 3),
  body_language int NOT NULL DEFAULT 0 CHECK (body_language BETWEEN 0 AND 3),
  behaviour_change int NOT NULL DEFAULT 0 CHECK (behaviour_change BETWEEN 0 AND 3),
  physiological_change int NOT NULL DEFAULT 0 CHECK (physiological_change BETWEEN 0 AND 3),
  physical_change int NOT NULL DEFAULT 0 CHECK (physical_change BETWEEN 0 AND 3),
  total_score int NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'none', -- none|mild|moderate|severe
  pain_type text, -- chronic|acute|both
  source text NOT NULL DEFAULT 'manual', -- manual|ai_assisted
  ai_confidence numeric,
  ai_evidence jsonb,
  notes text,
  approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pain_assessments TO authenticated;
GRANT ALL ON public.pain_assessments TO service_role;
ALTER TABLE public.pain_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read pain" ON public.pain_assessments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert pain" ON public.pain_assessments FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update pain" ON public.pain_assessments FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff delete pain" ON public.pain_assessments FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_pain_updated BEFORE UPDATE ON public.pain_assessments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_pain_resident_date ON public.pain_assessments(resident_id, assessed_at DESC);

-- In-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  category text NOT NULL DEFAULT 'general', -- alert|approval|pain|assignment|general
  link text,
  resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'info', -- info|warning|critical
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user updates own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "staff insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "user deletes own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;

-- Trigger: when an alert gets assigned, notify the assignee
CREATE OR REPLACE FUNCTION public.notify_alert_assignee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resident_name text;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    SELECT full_name INTO resident_name FROM public.residents WHERE id = NEW.resident_id;
    INSERT INTO public.notifications (user_id, title, body, category, link, resident_id, severity)
    VALUES (
      NEW.assigned_to,
      'Alert assigned: ' || COALESCE(NEW.title, 'Clinical alert'),
      COALESCE('Resident: ' || resident_name, NEW.message),
      'assignment',
      '/alerts',
      NEW.resident_id,
      COALESCE(NEW.severity, 'info')
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_alert_assignee
AFTER INSERT OR UPDATE OF assigned_to ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.notify_alert_assignee();
