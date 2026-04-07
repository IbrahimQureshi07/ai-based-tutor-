-- Optional: store per-row difficulty on the bank for legacy easy/hard hints (classification fallback).
-- Safe to run once. After this, add `difficulty` to the `.select(...)` in `useQuestions.ts` so rows map into `Question.difficulty`.

alter table public.questions add column if not exists difficulty text;
