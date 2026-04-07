-- Optional: collapse legacy 6-band labels in DB to easy | medium | hard.
-- Run once in Supabase SQL Editor if you want stored rows to match the app (reads also normalize client-side).

update public.question_levels
set level_band = 'easy', updated_at = now()
where level_band in ('above_easy');

update public.question_levels
set level_band = 'medium', updated_at = now()
where level_band in ('above_medium');

update public.question_levels
set level_band = 'hard', updated_at = now()
where level_band in ('above_hard');
