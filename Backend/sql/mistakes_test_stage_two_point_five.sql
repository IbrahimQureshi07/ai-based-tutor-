-- Stage 2.5 — Mistakes test (110 Q target: past mistakes + weighted fresh).
-- Run in Supabase SQL Editor after assessment_stage_one.sql + practice_stage_two.sql.

create extension if not exists "pgcrypto";

create table if not exists public.mistakes_test_attempts (
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
  build_snapshot jsonb,
  unresolved_snapshot jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.mistakes_test_question_outcomes (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.mistakes_test_attempts (id) on delete cascade,
  question_id uuid not null,
  topic_code text,
  difficulty_band text not null check (difficulty_band in ('easy', 'medium', 'hard')),
  outcome text not null check (outcome in ('correct_first', 'medium_wrong', 'hard_wrong', 'skipped')),
  first_try_correct boolean not null,
  used_hint boolean not null default false,
  second_try_correct boolean,
  question_source text check (question_source in ('mistake_bank', 'fresh_weighted', 'similar_generated')),
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.mistakes_test_teacher_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid not null references public.mistakes_test_attempts (id) on delete cascade,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (attempt_id)
);

create index if not exists idx_mistakes_test_attempts_user on public.mistakes_test_attempts (user_id);
create index if not exists idx_mistakes_test_outcomes_attempt on public.mistakes_test_question_outcomes (attempt_id);
create index if not exists idx_mistakes_test_alerts_user on public.mistakes_test_teacher_alerts (user_id);

alter table public.mistakes_test_attempts enable row level security;
alter table public.mistakes_test_question_outcomes enable row level security;
alter table public.mistakes_test_teacher_alerts enable row level security;

create policy "Users read own mistakes test attempts"
  on public.mistakes_test_attempts for select
  using (auth.uid() = user_id);

create policy "Users insert own mistakes test attempts"
  on public.mistakes_test_attempts for insert
  with check (auth.uid() = user_id);

create policy "Users update own mistakes test attempts"
  on public.mistakes_test_attempts for update
  using (auth.uid() = user_id);

create policy "Users read own mistakes test outcomes"
  on public.mistakes_test_question_outcomes for select
  using (
    exists (
      select 1 from public.mistakes_test_attempts a
      where a.id = mistakes_test_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "Users insert own mistakes test outcomes"
  on public.mistakes_test_question_outcomes for insert
  with check (
    exists (
      select 1 from public.mistakes_test_attempts a
      where a.id = mistakes_test_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "Users update own mistakes test outcomes"
  on public.mistakes_test_question_outcomes for update
  using (
    exists (
      select 1 from public.mistakes_test_attempts a
      where a.id = mistakes_test_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "Users read own mistakes test teacher alerts"
  on public.mistakes_test_teacher_alerts for select
  using (auth.uid() = user_id);

create policy "Users insert own mistakes test teacher alerts"
  on public.mistakes_test_teacher_alerts for insert
  with check (auth.uid() = user_id);

create policy "Users update own mistakes test teacher alerts"
  on public.mistakes_test_teacher_alerts for update
  using (auth.uid() = user_id);
