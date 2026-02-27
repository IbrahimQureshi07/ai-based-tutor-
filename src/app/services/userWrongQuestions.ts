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
}

/**
 * Get current logged-in user id from Supabase Auth.
 * Returns null if not logged in (e.g. demo user).
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Save or update a wrong answer for the current user in Supabase.
 * Call this when user answers a question wrong (only for real sheet questions, not GPT-generated).
 */
export async function saveWrongQuestion(
  userId: string,
  questionId: string,
  category: string
): Promise<void> {
  const { data: existing } = await supabase
    .from('user_wrong_questions')
    .select('id, wrong_count')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle();

  const now = new Date().toISOString();
  const cat = category || 'General';

  if (existing) {
    await supabase
      .from('user_wrong_questions')
      .update({
        wrong_count: (existing.wrong_count ?? 1) + 1,
        last_wrong_at: now,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('user_wrong_questions').insert({
      user_id: userId,
      question_id: questionId,
      category: cat,
      wrong_count: 1,
      last_wrong_at: now,
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
