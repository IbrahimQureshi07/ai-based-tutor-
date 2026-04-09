import type { Question } from '@/app/data/exam-data';
import { SUBJECTS } from '@/app/data/subjects';
import { subjectLabelMatches } from '@/app/utils/subjectMatch';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import type { FinalExamAllocationBucket } from '@/app/services/finalExam';
import { supabase } from '@/app/services/supabase';
import {
  buildUserQuestionExposureIndex,
  getExposureCount,
  type UserQuestionExposureIndex,
} from '@/app/services/userQuestionExposure';
import { FINAL_EXAM_TOTAL_QUESTIONS } from '@/app/constants/finalExam';

/** Proportions for 110 Q: 55 fresh-hard / 22 easy / 17 mock-wrong / 16 weak (scaled by n). */
const SLOT_TOTAL = 110;
const FRESH_NUM = 55;
const EASY_NUM = 22;
const MOCK_WRONG_NUM = 17;

export type FinalExamQueueSlot = {
  question: Question;
  tier: AssessmentTier;
  allocationBucket: FinalExamAllocationBucket;
};

type BucketKey = 'fresh_hard' | 'easy_balanced' | 'mock_wrong' | 'weak_weighted' | 'fallback';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickNUnique(candidates: Question[], n: number, used: Set<string>): Question[] {
  const picked: Question[] = [];
  for (const q of shuffle(candidates)) {
    if (picked.length >= n) break;
    if (used.has(q.id)) continue;
    used.add(q.id);
    picked.push(q);
  }
  return picked;
}

function tierFromQuestion(q: Question): AssessmentTier {
  const d = String(q.difficulty || 'medium').toLowerCase();
  if (d === 'easy' || d === 'hard') return d;
  return 'medium';
}

function wrapSlots(questions: Question[], bucket: FinalExamAllocationBucket): FinalExamQueueSlot[] {
  return questions.map((q) => ({ question: q, tier: tierFromQuestion(q), allocationBucket: bucket }));
}

