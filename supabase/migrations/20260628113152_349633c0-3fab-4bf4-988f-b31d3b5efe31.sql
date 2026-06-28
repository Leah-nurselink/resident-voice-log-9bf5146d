
-- 1. Professional directory
CREATE TABLE public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  organisation text,
  email text,
  phone text,
  address text,
  speciality text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read pro" ON public.professionals FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write pro" ON public.professionals FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER pro_touch BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Communications (outbound + inbound)
CREATE TABLE public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','letter','referral','summary','phone')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','approved','sent','failed','received','processed')),
  subject text,
  body text NOT NULL,
  raw_input text,
  ai_summary text,
  recipient_email text,
  recipient_name text,
  sender_email text,
  sender_name text,
  from_message_id text,
  in_reply_to text,
  external_message_id text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  family_share_consent boolean NOT NULL DEFAULT false,
  family_summary text,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comms_resident_idx ON public.communications(resident_id, created_at DESC);
CREATE INDEX comms_direction_idx ON public.communications(direction, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communications TO authenticated;
GRANT ALL ON public.communications TO service_role;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read comms" ON public.communications FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write comms" ON public.communications FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER comms_touch BEFORE UPDATE ON public.communications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Extracted actions/tasks from incoming communications
CREATE TABLE public.communication_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('recommendation','appointment','referral','investigation','monitoring','follow_up','medication','other')),
  title text NOT NULL,
  detail text,
  due_date date,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','dismissed')),
  assigned_to uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comm_tasks_resident_idx ON public.communication_tasks(resident_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_tasks TO authenticated;
GRANT ALL ON public.communication_tasks TO service_role;
ALTER TABLE public.communication_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read ct" ON public.communication_tasks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write ct" ON public.communication_tasks FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER ct_touch BEFORE UPDATE ON public.communication_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Notification preferences (email digest opt-in)
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_on_assignment boolean NOT NULL DEFAULT true,
  email_on_critical boolean NOT NULL DEFAULT true,
  email_address text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs" ON public.notification_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER np_touch BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Add a slug/inbound match token on residents for inbound email routing
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS inbound_token text UNIQUE;

-- Seed inbound_token for existing residents
UPDATE public.residents SET inbound_token = encode(gen_random_bytes(6), 'hex') WHERE inbound_token IS NULL;

-- Auto-generate on insert
CREATE OR REPLACE FUNCTION public.set_inbound_token()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.inbound_token IS NULL THEN
    NEW.inbound_token := encode(gen_random_bytes(6), 'hex');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS resident_inbound_token ON public.residents;
CREATE TRIGGER resident_inbound_token BEFORE INSERT ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.set_inbound_token();
