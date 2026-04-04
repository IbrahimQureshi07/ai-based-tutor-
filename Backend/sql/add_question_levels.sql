-- Cache GPT-assigned level per bank question (stable question_id).
-- Run in Supabase SQL Editor if this table does not exist yet.

create table if not exists public.question_levels (
  question_id text primary key,
  level_band text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_question_levels_band on public.question_levels (level_band);

alter table public.question_levels enable row level security;

create policy "question_levels_select_authenticated"
  on public.question_levels for select
  to authenticated
  using (true);

create policy "question_levels_insert_authenticated"
  on public.question_levels for insert
  to authenticated
  with check (true);

create policy "question_levels_update_authenticated"
  on public.question_levels for update
  to authenticated
  using (true)
  with check (true);
