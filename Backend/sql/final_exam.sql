-- Final exam attempts + per-question outcomes (110 Q, 90 min, grades A+ / A / B / Fail).
-- Run in Supabase SQL Editor after auth is available.
-- Grades: ≥90 A+ · 80–89 A · 75–79 B (pass) · <75 Fail. Pass = percent ≥ 75 (is_pass).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- final_exam_attempts
-- ---------------------------------------------------------------------------
create table if not exists public.final_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  total_questions int not null default 110,
  time_limit_seconds int not null default 5400,
  pass_threshold_percent int not null default 75,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  unanswered_count int not null default 0,
  percent_final int,
  grade text check (grade is null or grade in ('A+', 'A', 'B', 'Fail')),
  is_pass boolean,
  build_snapshot jsonb,
  results_snapshot jsonb,
  topic_rollup jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_final_exam_attempts_user on public.final_exam_attempts (user_id);
create index if not exists idx_final_exam_attempts_user_completed on public.final_exam_attempts (user_id, completed_at desc nulls last);

comment on table public.final_exam_attempts is 'Final exam: one row per attempt; grade and is_pass set when status=completed.';
comment on column public.final_exam_attempts.pass_threshold_percent is 'Min % to pass (Grade B floor); app default 75.';
comment on column public.final_exam_attempts.percent_final is 'Rounded 0-100; drives grade: A+ >=90, A 80-89, B 75-79, Fail <75.';
comment on column public.final_exam_attempts.grade is 'A+, A, B, or Fail; null while in_progress.';
comment on column public.final_exam_attempts.is_pass is 'true when percent_final >= pass_threshold_percent (typically 75).';

-- ---------------------------------------------------------------------------
-- final_exam_question_outcomes
-- No retry: one row per slot; wrong/unanswered have no second chance.
-- ---------------------------------------------------------------------------
create table if not exists public.final_exam_question_outcomes (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.final_exam_attempts (id) on delete cascade,
  slot_index int not null check (slot_index >= 0),
  question_id uuid,
  topic_code text,
  difficulty_band text not null check (difficulty_band in ('easy', 'medium', 'hard')),
  allocation_bucket text not null
    check (
      allocation_bucket in (
        'fresh_hard',
        'easy_balanced',
        'mock_wrong',
        'weak_weighted',
        'fallback'
      )
    ),
  first_question_text text,
  selected_option int,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, slot_index)
);

create index if not exists idx_final_exam_outcomes_attempt on public.final_exam_question_outcomes (attempt_id);

comment on table public.final_exam_question_outcomes is 'Per-slot outcome for final exam; unanswered: selected_option null, is_correct false.';
comment on column public.final_exam_question_outcomes.is_correct is 'True only when answered and matches correct option.';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.final_exam_attempts enable row level security;
alter table public.final_exam_question_outcomes enable row level security;

create policy "Users read own final exam attempts"
  on public.final_exam_attempts for select
  using (auth.uid() = user_id);

create policy "Users insert own final exam attempts"
  on public.final_exam_attempts for insert
  with check (auth.uid() = user_id);

create policy "Users update own final exam attempts"
  on public.final_exam_attempts for update
  using (auth.uid() = user_id);

create policy "Users read own final exam outcomes"
  on public.final_exam_question_outcomes for select
  using (
    exists (
      select 1 from public.final_exam_attempts a
      where a.id = final_exam_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "Users insert own final exam outcomes"
  on public.final_exam_question_outcomes for insert
  with check (
    exists (
      select 1 from public.final_exam_attempts a
      where a.id = final_exam_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "Users update own final exam outcomes"
  on public.final_exam_question_outcomes for update
  using (
    exists (
      select 1 from public.final_exam_attempts a
      where a.id = final_exam_question_outcomes.attempt_id and a.user_id = auth.uid()
    )
  );
