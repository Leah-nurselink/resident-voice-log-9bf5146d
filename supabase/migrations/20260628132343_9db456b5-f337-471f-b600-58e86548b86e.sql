
-- 1. Extend communications with call-specific + provider-agnostic columns
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS call_provider text DEFAULT 'device_mic',
  ADD COLUMN IF NOT EXISTS call_status text,
  ADD COLUMN IF NOT EXISTS call_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS contact_type text,
  ADD COLUMN IF NOT EXISTS contact_id uuid,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS provider_call_id text;

CREATE INDEX IF NOT EXISTS communications_resident_created_idx
  ON public.communications (resident_id, created_at DESC);

-- 2. Audit trail table
CREATE TABLE IF NOT EXISTS public.communication_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.communication_audit TO authenticated;
GRANT ALL ON public.communication_audit TO service_role;

ALTER TABLE public.communication_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view comm audit"
  ON public.communication_audit FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert comm audit"
  ON public.communication_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS communication_audit_comm_idx
  ON public.communication_audit (communication_id, created_at DESC);

-- 3. Trigger: record audit rows automatically
CREATE OR REPLACE FUNCTION public.log_communication_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_actor uuid := auth.uid();
  v_details jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_details := jsonb_build_object(
      'direction', NEW.direction,
      'channel', NEW.channel,
      'status', NEW.status,
      'subject', NEW.subject,
      'contact_name', NEW.contact_name
    );
    INSERT INTO public.communication_audit (communication_id, actor_id, action, details)
    VALUES (NEW.id, COALESCE(NEW.created_by, v_actor), v_action, v_details);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.communication_audit (communication_id, actor_id, action, details)
      VALUES (NEW.id, v_actor, 'status_changed',
              jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by AND NEW.approved_by IS NOT NULL THEN
      INSERT INTO public.communication_audit (communication_id, actor_id, action, details)
      VALUES (NEW.id, v_actor, 'approved', jsonb_build_object('approved_by', NEW.approved_by));
    END IF;
    IF NEW.sent_at IS DISTINCT FROM OLD.sent_at AND NEW.sent_at IS NOT NULL THEN
      INSERT INTO public.communication_audit (communication_id, actor_id, action, details)
      VALUES (NEW.id, v_actor, 'sent', jsonb_build_object('sent_at', NEW.sent_at));
    END IF;
    IF NEW.body IS DISTINCT FROM OLD.body OR NEW.subject IS DISTINCT FROM OLD.subject
       OR NEW.outcome IS DISTINCT FROM OLD.outcome THEN
      INSERT INTO public.communication_audit (communication_id, actor_id, action, details)
      VALUES (NEW.id, v_actor, 'edited',
              jsonb_build_object(
                'subject_changed', NEW.subject IS DISTINCT FROM OLD.subject,
                'body_changed', NEW.body IS DISTINCT FROM OLD.body,
                'outcome_changed', NEW.outcome IS DISTINCT FROM OLD.outcome
              ));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_communications_audit ON public.communications;
CREATE TRIGGER trg_communications_audit
AFTER INSERT OR UPDATE ON public.communications
FOR EACH ROW EXECUTE FUNCTION public.log_communication_audit();
