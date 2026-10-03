-- Family accounts must never count as staff
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND approved = true AND is_active = true AND role <> 'family')
$$;

CREATE POLICY "Family read own link" ON public.family_members FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.family_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  family_member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  period text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 2000),
  manager_response text,
  responded_by uuid,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.family_feedback TO authenticated;
GRANT ALL ON public.family_feedback TO service_role;
ALTER TABLE public.family_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read feedback" ON public.family_feedback FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Family read own feedback" ON public.family_feedback FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Family add feedback for linked resident" ON public.family_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND manager_response IS NULL AND EXISTS (
    SELECT 1 FROM public.family_members fm WHERE fm.user_id = auth.uid() AND fm.resident_id = family_feedback.resident_id));
CREATE POLICY "Managers respond" ON public.family_feedback FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER family_feedback_touch BEFORE UPDATE ON public.family_feedback FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_family_feedback AFTER INSERT OR UPDATE OR DELETE ON public.family_feedback FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();