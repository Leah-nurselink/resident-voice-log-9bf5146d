
-- 1) Fix handle_new_user: do not auto-approve carer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  -- Insert role as unapproved + inactive; admin must approve before staff access is granted
  INSERT INTO public.user_roles (user_id, role, approved, is_active)
  VALUES (NEW.id, 'carer', false, false);
  RETURN NEW;
END;
$function$;

-- 2) Revoke EXECUTE on SECURITY DEFINER helpers from anon/authenticated.
-- These are called from RLS policies and DB triggers, which run with the function owner's
-- privileges regardless of grants, so RLS keeps working.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_alert_assignee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_communication_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_care_plan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_risk_assessment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_inbound_token() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
