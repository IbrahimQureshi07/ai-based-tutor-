-- Intervention queue for teachers/admins (Stage 2.5 unresolved hard-wrong handoffs, etc.).
-- Run in Supabase SQL Editor AFTER mistakes_test_stage_two_point_five.sql.
-- Keep rows in public.app_staff_emails in sync with VITE_ADMIN_EMAILS / adminEmails.ts (lowercase).

create extension if not exists "pgcrypto";

-- Staff list: JWT email must match (see is_app_staff). Edit to match your admin accounts.
create table if not exists public.app_staff_emails (
  email text primary key
);

insert into public.app_staff_emails (email) values
  (lower('mudassir@gmail.com')),
  (lower('ibrahimqureshi45185823@gmail.com'))
on conflict (email) do nothing;

create or replace function public.is_app_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_staff_emails e
    where e.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_app_staff() from public;
grant execute on function public.is_app_staff() to authenticated;
grant execute on function public.is_app_staff() to service_role;

create table if not exists public.intervention_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'mistakes_test_unresolved',
  source_alert_id uuid references public.mistakes_test_teacher_alerts (id) on delete set null,
  payload jsonb not null default '{}',
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);

create index if not exists idx_intervention_flags_user on public.intervention_flags (user_id);
create index if not exists idx_intervention_flags_status_created on public.intervention_flags (status, created_at desc);
create index if not exists idx_intervention_flags_source_alert on public.intervention_flags (source_alert_id);

create unique index if not exists idx_intervention_flags_one_per_alert
  on public.intervention_flags (source_alert_id)
  where source_alert_id is not null;

alter table public.intervention_flags enable row level security;

-- Learners see only their own queue rows (optional transparency).
create policy "Users read own intervention flags"
  on public.intervention_flags for select
  using (auth.uid() = user_id);

-- Staff see and manage the full queue.
create policy "Staff read all intervention flags"
  on public.intervention_flags for select
  using (public.is_app_staff());

create policy "Staff update intervention flags"
  on public.intervention_flags for update
  using (public.is_app_staff())
  with check (public.is_app_staff());

-- Sync from mistakes_test_teacher_alerts (runs as definer; bypasses RLS on insert).
create or replace function public.fn_sync_teacher_alert_to_intervention_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.intervention_flags (user_id, kind, source_alert_id, payload, status)
  values (
    new.user_id,
    'mistakes_test_unresolved',
    new.id,
    coalesce(new.payload, '{}'::jsonb),
    case when new.resolved_at is not null then 'resolved' else 'open' end
  );
  return new;
end;
$$;

drop trigger if exists trg_teacher_alert_to_intervention_flag on public.mistakes_test_teacher_alerts;
create trigger trg_teacher_alert_to_intervention_flag
  after insert on public.mistakes_test_teacher_alerts
  for each row
  execute procedure public.fn_sync_teacher_alert_to_intervention_flag();

-- Optional: backfill flags for alerts created before this migration (uncomment to run once).
-- insert into public.intervention_flags (user_id, kind, source_alert_id, payload, status, resolved_at)
-- select
--   a.user_id,
--   'mistakes_test_unresolved',
--   a.id,
--   coalesce(a.payload, '{}'::jsonb),
--   case when a.resolved_at is not null then 'resolved' else 'open' end,
--   a.resolved_at
-- from public.mistakes_test_teacher_alerts a
-- where not exists (
--   select 1 from public.intervention_flags f where f.source_alert_id = a.id
-- );

-- Staff can read teacher alerts and attempts for context (same JWT email gate).
create policy "Staff read all mistakes test teacher alerts"
  on public.mistakes_test_teacher_alerts for select
  using (public.is_app_staff());

create policy "Staff read all mistakes test attempts"
  on public.mistakes_test_attempts for select
  using (public.is_app_staff());
