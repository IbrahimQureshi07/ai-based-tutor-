-- Stage 1 topic assessment (35 Q per topic, A1–B6). Run in Supabase SQL Editor if not already applied.

create extension if not exists "pgcrypto";

create table if not exists public.assessment_topic_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_code text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  total_questions int not null default 35,
  correct_first_try int not null default 0,
  medium_wrong int not null default 0,
  hard_wrong int not null default 0,
  skipped int not null default 0,
  raw_score numeric(6,2),
  adjusted_score numeric(6,2),
  status_band text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.assessment_question_outcomes (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_topic_attempts (id) on delete cascade,
  question_id uuid not null,
  difficulty_band text not null check (difficulty_band in ('easy', 'medium', 'hard')),
  outcome text not null check (outcome in ('correct_first', 'medium_wrong', 'hard_wrong', 'skipped')),
  first_try_correct boolean not null,
  used_hint boolean not null default false,
  second_try_correct boolean,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists idx_assessment_outcomes_attempt on public.assessment_question_outcomes (attempt_id);

alter table public.assessment_topic_attempts enable row level security;
alter table public.assessment_question_outcomes enable row level security;

create policy "Users read own attempts"
  on public.assessment_topic_attempts for select
  using (auth.uid() = user_id);

create policy "Users insert own attempts"
  on public.assessment_topic_attempts for insert
  with check (auth.uid() = user_id);

create policy "Users update own attempts"
  on public.assessment_topic_attempts for update
  using (auth.uid() = user_id);

create policy "Users read own outcomes"
  on public.assessment_question_outcomes for select
  using (
    exists (
      select 1 from public.assessment_topic_attempts a
      where a.id = assessment_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "Users insert own outcomes"
  on public.assessment_question_outcomes for insert
  with check (
    exists (
      select 1 from public.assessment_topic_attempts a
      where a.id = assessment_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "Users update own outcomes"
  on public.assessment_question_outcomes for update
  using (
    exists (
      select 1 from public.assessment_topic_attempts a
      where a.id = assessment_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );
