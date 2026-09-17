
-- 1. Permission-scoped writes on sensitive clinical records
CREATE OR REPLACE FUNCTION public.can_write(_uid uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(_uid) AND (
    public.has_permission(_uid, _perm)
    OR public.has_role(_uid, 'admin')
    OR public.has_role(_uid, 'manager')
  )
$$;

DROP POLICY IF EXISTS "Staff insert consents" ON public.consents;
DROP POLICY IF EXISTS "Staff update consents" ON public.consents;
DROP POLICY IF EXISTS "Staff delete consents" ON public.consents;
CREATE POLICY "Permitted staff insert consents" ON public.consents FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(), 'edit_consent'));
CREATE POLICY "Permitted staff update consents" ON public.consents FOR UPDATE TO authenticated USING (public.can_write(auth.uid(), 'edit_consent')) WITH CHECK (public.can_write(auth.uid(), 'edit_consent'));
CREATE POLICY "Permitted staff delete consents" ON public.consents FOR DELETE TO authenticated USING (public.can_write(auth.uid(), 'edit_consent'));

DROP POLICY IF EXISTS "Staff insert mca" ON public.mca_assessments;
DROP POLICY IF EXISTS "Staff update mca" ON public.mca_assessments;
DROP POLICY IF EXISTS "Staff delete mca" ON public.mca_assessments;
CREATE POLICY "Permitted staff insert mca" ON public.mca_assessments FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(), 'edit_mca'));
CREATE POLICY "Permitted staff update mca" ON public.mca_assessments FOR UPDATE TO authenticated USING (public.can_write(auth.uid(), 'edit_mca')) WITH CHECK (public.can_write(auth.uid(), 'edit_mca'));
CREATE POLICY "Permitted staff delete mca" ON public.mca_assessments FOR DELETE TO authenticated USING (public.can_write(auth.uid(), 'edit_mca'));

DROP POLICY IF EXISTS "Staff insert wounds" ON public.wounds;
DROP POLICY IF EXISTS "Staff update wounds" ON public.wounds;
DROP POLICY IF EXISTS "Staff delete wounds" ON public.wounds;
CREATE POLICY "Permitted staff insert wounds" ON public.wounds FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(), 'manage_wounds'));
CREATE POLICY "Permitted staff update wounds" ON public.wounds FOR UPDATE TO authenticated USING (public.can_write(auth.uid(), 'manage_wounds')) WITH CHECK (public.can_write(auth.uid(), 'manage_wounds'));
CREATE POLICY "Permitted staff delete wounds" ON public.wounds FOR DELETE TO authenticated USING (public.can_write(auth.uid(), 'manage_wounds'));

DROP POLICY IF EXISTS "Staff insert wound_assessments" ON public.wound_assessments;
DROP POLICY IF EXISTS "Staff update wound_assessments" ON public.wound_assessments;
DROP POLICY IF EXISTS "Staff delete wound_assessments" ON public.wound_assessments;
CREATE POLICY "Permitted staff insert wound_assessments" ON public.wound_assessments FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid(), 'manage_wounds'));
CREATE POLICY "Permitted staff update wound_assessments" ON public.wound_assessments FOR UPDATE TO authenticated USING (public.can_write(auth.uid(), 'manage_wounds')) WITH CHECK (public.can_write(auth.uid(), 'manage_wounds'));
CREATE POLICY "Permitted staff delete wound_assessments" ON public.wound_assessments FOR DELETE TO authenticated USING (public.can_write(auth.uid(), 'manage_wounds'));

-- 2. Generic change history
CREATE TABLE public.record_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  resident_id uuid,
  action text NOT NULL,
  actor_id uuid,
  changed_fields text[],
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.record_audit TO authenticated;
GRANT ALL ON public.record_audit TO service_role;

ALTER TABLE public.record_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers read record audit" ON public.record_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE INDEX idx_record_audit_table_record ON public.record_audit (table_name, record_id, created_at DESC);
CREATE INDEX idx_record_audit_resident ON public.record_audit (resident_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_record_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_changed text[];
  v_record uuid;
  v_resident uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key) INTO v_changed
    FROM jsonb_each(v_new) n
    WHERE n.value IS DISTINCT FROM (v_old -> n.key);
    IF v_changed IS NULL OR v_changed = ARRAY['updated_at']::text[] THEN
      RETURN NEW;
    END IF;
  END IF;

  v_record := NULLIF(COALESCE(v_new, v_old) ->> 'id', '')::uuid;
  IF TG_TABLE_NAME = 'residents' THEN
    v_resident := v_record;
  ELSE
    BEGIN
      v_resident := NULLIF(COALESCE(v_new, v_old) ->> 'resident_id', '')::uuid;
    EXCEPTION WHEN others THEN v_resident := NULL;
    END;
  END IF;

  INSERT INTO public.record_audit (table_name, record_id, resident_id, action, actor_id, changed_fields, old_data, new_data)
  VALUES (TG_TABLE_NAME, v_record, v_resident, lower(TG_OP), auth.uid(), v_changed, v_old, v_new);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_residents AFTER INSERT OR UPDATE OR DELETE ON public.residents FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_consents AFTER INSERT OR UPDATE OR DELETE ON public.consents FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_mca_assessments AFTER INSERT OR UPDATE OR DELETE ON public.mca_assessments FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_wounds AFTER INSERT OR UPDATE OR DELETE ON public.wounds FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_wound_assessments AFTER INSERT OR UPDATE OR DELETE ON public.wound_assessments FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_alerts AFTER INSERT OR UPDATE OR DELETE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_devices AFTER INSERT OR UPDATE OR DELETE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
CREATE TRIGGER audit_user_permissions AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
