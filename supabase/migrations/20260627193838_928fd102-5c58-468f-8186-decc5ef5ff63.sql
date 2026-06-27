-- 1. Extend role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'nurse';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'md';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'family';

-- 2. Deactivation flag on user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3. is_staff now also requires the role to be active
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND approved = true AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND approved = true AND is_active = true
  )
$$;

-- 4. Per-user feature permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own permission rows so the UI can gate features
CREATE POLICY "Users read own permissions"
ON public.user_permissions FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Only admins can write
CREATE POLICY "Admins manage permissions"
ON public.user_permissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_permissions_updated
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Helper used by RLS/UI
CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _uid AND permission = _perm AND granted = true
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;