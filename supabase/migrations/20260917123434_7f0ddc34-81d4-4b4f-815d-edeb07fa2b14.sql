INSERT INTO public.user_permissions (user_id, permission, granted)
SELECT ur.user_id, p.perm, true
FROM public.user_roles ur
CROSS JOIN (VALUES ('manage_medications'),('administer_medication')) AS p(perm)
WHERE ur.approved AND ur.is_active
ON CONFLICT DO NOTHING;