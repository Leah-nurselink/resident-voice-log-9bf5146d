
-- Device types enum
CREATE TYPE public.device_type AS ENUM ('room_beacon', 'wearable_tag', 'staff_badge');
CREATE TYPE public.device_status AS ENUM ('active', 'inactive', 'lost', 'maintenance');

-- Rooms table (light - mainly for beacon assignment)
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  floor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read rooms" ON public.rooms FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage rooms" ON public.rooms FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER rooms_touch BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Devices
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_type public.device_type NOT NULL,
  label TEXT NOT NULL,
  ble_identifier TEXT NOT NULL UNIQUE,
  mac_address TEXT,
  manufacturer TEXT,
  model TEXT,
  firmware TEXT,
  status public.device_status NOT NULL DEFAULT 'active',
  battery_level INT CHECK (battery_level BETWEEN 0 AND 100),
  last_seen_at TIMESTAMPTZ,
  last_rssi INT,
  -- assignments (exactly one populated based on device_type)
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  staff_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paired_at TIMESTAMPTZ,
  paired_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read devices" ON public.devices FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage devices" ON public.devices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER devices_touch BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX devices_type_idx ON public.devices(device_type);

-- Device events (history: scan, pair, assign, battery, status changes)
CREATE TABLE public.device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  rssi INT,
  battery_level INT,
  payload JSONB,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.device_events TO authenticated;
GRANT ALL ON public.device_events TO service_role;
ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read device events" ON public.device_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert device events" ON public.device_events FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX device_events_device_idx ON public.device_events(device_id, created_at DESC);

-- Care sessions auto-initiated by confidence engine
CREATE TABLE public.care_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  staff_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confidence NUMERIC(4,3) NOT NULL,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  auto_initiated BOOLEAN NOT NULL DEFAULT true,
  note_id UUID REFERENCES public.daily_notes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_sessions TO authenticated;
GRANT ALL ON public.care_sessions TO service_role;
ALTER TABLE public.care_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read care sessions" ON public.care_sessions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage care sessions" ON public.care_sessions FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER care_sessions_touch BEFORE UPDATE ON public.care_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX care_sessions_resident_idx ON public.care_sessions(resident_id, started_at DESC);
