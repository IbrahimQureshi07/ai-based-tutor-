-- Stage 2 — Preparation practice (110 Q, cross-topic weights from latest Stage 1 per-topic medium/hard wrongs).
-- Run in Supabase SQL Editor after assessment_stage_one.sql.

create extension if not exists "pgcrypto";

create table if not exists public.practice_preparation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  total_questions int not null default 110,
  correct_first_try int not null default 0,
  medium_wrong int not null default 0,
  hard_wrong int not null default 0,
  skipped int not null default 0,
  raw_score numeric(6,2),
  adjusted_score numeric(6,2),
  status_band text,
  /** Snapshot of per-topic medium_wrong / hard_wrong from each topic's latest completed Stage 1 attempt when this run started (for analytics). */
  baseline_snapshot jsonb,
  /** Per-topic quota (e.g. weight × 110) and any metadata used to build the queue. */
  weight_snapshot jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.practice_preparation_question_outcomes (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.practice_preparation_attempts (id) on delete cascade,
  question_id uuid not null,
  topic_code text,
  difficulty_band text not null check (difficulty_band in ('easy', 'medium', 'hard')),
  outcome text not null check (outcome in ('correct_first', 'medium_wrong', 'hard_wrong', 'skipped')),
  first_try_correct boolean not null,
  used_hint boolean not null default false,
  second_try_correct boolean,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists idx_practice_prep_outcomes_attempt on public.practice_preparation_question_outcomes (attempt_id);
create index if not exists idx_practice_prep_attempts_user on public.practice_preparation_attempts (user_id);

alter table public.practice_preparation_attempts enable row level security;
alter table public.practice_preparation_question_outcomes enable row level security;

create policy "Users read own practice preparation attempts"
  on public.practice_preparation_attempts for select
  using (auth.uid() = user_id);

create policy "Users insert own practice preparation attempts"
  on public.practice_preparation_attempts for insert
  with check (auth.uid() = user_id);

create policy "Users update own practice preparation attempts"
  on public.practice_preparation_attempts for update
  using (auth.uid() = user_id);

create policy "Users read own practice preparation outcomes"
  on public.practice_preparation_question_outcomes for select
  using (
    exists (
      select 1 from public.practice_preparation_attempts a
      where a.id = practice_preparation_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "Users insert own practice preparation outcomes"
  on public.practice_preparation_question_outcomes for insert
  with check (
    exists (
      select 1 from public.practice_preparation_attempts a
      where a.id = practice_preparation_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "Users update own practice preparation outcomes"
  on public.practice_preparation_question_outcomes for update
  using (
    exists (
      select 1 from public.practice_preparation_attempts a
      where a.id = practice_preparation_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );
