import { supabase } from '@/app/services/supabase';

/**
 * Per-user counts of how often each `question_id` appeared across completed attempts.
 * Sources: Stage 1, Stage 2 prep, Stage 2.5 mistakes test, and full mock (bank + retry question ids).
 * New users → empty map (every bank id has exposure 0 for selection purposes).
 *
 * Used by the final exam queue: prefer never-seen, then rarest exposure first.
 */

export type UserQuestionExposureIndex = Map<string, number>;

const BATCH = 100;

function normalizeQuestionId(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function bump(map: Map<string, number>, id: string | null): void {
  if (!id) return;
  map.set(id, (map.get(id) ?? 0) + 1);
}

async function fetchCompletedAttemptIds(table: string, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'completed');
  if (error || !data) return [];
  return (data as { id: string }[]).map((r) => r.id);
}

/** One increment per outcome row (same question can repeat across attempts). */
async function collectQuestionIdsFromAssessmentLikeOutcomes(
  table: string,
  attemptIds: string[]
): Promise<string[]> {
  if (attemptIds.length === 0) return [];
  const ids: string[] = [];
  for (let i = 0; i < attemptIds.length; i += BATCH) {
    const chunk = attemptIds.slice(i, i + BATCH);
    const { data, error } = await supabase.from(table).select('question_id').in('attempt_id', chunk);
    if (error || !data) continue;
    for (const r of data as { question_id: unknown }[]) {
      const q = normalizeQuestionId(r.question_id);
      if (q) ids.push(q);
    }
  }
  return ids;
}

/** Mock: count bank `question_id` and, when present, `retry_question_id` (separate exposure). */
async function collectQuestionIdsFromMockOutcomes(attemptIds: string[]): Promise<string[]> {
  if (attemptIds.length === 0) return [];
  const ids: string[] = [];
  for (let i = 0; i < attemptIds.length; i += BATCH) {
    const chunk = attemptIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('mock_test_question_outcomes')
      .select('question_id, retry_question_id')
      .in('attempt_id', chunk);
    if (error || !data) continue;
    for (const r of data as { question_id: unknown; retry_question_id: unknown }[]) {
      const q = normalizeQuestionId(r.question_id);
      if (q) ids.push(q);
      const rq = normalizeQuestionId(r.retry_question_id);
      if (rq) ids.push(rq);
    }
  }
  return ids;
}

function mergeIntoMap(ids: string[], map: Map<string, number>): void {
  for (const id of ids) {
    bump(map, id);
  }
}

/**
 * Aggregates exposure across Stage 1, Stage 2 prep, Stage 2.5, and mock completed attempts.
 */
export async function buildUserQuestionExposureIndex(userId: string | null | undefined): Promise<UserQuestionExposureIndex> {
  const map: Map<string, number> = new Map();
  if (!userId) return map;

  const [
    s1AttemptIds,
    s2AttemptIds,
    s25AttemptIds,
    mockAttemptIds,
  ] = await Promise.all([
    fetchCompletedAttemptIds('assessment_topic_attempts', userId),
    fetchCompletedAttemptIds('practice_preparation_attempts', userId),
    fetchCompletedAttemptIds('mistakes_test_attempts', userId),
    fetchCompletedAttemptIds('mock_test_attempts', userId),
  ]);

  const [s1Ids, s2Ids, s25Ids, mockIds] = await Promise.all([
    collectQuestionIdsFromAssessmentLikeOutcomes('assessment_question_outcomes', s1AttemptIds),
    collectQuestionIdsFromAssessmentLikeOutcomes('practice_preparation_question_outcomes', s2AttemptIds),
    collectQuestionIdsFromAssessmentLikeOutcomes('mistakes_test_question_outcomes', s25AttemptIds),
    collectQuestionIdsFromMockOutcomes(mockAttemptIds),
  ]);

  mergeIntoMap(s1Ids, map);
  mergeIntoMap(s2Ids, map);
  mergeIntoMap(s25Ids, map);
  mergeIntoMap(mockIds, map);

  return map;
}

/** Exposure count for a question id (0 if never seen). */
export function getExposureCount(exposure: UserQuestionExposureIndex, questionId: string): number {
  return exposure.get(questionId) ?? 0;
}

/**
 * Sort question ids ascending by exposure (rarest first), then by id for stability.
 */
export function sortQuestionIdsByExposureAscending(
  questionIds: string[],
  exposure: UserQuestionExposureIndex
): string[] {
  const unique = [...new Set(questionIds)];
  return unique.sort((a, b) => {
    const ca = getExposureCount(exposure, a);
    const cb = getExposureCount(exposure, b);
    if (ca !== cb) return ca - cb;
    return a.localeCompare(b);
  });
}
