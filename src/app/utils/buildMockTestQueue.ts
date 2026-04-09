import type { Question } from '@/app/data/exam-data';
import { SUBJECTS } from '@/app/data/subjects';
import { subjectLabelMatches } from '@/app/utils/subjectMatch';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import { supabase } from '@/app/services/supabase';
import type { MockAllocationBucket } from '@/app/services/mockTest';

/** Full mock length for learners (same pass rules: see mockExam constants). */
export const MOCK_TOTAL_QUESTIONS = 110;

/** Short mock for admin emails only (same scoring / pass threshold as full mock). */
export const MOCK_ADMIN_TOTAL_QUESTIONS = 10;

type BucketKey = 'hard_wrong' | 'easy_balanced' | 'medium_wrong' | 'weak_medium_hard';

export type MockQueueSlot = {
  question: Question;
  tier: AssessmentTier;
  allocationBucket: MockAllocationBucket;
};

type MockHistory = {
  hardWrongIds: Set<string>;
  mediumWrongIds: Set<string>;
  skippedIds: Set<string>;
  weakTopics: string[];
};

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

function wrapSlots(questions: Question[], bucket: MockAllocationBucket): MockQueueSlot[] {
  return questions.map((q) => ({ question: q, tier: tierFromQuestion(q), allocationBucket: bucket }));
}

function tierFromQuestion(q: Question): AssessmentTier {
  const d = String(q.difficulty || 'medium').toLowerCase();
  if (d === 'easy' || d === 'hard') return d;
  return 'medium';
}

