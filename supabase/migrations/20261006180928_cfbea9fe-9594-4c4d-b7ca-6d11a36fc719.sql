-- Staff-facing read view of who holds which active role.
-- Security definer avoids the user_roles RLS restriction (people can normally
-- only see their own role) without opening the table itself.
create or replace function public.list_staff_roles()
returns table (user_id uuid, role app_role)
language sql
stable
security definer
set search_path = public
as $$
  select user_id, role
  from public.user_roles
  where approved = true and is_active = true
$$;

grant execute on function public.list_staff_roles() to authenticated;