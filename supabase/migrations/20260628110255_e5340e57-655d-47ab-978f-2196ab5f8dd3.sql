
-- ============ ALERTS: workflow fields ============
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alerts_status_check'
  ) THEN
    ALTER TABLE public.alerts
      ADD CONSTRAINT alerts_status_check
      CHECK (status IN ('open','acknowledged','resolved','dismissed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS alerts_dedupe_open_idx
  ON public.alerts(dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('open','acknowledged');

DROP TRIGGER IF EXISTS alerts_touch_updated_at ON public.alerts;
CREATE TRIGGER alerts_touch_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ AI RECOMMENDATIONS ============
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('recommendation','care_gap','prediction','deterioration','plan_review','safeguarding')),
  domain text,
  title text NOT NULL,
  detail text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','actioned')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  applied_care_plan_id uuid REFERENCES public.care_plans(id) ON DELETE SET NULL,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;

ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read ai recs" ON public.ai_recommendations
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert ai recs" ON public.ai_recommendations
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update ai recs" ON public.ai_recommendations
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff delete ai recs" ON public.ai_recommendations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS ai_recs_dedupe_pending_idx
  ON public.ai_recommendations(dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS ai_recs_resident_idx ON public.ai_recommendations(resident_id, status);

DROP TRIGGER IF EXISTS ai_recs_touch_updated_at ON public.ai_recommendations;
CREATE TRIGGER ai_recs_touch_updated_at
  BEFORE UPDATE ON public.ai_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
