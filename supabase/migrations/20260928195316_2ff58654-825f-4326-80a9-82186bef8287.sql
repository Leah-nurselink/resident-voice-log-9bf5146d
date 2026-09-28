CREATE OR REPLACE FUNCTION public.set_inbound_token()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.inbound_token IS NULL THEN
    NEW.inbound_token := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  END IF;
  RETURN NEW;
END $function$;