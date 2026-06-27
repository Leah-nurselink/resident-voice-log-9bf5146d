
-- Staff role helper (security definer to avoid recursion through user_roles RLS)
create or replace function public.is_staff(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _uid)
$$;

revoke execute on function public.is_staff(uuid) from public, anon;
grant execute on function public.is_staff(uuid) to authenticated;

-- ============ residents ============
drop policy if exists "Staff full access residents" on public.residents;
create policy "Staff read residents" on public.residents
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff write residents" on public.residents
  for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update residents" on public.residents
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete residents" on public.residents
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ care_plans ============
drop policy if exists "Staff full access care_plans" on public.care_plans;
create policy "Staff read care_plans" on public.care_plans
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert care_plans" on public.care_plans
  for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update care_plans" on public.care_plans
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete care_plans" on public.care_plans
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ care_plan_history ============
drop policy if exists "Staff can view care plan history" on public.care_plan_history;
drop policy if exists "System inserts care plan history" on public.care_plan_history;
create policy "Staff read care_plan_history" on public.care_plan_history
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert care_plan_history" on public.care_plan_history
  for insert to authenticated with check (public.is_staff(auth.uid()));

-- ============ risk_assessments ============
drop policy if exists "Staff full access risk_assessments" on public.risk_assessments;
create policy "Staff read risk_assessments" on public.risk_assessments
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert risk_assessments" on public.risk_assessments
  for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update risk_assessments" on public.risk_assessments
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete risk_assessments" on public.risk_assessments
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ risk_assessment_history ============
drop policy if exists "Staff can view risk history" on public.risk_assessment_history;
drop policy if exists "System inserts risk history" on public.risk_assessment_history;
create policy "Staff read risk_history" on public.risk_assessment_history
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert risk_history" on public.risk_assessment_history
  for insert to authenticated with check (public.is_staff(auth.uid()));

-- ============ daily_notes ============
drop policy if exists "Staff full access daily_notes" on public.daily_notes;
create policy "Staff read daily_notes" on public.daily_notes
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert daily_notes" on public.daily_notes
  for insert to authenticated with check (public.is_staff(auth.uid()) and author_id = auth.uid());
create policy "Staff update daily_notes" on public.daily_notes
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete daily_notes" on public.daily_notes
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ wounds ============
drop policy if exists "Staff can manage wounds" on public.wounds;
create policy "Staff read wounds" on public.wounds
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert wounds" on public.wounds
  for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update wounds" on public.wounds
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete wounds" on public.wounds
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ wound_assessments ============
drop policy if exists "Staff can manage wound assessments" on public.wound_assessments;
create policy "Staff read wound_assessments" on public.wound_assessments
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert wound_assessments" on public.wound_assessments
  for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update wound_assessments" on public.wound_assessments
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete wound_assessments" on public.wound_assessments
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ consents ============
drop policy if exists "Staff can manage consents" on public.consents;
create policy "Staff read consents" on public.consents
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert consents" on public.consents
  for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update consents" on public.consents
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete consents" on public.consents
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ mca_assessments ============
drop policy if exists "Staff can manage MCA" on public.mca_assessments;
create policy "Staff read mca" on public.mca_assessments
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert mca" on public.mca_assessments
  for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update mca" on public.mca_assessments
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete mca" on public.mca_assessments
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ family_members ============
drop policy if exists "Staff full access family_members" on public.family_members;
create policy "Staff read family_members" on public.family_members
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert family_members" on public.family_members
  for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update family_members" on public.family_members
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete family_members" on public.family_members
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ alerts ============
drop policy if exists "Staff full access alerts" on public.alerts;
create policy "Staff read alerts" on public.alerts
  for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert alerts" on public.alerts
  for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update alerts" on public.alerts
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete alerts" on public.alerts
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ profiles: tighten SELECT ============
drop policy if exists "Profiles readable by authenticated" on public.profiles;
create policy "Profiles read self or staff" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_staff(auth.uid()));

-- ============ user_roles: admin-only writes ============
create policy "Admins insert user_roles" on public.user_roles
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update user_roles" on public.user_roles
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete user_roles" on public.user_roles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ============ Lock down SECURITY DEFINER functions ============
-- Trigger / system functions: no direct callers needed
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.snapshot_care_plan() from public, anon, authenticated;
revoke execute on function public.snapshot_risk_assessment() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
-- has_role is referenced inside RLS policies; keep execute for authenticated only
revoke execute on function public.has_role(uuid, app_role) from public, anon;
grant execute on function public.has_role(uuid, app_role) to authenticated;
