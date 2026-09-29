CREATE OR REPLACE FUNCTION public.flag_due_care_reviews()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.alerts (resident_id, kind, message, severity, status, source, dedupe_key, payload)
  SELECT cp.resident_id, 'care_plan_review_due',
    'Care plan review due: ' || replace(cp.domain::text, '_', ' '),
    (CASE WHEN cp.last_review < current_date - 44 THEN 'critical' ELSE 'warning' END)::alert_severity,
    'open', 'system', 'cp_review:' || cp.id,
    jsonb_build_object('care_plan_id', cp.id, 'last_review', cp.last_review)
  FROM public.care_plans cp
  WHERE cp.last_review IS NOT NULL AND cp.last_review <= current_date - 30
    AND NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.dedupe_key = 'cp_review:' || cp.id AND a.status IN ('open','acknowledged'));

  INSERT INTO public.alerts (resident_id, kind, message, severity, status, source, dedupe_key, payload)
  SELECT ra.resident_id, 'risk_review_due',
    'Risk assessment review due: ' || replace(ra.type::text, '_', ' '),
    (CASE WHEN ra.level = 'high' THEN 'critical' ELSE 'warning' END)::alert_severity,
    'open', 'system', 'ra_review:' || ra.id,
    jsonb_build_object('risk_assessment_id', ra.id, 'review_date', ra.review_date)
  FROM public.risk_assessments ra
  WHERE ra.review_date IS NOT NULL AND ra.review_date <= current_date
    AND NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.dedupe_key = 'ra_review:' || ra.id AND a.status IN ('open','acknowledged'));
END $$;
REVOKE EXECUTE ON FUNCTION public.flag_due_care_reviews() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('flag-due-care-reviews', '0 6 * * *', $$SELECT public.flag_due_care_reviews();$$);
SELECT public.flag_due_care_reviews();