function normalizeId(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
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

async function fetchOutcomeRows(
  table: string,
  attemptIds: string[]
): Promise<Array<{ question_id: string; outcome: string; topic_code: string | null }>> {
  if (attemptIds.length === 0) return [];
  const rows: Array<{ question_id: string; outcome: string; topic_code: string | null }> = [];
  const BATCH = 100;
  for (let i = 0; i < attemptIds.length; i += BATCH) {
    const chunk = attemptIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from(table)
      .select('question_id, outcome, topic_code')
      .in('attempt_id', chunk);
    if (error || !data) continue;
    for (const r of data as Array<{ question_id: string; outcome: string; topic_code: string | null }>) {
      rows.push(r);
    }
  }
  return rows;
}

/** Weak topics from Stage1 + Stage2 + 2.5 (same weighting idea as mock queue). */
async function buildWeakTopicsForFinal(userId: string): Promise<string[]> {
  const [s1Ids, s2Ids, s25Ids] = await Promise.all([
    fetchCompletedAttemptIds('assessment_topic_attempts', userId),
    fetchCompletedAttemptIds('practice_preparation_attempts', userId),
    fetchCompletedAttemptIds('mistakes_test_attempts', userId),
  ]);

  const [s1Rows, s2Rows, s25Rows] = await Promise.all([
    fetchOutcomeRows('assessment_question_outcomes', s1Ids),
    fetchOutcomeRows('practice_preparation_question_outcomes', s2Ids),
    fetchOutcomeRows('mistakes_test_question_outcomes', s25Ids),
  ]);
  const all = [...s1Rows, ...s2Rows, ...s25Rows];

  const topicWeights = new Map<string, number>();
  for (const r of all) {
    const t = (r.topic_code || '').trim();
    if (!t) continue;
    const out = String(r.outcome || '').trim();
    const w = out === 'hard_wrong' ? 2 : out === 'medium_wrong' ? 1 : out === 'skipped' ? 1.25 : 0;
    if (w > 0) topicWeights.set(t, (topicWeights.get(t) ?? 0) + w);
  }

  return [...topicWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 6);
}

/** Latest completed mock: bank questions where final_correct is false. */
async function fetchLatestMockFinalWrongIds(userId: string): Promise<Set<string>> {
  const set = new Set<string>();
  const { data: attempts, error: aErr } = await supabase
    .from('mock_test_attempts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1);
  if (aErr || !attempts?.length) return set;

  const attemptId = (attempts[0] as { id: string }).id;
  const { data: outcomes, error: oErr } = await supabase
    .from('mock_test_question_outcomes')
    .select('question_id, final_correct')
    .eq('attempt_id', attemptId);
  if (oErr || !outcomes) return set;

  for (const r of outcomes as { question_id: unknown; final_correct: boolean }[]) {
    if (r.final_correct) continue;
    const q = normalizeId(r.question_id);
    if (q) set.add(q);
  }
  return set;
}

/**
 * Pick up to `target` hard questions: lowest exposure first (0 = never seen), then stable id order.
 */
function pickFreshHardByExposure(
  hardPool: Question[],
  exposure: UserQuestionExposureIndex,
  target: number,
  used: Set<string>
): Question[] {
  const sorted = [...hardPool].sort((a, b) => {
    const ca = getExposureCount(exposure, a.id);
    const cb = getExposureCount(exposure, b.id);
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  });
  const picked: Question[] = [];
  for (const q of sorted) {
    if (picked.length >= target) break;
    if (used.has(q.id)) continue;
    used.add(q.id);
    picked.push(q);
  }
  return picked;
}

function allocateBucketTargets(n: number): {
  freshTarget: number;
  easyTarget: number;
  mockWrongTarget: number;
  weakTarget: number;
} {
  const freshTarget = Math.round((n * FRESH_NUM) / SLOT_TOTAL);
  const easyTarget = Math.round((n * EASY_NUM) / SLOT_TOTAL);
  const mockWrongTarget = Math.round((n * MOCK_WRONG_NUM) / SLOT_TOTAL);
  let weakTarget = n - freshTarget - easyTarget - mockWrongTarget;
  if (weakTarget < 0) weakTarget = 0;
  return { freshTarget, easyTarget, mockWrongTarget, weakTarget };
}

export async function buildFinalExamQueue(
  questions: Question[],
  userId: string,
  opts?: { totalQuestions?: number }
): Promise<{
  questions: Question[];
  slots: FinalExamQueueSlot[];
  tiers: AssessmentTier[];
  bucketCounts: Record<BucketKey, number>;
}> {
  const requested = opts?.totalQuestions ?? FINAL_EXAM_TOTAL_QUESTIONS;
  const n = Math.min(Math.max(1, requested), Math.max(1, questions.length));

  const [exposure, mockWrongIds, weakTopics] = await Promise.all([
    buildUserQuestionExposureIndex(userId),
    fetchLatestMockFinalWrongIds(userId),
    buildWeakTopicsForFinal(userId),
  ]);

  const { freshTarget, easyTarget, mockWrongTarget, weakTarget } = allocateBucketTargets(n);

  const used = new Set<string>();
  const slotRows: FinalExamQueueSlot[] = [];

  const hardPool = questions.filter((q) => tierFromQuestion(q) === 'hard');
  const freshPicked = pickFreshHardByExposure(hardPool, exposure, freshTarget, used);
  slotRows.push(...wrapSlots(freshPicked, 'fresh_hard'));

  const easyPool = questions.filter((q) => tierFromQuestion(q) === 'easy');
  const easyPicked: Question[] = [];
  const perTopicEasy = Math.floor(easyTarget / SUBJECTS.length);
  for (const s of SUBJECTS) {
    const byTopic = easyPool.filter((q) => subjectLabelMatches(q, s.key));
    easyPicked.push(...pickNUnique(byTopic, perTopicEasy, used));
  }
  if (easyPicked.length < easyTarget) {
    easyPicked.push(...pickNUnique(easyPool, easyTarget - easyPicked.length, used));
  }
  slotRows.push(...wrapSlots(easyPicked, 'easy_balanced'));

  const mockWrongPool = questions.filter((q) => mockWrongIds.has(q.id));
  const mockPicked = pickNUnique(mockWrongPool, mockWrongTarget, used);
  slotRows.push(...wrapSlots(mockPicked, 'mock_wrong'));

  const medHardPool = questions.filter((q) => {
    const t = tierFromQuestion(q);
    return t === 'medium' || t === 'hard';
  });
  const weakTopicPool = medHardPool.filter((q) =>
    weakTopics.some((t) => subjectLabelMatches(q, t))
  );
  const weakPicked = pickNUnique(weakTopicPool, weakTarget, used);
  if (weakPicked.length < weakTarget) {
    weakPicked.push(...pickNUnique(medHardPool, weakTarget - weakPicked.length, used));
  }
  slotRows.push(...wrapSlots(weakPicked, 'weak_weighted'));

  if (slotRows.length < n) {
    const filler = pickNUnique(questions, n - slotRows.length, used);
    slotRows.push(...wrapSlots(filler, 'fallback'));
  }

  const finalSlots = shuffle(slotRows).slice(0, n);
  const finalQ = finalSlots.map((s) => s.question);
  const tiers = finalSlots.map((s) => s.tier);

  const countIn = (pred: (s: FinalExamQueueSlot) => boolean) => finalSlots.filter(pred).length;

  return {
    questions: finalQ,
    slots: finalSlots,
    tiers,
    bucketCounts: {
      fresh_hard: countIn((s) => s.allocationBucket === 'fresh_hard'),
      easy_balanced: countIn((s) => s.allocationBucket === 'easy_balanced'),
      mock_wrong: countIn((s) => s.allocationBucket === 'mock_wrong'),
      weak_weighted: countIn((s) => s.allocationBucket === 'weak_weighted'),
      fallback: countIn((s) => s.allocationBucket === 'fallback'),
    },
  };
}
