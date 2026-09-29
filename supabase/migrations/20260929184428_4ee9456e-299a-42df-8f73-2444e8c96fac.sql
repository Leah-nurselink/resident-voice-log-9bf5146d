drop function if exists public.has_permission(uuid, text);

create or replace function public.has_permission(_user_id uuid, _permission text)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_permissions up
    where up.user_id = _user_id
      and up.permission = _permission
      and up.granted = true
  );
$$;