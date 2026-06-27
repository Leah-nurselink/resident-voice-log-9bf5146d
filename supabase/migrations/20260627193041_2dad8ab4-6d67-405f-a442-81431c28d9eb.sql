-- Add approval gate to user_roles so self-signup doesn't grant staff access
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- Grandfather existing users so current staff don't lose access
UPDATE public.user_roles SET approved = true WHERE approved = false;

-- Tighten is_staff to require an approved role
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND approved = true)
$$;

-- Tighten has_role similarly
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role AND approved = true)
$$;

-- New self-signups get a pending carer role; an admin must approve before access is granted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role, approved) VALUES (NEW.id, 'carer', false);
  RETURN NEW;
END;
$$;