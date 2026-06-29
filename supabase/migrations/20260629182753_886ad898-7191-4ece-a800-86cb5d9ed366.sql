
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS beacon_protocol text NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS beacon_uuid text,
  ADD COLUMN IF NOT EXISTS beacon_major integer,
  ADD COLUMN IF NOT EXISTS beacon_minor integer,
  ADD COLUMN IF NOT EXISTS tx_power integer,
  ADD COLUMN IF NOT EXISTS rssi_threshold integer NOT NULL DEFAULT -75,
  ADD COLUMN IF NOT EXISTS session_timeout_seconds integer NOT NULL DEFAULT 60;

CREATE INDEX IF NOT EXISTS devices_beacon_lookup_idx
  ON public.devices (beacon_protocol, beacon_uuid, beacon_major, beacon_minor);

ALTER TABLE public.care_sessions
  ADD COLUMN IF NOT EXISTS end_reason text,
  ADD COLUMN IF NOT EXISTS triggering_device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL;
