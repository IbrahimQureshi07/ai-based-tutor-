/**
 * Service for storing and fetching user's wrong questions in Supabase.
 * Used for: AI Assessment (overall weak areas) and per-user mistake tracking.
 *
 * User identity: We use Supabase Auth. When a user logs in (email/password or Google),
 * Supabase sets the session. Get current user id via:
 *   const { data: { user } } = await supabase.auth.getUser();
 *   user?.id  // UUID for auth.users
 * This same id is used in user_wrong_questions.user_id.
 */

import { supabase } from '@/app/services/supabase';

export interface UserWrongQuestionRow {
  id: string;
  user_id: string;
  question_id: string;
  category: string | null;
  wrong_count: number;
  last_wrong_at: string;
  level_band?: string | null;
  first_try_wrong_count?: number | null;
}

export interface SaveWrongQuestionOptions {
  levelBand?: string | null;
  /** When true, increments first_try_wrong_count (first wrong attempt in that interaction). */
  isFirstTry?: boolean;
}

/**
 * Get current logged-in user id from Supabase Auth.
 * Returns null if not logged in (e.g. demo user).
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? null;
}

/**
 * Save or update a wrong answer for the current user in Supabase.
 * Call this when user answers a question wrong (only for real sheet questions, not GPT-generated).
 */
export async function saveWrongQuestion(
  userId: string,
  questionId: string,
  category: string,
  opts?: SaveWrongQuestionOptions
): Promise<void> {
  const { data: existing } = await supabase
    .from('user_wrong_questions')
    .select('id, wrong_count, first_try_wrong_count, level_band')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle();

  const now = new Date().toISOString();
  const cat = category || 'General';
  const levelBand = opts?.levelBand ?? null;
  const ftDelta = opts?.isFirstTry ? 1 : 0;

  if (existing) {
    const prevFt = existing.first_try_wrong_count ?? 0;
    const patch: Record<string, unknown> = {
      wrong_count: (existing.wrong_count ?? 1) + 1,
      last_wrong_at: now,
      category: cat,
    };
    if (levelBand && !existing.level_band) {
      patch.level_band = levelBand;
    }
    if (ftDelta > 0) {
      patch.first_try_wrong_count = prevFt + ftDelta;
    }
    await supabase.from('user_wrong_questions').update(patch).eq('id', existing.id);
  } else {
    await supabase.from('user_wrong_questions').insert({
      user_id: userId,
      question_id: questionId,
      category: cat,
      wrong_count: 1,
      last_wrong_at: now,
      level_band: levelBand,
      first_try_wrong_count: ftDelta > 0 ? 1 : 0,
    });
  }
}

/**
 * Fetch all wrong-question records for the current user (for AI Assessment / weak-area practice).
 */
export async function getUserWrongQuestions(userId: string): Promise<UserWrongQuestionRow[]> {
  const { data, error } = await supabase
    .from('user_wrong_questions')
    .select('*')
    .eq('user_id', userId)
    .order('wrong_count', { ascending: false })
    .order('last_wrong_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as UserWrongQuestionRow[];
}
