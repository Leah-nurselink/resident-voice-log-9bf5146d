-- ============ PHASE 1: SHARED ROTA CORE ============

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_type text not null check (service_type in ('domiciliary','care_home')),
  address text,
  settings jsonb not null default '{"rest_gap_hours": 11}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "Staff view services" on public.services for select to authenticated using (public.is_staff(auth.uid()));
create policy "Rota managers manage services" on public.services for all to authenticated using (public.can_write(auth.uid(), 'manage_rota')) with check (public.can_write(auth.uid(), 'manage_rota'));
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();
create trigger audit_services after insert or update or delete on public.services for each row execute function public.log_record_audit();

create table public.staff_services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, service_id)
);
grant select, insert, update, delete on public.staff_services to authenticated;
grant all on public.staff_services to service_role;
alter table public.staff_services enable row level security;
create policy "Staff view service links" on public.staff_services for select to authenticated using (public.is_staff(auth.uid()));
create policy "Rota managers manage service links" on public.staff_services for all to authenticated using (public.can_write(auth.uid(), 'manage_rota')) with check (public.can_write(auth.uid(), 'manage_rota'));

create table public.staff_leave (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  leave_type text not null check (leave_type in ('annual_leave','sick','other')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.staff_leave to authenticated;
grant all on public.staff_leave to service_role;
alter table public.staff_leave enable row level security;
create policy "Staff view own leave" on public.staff_leave for select to authenticated using (user_id = auth.uid() or public.can_write(auth.uid(), 'manage_rota'));
create policy "Rota managers manage leave" on public.staff_leave for all to authenticated using (public.can_write(auth.uid(), 'manage_rota')) with check (public.can_write(auth.uid(), 'manage_rota'));
create trigger staff_leave_touch before update on public.staff_leave for each row execute function public.touch_updated_at();
create trigger audit_staff_leave after insert or update or delete on public.staff_leave for each row execute function public.log_record_audit();

alter table public.staff_profiles
  add column if not exists skills text[] not null default '{}',
  add column if not exists home_zone text,
  add column if not exists max_weekly_hours numeric,
  add column if not exists wants_extra_shifts boolean not null default false;

alter table public.shifts add column if not exists service_id uuid references public.services(id) on delete set null;

create policy "Staff can update their own staff profile" on public.staff_profiles for update to authenticated using (user_id = auth.uid() and public.is_staff(auth.uid())) with check (user_id = auth.uid());
create policy "Staff can add their own availability" on public.staff_availability for insert to authenticated with check (user_id = auth.uid() and public.is_staff(auth.uid()));
create policy "Staff can update their own availability" on public.staff_availability for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ SEED: two services + sample rota data for testing ============

insert into public.services (name, service_type)
select v.name, v.stype from (values ('Home care service','domiciliary'),('Care home service','care_home')) as v(name,stype)
where not exists (select 1 from public.services);

insert into public.staff_services (user_id, service_id)
select r.user_id, s.id from public.user_roles r cross join public.services s
where r.approved and r.is_active and r.role <> 'family'
on conflict do nothing;

insert into public.staff_profiles (user_id, employment_status)
select r.user_id, 'employed' from public.user_roles r
where r.approved and r.is_active and r.role <> 'family'
  and not exists (select 1 from public.staff_profiles sp where sp.user_id = r.user_id);

update public.staff_profiles sp set skills = v.skills, max_weekly_hours = v.max_hours, wants_extra_shifts = v.extra
from (values
  ('17050738-e94b-496a-897f-4e0e03c5b824'::uuid, array['medication_trained','moving_handling']::text[], 40, true),
  ('9219bc6b-0dde-48e2-9506-f6892a6f3f01'::uuid, array['senior','medication_trained','moving_handling','double_up']::text[], 40, false),
  ('c0d1d22b-f5ae-44d3-89a8-ab3eaa673dc3'::uuid, array['senior','medication_trained']::text[], 40, false)
) as v(uid, skills, max_hours, extra)
where sp.user_id = v.uid;

insert into public.shifts (shift_date, start_time, end_time, location, staff_user_id, role, cover_required, resident_ids, handover_status, service_id)
select (current_date + v.day_offset)::date, v.start_time::time, v.end_time::time, s.name, v.uid, v.role::app_role, v.cover, '{}'::uuid[], 'not_started', s.id
from (values
  (1, '07:00', '15:00', '17050738-e94b-496a-897f-4e0e03c5b824'::uuid, 'carer', false),
  (2, '14:00', '22:00', '17050738-e94b-496a-897f-4e0e03c5b824'::uuid, 'carer', false),
 (3, '07:00', '15:00', '9219bc6b-0dde-48e2-9506-f6892a6f3f01'::uuid, 'manager', false),
  (4, '21:00', '07:00', '17050738-e94b-496a-897f-4e0e03c5b824'::uuid, 'carer', false),
  (5, '07:00', '15:00', null::uuid, 'carer', false),
  (1, '14:00', '22:00', null::uuid, 'carer', true)
) as v(day_offset, start_time, end_time, uid, role, cover)
cross join public.services s
where s.service_type = 'care_home'
  and not exists (select 1 from public.shifts sh where sh.service_id = s.id);

insert into public.staff_leave (user_id, leave_type, start_date, end_date, notes, created_by)
select '17050738-e94b-496a-897f-4e0e03c5b824'::uuid, 'annual_leave', current_date + 7, current_date + 10, 'Sample leave so you can test the assignment rules', '17050738-e94b-496a-897f-4e0e03c5b824'::uuid
where not exists (select 1 from public.staff_leave);