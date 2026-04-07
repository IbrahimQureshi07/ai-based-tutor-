/**
 * Stage 2 — aggregate latest Stage 1 (per topic) medium/hard wrongs → weights → 110 question quotas.
 */

import { SUBJECTS } from '@/app/data/subjects';
import { supabase } from '@/app/services/supabase';
import {
  PRACTICE_PREPARATION_TOTAL,
  allocateQuotasLargestRemainder,
  topicPrepScore,
} from '@/app/utils/practicePreparationQuotas';

export type StageOneTopicSnapshot = {
  topicCode: string;
  mediumWrong: number;
  hardWrong: number;
  topicScore: number;
};

/** Latest completed Stage 1 attempt per topic — for Results before/after analytics */
export type StageOneTopicRollupEntry = {
  hasAttempt: boolean;
  correctFirstTry: number;
  mediumWrong: number;
  hardWrong: number;
  skipped: number;
  totalQuestions: number;
  rawScore: number;
};

export type PracticePreparationAllocation = {
  baselines: StageOneTopicSnapshot[];
  totalWeightScore: number;
  quotasByTopic: Record<string, number>;
  /** For practice_preparation_attempts.weight_snapshot */
  weightSnapshot: {
    totalSlots: number;
    totalWeightScore: number;
    topics: Array<{
      topicCode: string;
      mediumWrong: number;
      hardWrong: number;
      topicScore: number;
      weight: number;
      quota: number;
    }>;
  };
  /** For practice_preparation_attempts.baseline_snapshot */
  baselineSnapshot: Record<
    string,
    { medium_wrong: number; hard_wrong: number; topic_score: number }
  >;
  /** True when every topic's weight score is 0 — queue builder must fill 110 another way */
  needsUniformFill: boolean;
  /** Per catalog topic: latest Stage 1 completed attempt stats (for UI rollup) */
  stageOneRollupByTopic: Record<string, StageOneTopicRollupEntry>;
};

type AttemptRowFull = {
  topic_code: string;
  correct_first_try: number | null;
  medium_wrong: number | null;
  hard_wrong: number | null;
  skipped: number | null;
  total_questions: number | null;
  raw_score: number | string | null;
  completed_at: string | null;
};

/**
 * Latest completed Stage 1 attempt per topic (by completed_at desc), full scoring fields.
 */
export async function fetchLatestStageOneRollupByTopic(
  userId: string
): Promise<Map<string, StageOneTopicRollupEntry>> {
  const { data, error } = await supabase
    .from('assessment_topic_attempts')
    .select(
      'topic_code, correct_first_try, medium_wrong, hard_wrong, skipped, total_questions, raw_score, completed_at'
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  const map = new Map<string, StageOneTopicRollupEntry>();
  if (error || !data) return map;

  for (const row of data as AttemptRowFull[]) {
    const code = row.topic_code?.trim();
    if (!code || map.has(code)) continue;
    const raw = row.raw_score;
    const rawNum = raw === null || raw === undefined ? 0 : Number(raw);
    map.set(code, {
      hasAttempt: true,
      correctFirstTry: row.correct_first_try ?? 0,
      mediumWrong: row.medium_wrong ?? 0,
      hardWrong: row.hard_wrong ?? 0,
      skipped: row.skipped ?? 0,
      totalQuestions: row.total_questions ?? 35,
      rawScore: Number.isFinite(rawNum) ? rawNum : 0,
    });
  }
  return map;
}

/**
 * Latest completed Stage 1 attempt per topic_code (by completed_at desc) — medium/hard only.
 */
export async function fetchLatestStageOneBaselines(
  userId: string
): Promise<Map<string, { mediumWrong: number; hardWrong: number }>> {
  const rollup = await fetchLatestStageOneRollupByTopic(userId);
  const map = new Map<string, { mediumWrong: number; hardWrong: number }>();
  for (const [code, e] of rollup) {
    map.set(code, { mediumWrong: e.mediumWrong, hardWrong: e.hardWrong });
  }
  return map;
}

/** At least one completed Stage 1 topic (gate for Stage 2). */
export async function userHasCompletedStageOne(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('assessment_topic_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * Build per-topic scores (all SUBJECTS keys) and 110 quotas from latest Stage 1 data.
 */
export async function buildPracticePreparationAllocation(
  userId: string
): Promise<PracticePreparationAllocation> {
  const rollupMap = await fetchLatestStageOneRollupByTopic(userId);

  const scoresByTopic: Record<string, number> = {};
  const baselines: StageOneTopicSnapshot[] = [];
  const baselineSnapshot: PracticePreparationAllocation['baselineSnapshot'] = {};
  const stageOneRollupByTopic: Record<string, StageOneTopicRollupEntry> = {};

  for (const s of SUBJECTS) {
    const hit = rollupMap.get(s.key);
    const mediumWrong = hit?.mediumWrong ?? 0;
    const hardWrong = hit?.hardWrong ?? 0;
    const topicScore = topicPrepScore(mediumWrong, hardWrong);
    scoresByTopic[s.key] = topicScore;
    baselines.push({
      topicCode: s.key,
      mediumWrong,
      hardWrong,
      topicScore,
    });
    baselineSnapshot[s.key] = {
      medium_wrong: mediumWrong,
      hard_wrong: hardWrong,
      topic_score: topicScore,
    };
    stageOneRollupByTopic[s.key] = hit ?? {
      hasAttempt: false,
      correctFirstTry: 0,
      mediumWrong: 0,
      hardWrong: 0,
      skipped: 0,
      totalQuestions: 35,
      rawScore: 0,
    };
  }

  const totalWeightScore = Object.values(scoresByTopic).reduce((a, b) => a + b, 0);
  const quotasByTopic = allocateQuotasLargestRemainder(
    scoresByTopic,
    PRACTICE_PREPARATION_TOTAL
  );

  const needsUniformFill = totalWeightScore === 0;

  const topics = baselines.map((b) => ({
    topicCode: b.topicCode,
    mediumWrong: b.mediumWrong,
    hardWrong: b.hardWrong,
    topicScore: b.topicScore,
    weight: totalWeightScore > 0 ? b.topicScore / totalWeightScore : 0,
    quota: quotasByTopic[b.topicCode] ?? 0,
  }));

  return {
    baselines,
    totalWeightScore,
    quotasByTopic,
    weightSnapshot: {
      totalSlots: PRACTICE_PREPARATION_TOTAL,
      totalWeightScore,
      topics,
    },
    baselineSnapshot,
    needsUniformFill,
    stageOneRollupByTopic,
  };
}

/** Sanity check after allocation (dev / tests). */
export function assertQuotasSumToTotal(
  quotas: Record<string, number>,
  total: number = PRACTICE_PREPARATION_TOTAL
): boolean {
  const sum = Object.values(quotas).reduce((a, b) => a + b, 0);
  return sum === total;
}
