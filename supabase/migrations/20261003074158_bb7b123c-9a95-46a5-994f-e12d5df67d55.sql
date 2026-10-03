ALTER TABLE public.care_schedules ADD COLUMN IF NOT EXISTS specific_date date;

CREATE OR REPLACE FUNCTION public.flag_care_deviations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    WITH cats AS (
      SELECT unnest(ARRAY['hydration','nutrition','continence','behaviour']) AS cat
    ), counts AS (
      SELECT res.id AS resident_id, res.full_name, c.cat,
        count(n.id) FILTER (WHERE n.created_at >= now() - interval '3 days') AS recent,
        count(n.id) FILTER (WHERE n.created_at < now() - interval '3 days' AND n.created_at >= now() - interval '17 days') AS baseline
      FROM residents res CROSS JOIN cats c
      LEFT JOIN daily_notes n ON n.resident_id = res.id AND n.status = 'approved'
        AND n.created_at >= now() - interval '17 days'
        AND (n.category = c.cat
          OR (c.cat = 'continence' AND (n.domain::text = 'continence' OR n.content ILIKE '%pad%' OR n.content ILIKE '%toilet%'))
          OR (c.cat = 'hydration' AND (n.content ILIKE '%drank%' OR n.content ILIKE '%fluid%'))
          OR (c.cat = 'nutrition' AND (n.domain::text = 'nutrition' OR n.content ILIKE '%ate %' OR n.content ILIKE '%meal%'))
          OR (c.cat = 'behaviour' AND (n.content ILIKE '%agitat%' OR n.content ILIKE '%aggress%' OR n.content ILIKE '%distress%')))
      WHERE res.discharge_date IS NULL
      GROUP BY res.id, res.full_name, c.cat
    )
    SELECT * FROM counts
    WHERE baseline >= 4 AND (
      (cat <> 'behaviour' AND recent::numeric / 3 < (baseline::numeric / 14) * 0.5)
      OR (cat = 'behaviour' AND recent::numeric / 3 > (baseline::numeric / 14) * 2 AND recent >= 2)
    )
  LOOP
    INSERT INTO alerts (resident_id, kind, message, severity, source, dedupe_key, payload, status)
    SELECT r.resident_id, 'care_deviation',
      CASE WHEN r.cat = 'behaviour'
        THEN r.full_name || ': more behaviour concerns recorded than usual (' || r.recent || ' in 3 days vs about ' || round(r.baseline::numeric/14*3,1) || ' usually). Please review.'
        ELSE r.full_name || ': fewer ' || r.cat || ' records than usual (' || r.recent || ' in 3 days vs about ' || round(r.baseline::numeric/14*3,1) || ' usually). Please review.'
      END,
      'warning', 'deviation_rules',
      'deviation:' || r.resident_id || ':' || r.cat || ':' || to_char(now(), 'IYYY-IW'),
      jsonb_build_object('category', r.cat, 'recent_3d', r.recent, 'baseline_14d', r.baseline),
      'open'
    WHERE NOT EXISTS (SELECT 1 FROM alerts a WHERE a.dedupe_key = 'deviation:' || r.resident_id || ':' || r.cat || ':' || to_char(now(), 'IYYY-IW'));
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.flag_care_deviations() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('flag-care-deviations', '15 6 * * *', $$ SELECT public.flag_care_deviations(); $$);