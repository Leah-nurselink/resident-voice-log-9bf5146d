INSERT INTO public.user_permissions (user_id, permission, granted)
SELECT ur.user_id, p.perm, true
FROM public.user_roles ur
CROSS JOIN (VALUES ('manage_wounds')) AS p(perm)
WHERE ur.approved = true AND ur.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = ur.user_id AND up.permission = p.perm
  );