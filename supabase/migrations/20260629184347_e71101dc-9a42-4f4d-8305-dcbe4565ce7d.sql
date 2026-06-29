ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS ambiguity_strategy TEXT NOT NULL DEFAULT 'skip'
  CHECK (ambiguity_strategy IN ('skip','prompt','open_all'));

CREATE TABLE IF NOT EXISTS public.pending_session_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggering_device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  candidate_resident_ids UUID[] NOT NULL,
  rssi INT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed','expired')),
  resolved_resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  resolved_session_id UUID REFERENCES public.care_sessions(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_session_decisions TO authenticated;
GRANT ALL ON public.pending_session_decisions TO service_role;

ALTER TABLE public.pending_session_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read pending decisions" ON public.pending_session_decisions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert pending decisions" ON public.pending_session_decisions
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update pending decisions" ON public.pending_session_decisions
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete pending decisions" ON public.pending_session_decisions
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS pending_session_decisions_updated_at ON public.pending_session_decisions;
CREATE TRIGGER pending_session_decisions_updated_at
  BEFORE UPDATE ON public.pending_session_decisions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS pending_session_decisions_status_idx
  ON public.pending_session_decisions(status, created_at DESC);