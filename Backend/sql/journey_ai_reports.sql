-- Persisted combined journey AI coach reports (Results → Generate AI coach report).
-- Run once in Supabase SQL Editor after auth is available.

create extension if not exists "pgcrypto";

create table if not exists public.journey_ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_json jsonb not null,
  ai_report_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_journey_ai_reports_user_created
  on public.journey_ai_reports (user_id, created_at desc);

alter table public.journey_ai_reports enable row level security;

create policy "Users read own journey ai reports"
  on public.journey_ai_reports for select
  using (auth.uid() = user_id);

create policy "Users insert own journey ai reports"
  on public.journey_ai_reports for insert
  with check (auth.uid() = user_id);
