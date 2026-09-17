
REVOKE ALL ON FUNCTION public.log_record_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_write(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write(uuid, text) TO authenticated;