async function fetchAttemptIds(table: string, userId: string): Promise<string[]> {
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

async function buildMockHistory(userId: string): Promise<MockHistory> {
  const [s1Ids, s2Ids, s25Ids] = await Promise.all([
    fetchAttemptIds('assessment_topic_attempts', userId),
    fetchAttemptIds('practice_preparation_attempts', userId),
    fetchAttemptIds('mistakes_test_attempts', userId),
  ]);

  const [s1Rows, s2Rows, s25Rows] = await Promise.all([
    fetchOutcomeRows('assessment_question_outcomes', s1Ids),
    fetchOutcomeRows('practice_preparation_question_outcomes', s2Ids),
    fetchOutcomeRows('mistakes_test_question_outcomes', s25Ids),
  ]);
  const all = [...s1Rows, ...s2Rows, ...s25Rows];

  const hardWrongIds = new Set<string>();
  const mediumWrongIds = new Set<string>();
  const skippedIds = new Set<string>();
  const topicWeights = new Map<string, number>();
  for (const r of all) {
    const qid = String(r.question_id || '').trim();
    if (!qid) continue;
    const out = String(r.outcome || '').trim();
    if (out === 'hard_wrong') hardWrongIds.add(qid);
    if (out === 'medium_wrong') mediumWrongIds.add(qid);
    if (out === 'skipped') skippedIds.add(qid);

    const t = (r.topic_code || '').trim();
    if (t) {
      const w = out === 'hard_wrong' ? 2 : out === 'medium_wrong' ? 1 : out === 'skipped' ? 1.25 : 0;
      if (w > 0) topicWeights.set(t, (topicWeights.get(t) ?? 0) + w);
    }
  }

  const weakTopics = [...topicWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 6);

  return { hardWrongIds, mediumWrongIds, skippedIds, weakTopics };
}

export async function buildMockTestQueue(
  questions: Question[],
  userId: string,
  opts?: { totalQuestions?: number }
): Promise<{
  questions: Question[];
  slots: MockQueueSlot[];
  tiers: AssessmentTier[];
  bucketCounts: Record<BucketKey, number>;
}> {
  const requested = opts?.totalQuestions ?? MOCK_TOTAL_QUESTIONS;
  const n = Math.min(Math.max(1, requested), Math.max(1, questions.length));

  const history = await buildMockHistory(userId);
  const used = new Set<string>();

  const hardTarget = Math.round(n * 0.2);
  const easyTarget = Math.round(n * 0.3);
  const mediumWrongTarget = Math.round(n * 0.1);
  const weakTarget = n - hardTarget - easyTarget - mediumWrongTarget;

  const hardPool = questions.filter((q) => history.hardWrongIds.has(q.id));
  const mediumWrongPool = questions.filter((q) => history.mediumWrongIds.has(q.id));
  const skippedPool = questions.filter((q) => history.skippedIds.has(q.id));
  const easyPool = questions.filter((q) => tierFromQuestion(q) === 'easy');
  const medHardPool = questions.filter((q) => {
    const t = tierFromQuestion(q);
    return t === 'medium' || t === 'hard';
  });

  const slotRows: MockQueueSlot[] = [];

  // 20% previous hard wrong, top-up by skipped if short
  const hardFromWrong = pickNUnique(hardPool, hardTarget, used);
  slotRows.push(...wrapSlots(hardFromWrong, 'hard_wrong'));
  if (hardFromWrong.length < hardTarget) {
    const need = hardTarget - hardFromWrong.length;
    const top = pickNUnique(skippedPool, need, used);
    slotRows.push(...wrapSlots(top, 'skip_topup'));
  }

  // 30% easy balanced across topics
  const easyPicked: Question[] = [];
  const perTopicEasyTarget = Math.floor(easyTarget / SUBJECTS.length);
  for (const s of SUBJECTS) {
    const byTopic = easyPool.filter((q) => subjectLabelMatches(q, s.key));
    easyPicked.push(...pickNUnique(byTopic, perTopicEasyTarget, used));
  }
  if (easyPicked.length < easyTarget) {
    easyPicked.push(...pickNUnique(easyPool, easyTarget - easyPicked.length, used));
  }
  slotRows.push(...wrapSlots(easyPicked, 'easy_balanced'));

  // 10% previous medium wrong, top-up by skipped
  const mediumFromWrong = pickNUnique(mediumWrongPool, mediumWrongTarget, used);
  slotRows.push(...wrapSlots(mediumFromWrong, 'medium_wrong'));
  if (mediumFromWrong.length < mediumWrongTarget) {
    const need = mediumWrongTarget - mediumFromWrong.length;
    const top = pickNUnique(skippedPool, need, used);
    slotRows.push(...wrapSlots(top, 'skip_topup'));
  }

  // 40% medium+hard from weak topics (derived from historical weighted mistakes)
  const weakTopicPool = medHardPool.filter((q) =>
    history.weakTopics.some((t) => subjectLabelMatches(q, t))
  );
  const weakPicked = pickNUnique(weakTopicPool, weakTarget, used);
  if (weakPicked.length < weakTarget) {
    weakPicked.push(...pickNUnique(medHardPool, weakTarget - weakPicked.length, used));
  }
  slotRows.push(...wrapSlots(weakPicked, 'weak_ai'));

  if (slotRows.length < n) {
    const filler = pickNUnique(questions, n - slotRows.length, used);
    slotRows.push(...wrapSlots(filler, 'fallback'));
  }

  const finalSlots = shuffle(slotRows).slice(0, n);
  const finalQ = finalSlots.map((s) => s.question);
  const tiers = finalSlots.map((s) => s.tier);

  const countIn = (pred: (s: MockQueueSlot) => boolean) => finalSlots.filter(pred).length;

  return {
    questions: finalQ,
    slots: finalSlots,
    tiers,
    bucketCounts: {
      hard_wrong: countIn((s) => s.allocationBucket === 'hard_wrong'),
      easy_balanced: countIn((s) => s.allocationBucket === 'easy_balanced'),
      medium_wrong: countIn((s) => s.allocationBucket === 'medium_wrong'),
      weak_medium_hard: countIn((s) => s.allocationBucket === 'weak_ai'),
    },
  };
}

