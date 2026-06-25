
CREATE TABLE public.wounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  side TEXT,
  wound_type TEXT,
  category TEXT,
  cause TEXT,
  date_noticed DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'open',
  date_healed DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wounds TO authenticated;
GRANT ALL ON public.wounds TO service_role;
ALTER TABLE public.wounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage wounds" ON public.wounds FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER touch_wounds_updated BEFORE UPDATE ON public.wounds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.wound_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wound_id UUID NOT NULL REFERENCES public.wounds(id) ON DELETE CASCADE,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  length_cm NUMERIC(5,2),
  width_cm NUMERIC(5,2),
  depth_cm NUMERIC(5,2),
  tissue_type TEXT,
  exudate_amount TEXT,
  exudate_type TEXT,
  odour BOOLEAN DEFAULT false,
  pain_score INTEGER,
  surrounding_skin TEXT,
  dressing TEXT,
  treatment_plan TEXT,
  observations TEXT,
  assessed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wound_assessments TO authenticated;
GRANT ALL ON public.wound_assessments TO service_role;
ALTER TABLE public.wound_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage wound assessments" ON public.wound_assessments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_wounds_resident ON public.wounds(resident_id);
CREATE INDEX idx_wound_assessments_wound ON public.wound_assessments(wound_id, assessed_at DESC);
