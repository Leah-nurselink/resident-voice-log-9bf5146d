
-- =========================
-- CONSENTS
-- =========================
CREATE TYPE public.consent_status AS ENUM ('given','refused','withdrawn','pending');
CREATE TYPE public.consent_given_by AS ENUM ('resident','power_of_attorney','best_interests','next_of_kin');

CREATE TABLE public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  status public.consent_status NOT NULL DEFAULT 'pending',
  given_by public.consent_given_by NOT NULL DEFAULT 'resident',
  given_by_name text,
  date_given date,
  review_date date,
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consents TO authenticated;
GRANT ALL ON public.consents TO service_role;

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage consents"
  ON public.consents FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER consents_touch_updated_at
  BEFORE UPDATE ON public.consents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX consents_resident_idx ON public.consents(resident_id);

-- =========================
-- MCA ASSESSMENTS
-- =========================
CREATE TABLE public.mca_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  decision text NOT NULL,
  has_impairment boolean,
  impairment_detail text,
  can_understand boolean,
  can_retain boolean,
  can_weigh boolean,
  can_communicate boolean,
  has_capacity boolean,
  best_interests_decision text,
  decision_maker text,
  assessment_date date NOT NULL DEFAULT (now()::date),
  review_date date,
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mca_assessments TO authenticated;
GRANT ALL ON public.mca_assessments TO service_role;

ALTER TABLE public.mca_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage MCA"
  ON public.mca_assessments FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER mca_touch_updated_at
  BEFORE UPDATE ON public.mca_assessments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX mca_resident_idx ON public.mca_assessments(resident_id);

-- =========================
-- CARE PLAN HISTORY
-- =========================
CREATE TABLE public.care_plan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id uuid NOT NULL REFERENCES public.care_plans(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL,
  domain text NOT NULL,
  needs text,
  risks text,
  outcome text,
  content text,
  last_review date,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.care_plan_history TO authenticated;
GRANT ALL ON public.care_plan_history TO service_role;

ALTER TABLE public.care_plan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view care plan history"
  ON public.care_plan_history FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System inserts care plan history"
  ON public.care_plan_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX care_plan_history_plan_idx ON public.care_plan_history(care_plan_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.snapshot_care_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.care_plan_history (
    care_plan_id, resident_id, domain, needs, risks, outcome, content, last_review, changed_by
  ) VALUES (
    NEW.id, NEW.resident_id, NEW.domain, NEW.needs, NEW.risks, NEW.outcome, NEW.content, NEW.last_review, NEW.updated_by
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER care_plans_history_trigger
  AFTER INSERT OR UPDATE ON public.care_plans
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_care_plan();

-- =========================
-- RISK ASSESSMENT HISTORY
-- =========================
CREATE TABLE public.risk_assessment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_assessment_id uuid NOT NULL REFERENCES public.risk_assessments(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL,
  type text NOT NULL,
  level text NOT NULL,
  factors text,
  controls text,
  review_date date,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.risk_assessment_history TO authenticated;
GRANT ALL ON public.risk_assessment_history TO service_role;

ALTER TABLE public.risk_assessment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view risk history"
  ON public.risk_assessment_history FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System inserts risk history"
  ON public.risk_assessment_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX risk_history_assessment_idx ON public.risk_assessment_history(risk_assessment_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.snapshot_risk_assessment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.risk_assessment_history (
    risk_assessment_id, resident_id, type, level, factors, controls, review_date, changed_by
  ) VALUES (
    NEW.id, NEW.resident_id, NEW.type, NEW.level, NEW.factors, NEW.controls, NEW.review_date, NEW.updated_by
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER risk_assessments_history_trigger
  AFTER INSERT OR UPDATE ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_risk_assessment();
