ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS lessons_shared_until timestamptz;
CREATE TABLE public.incident_lesson_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, user_id)
);
GRANT SELECT, INSERT ON public.incident_lesson_reads TO authenticated;
GRANT ALL ON public.incident_lesson_reads TO service_role;
ALTER TABLE public.incident_lesson_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view lesson reads" ON public.incident_lesson_reads FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff record own read" ON public.incident_lesson_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()));