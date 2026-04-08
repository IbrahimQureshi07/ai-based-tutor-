import type { AssessmentTier } from '@/app/utils/assessmentTier';
import { STAGE_ONE_TOPIC_TOTAL } from '@/app/utils/buildStageOneAssessmentQueue';

export type AssessmentOutcomeKind = 'correct_first' | 'medium_wrong' | 'hard_wrong' | 'skipped';

export function computeRawScorePercent(correctFirstTry: number): number {
  if (STAGE_ONE_TOPIC_TOTAL <= 0) return 0;
  return Math.round((correctFirstTry / STAGE_ONE_TOPIC_TOTAL) * 1000) / 10;
}

/** Stage 2 (variable-length queue) first-try % */
export function computeRawScorePercentForTotal(correctFirstTry: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  return Math.round((correctFirstTry / totalQuestions) * 1000) / 10;
}

export function computeAdjustedScore(rawPercent: number, mediumWrongs: number): number {
  return Math.round((rawPercent + mediumWrongs * 0.5) * 10) / 10;
}

export type StatusBand = 'STRONG' | 'AVERAGE' | 'WEAK' | 'CRITICAL';

export function statusBandFromAdjusted(adjustedPercent: number): StatusBand {
  if (adjustedPercent > 75) return 'STRONG';
  if (adjustedPercent >= 50) return 'AVERAGE';
  if (adjustedPercent >= 30) return 'WEAK';
  return 'CRITICAL';
}

export function buildAssessmentNarrative(medium: number, hard: number): string {
  if (hard > medium) {
    return 'Hard wrongs outnumber medium wrongs — concepts may need more time to stick. Review explanations and revisit weak topics.';
  }
  if (medium > 0 && hard === 0) {
    return 'You often corrected after a hint — good recovery. Keep drilling first-try accuracy.';
  }
  return 'Solid mix of outcomes — use topic breakdown below to prioritize study time.';
}

/** Tier breakdown: how many first-try correct per tier (for report). */
export function emptyTierBreakdown(): Record<AssessmentTier, { correct: number; total: number }> {
  return {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  };
}

/** Per-topic mock rollup: first-try % + recovery bonus (same shape as Stage 1 adjusted band). */
export type MockTopicRollupEntry = {
  total: number;
  correctFirstTry: number;
  mediumWrong: number;
  hardWrong: number;
  skipped: number;
  rawScore: number;
  adjustedScore: number;
  statusBand: StatusBand;
};

/**
 * If any topic’s adjusted band is CRITICAL, the mock fails regardless of overall percent.
 */
export function mockTopicRollupsAndCritical(
  slots: Array<{
    topicCode: string;
    firstTryCorrect: boolean;
    finalSkipped: boolean;
    retryRecovery: boolean;
    hardWrongPattern: boolean;
  }>
): { topicRollup: Record<string, MockTopicRollupEntry>; hasCriticalBand: boolean } {
  const buckets = new Map<
    string,
    { T: number; cf: number; mw: number; hw: number; sk: number }
  >();

  for (const s of slots) {
    const code = (s.topicCode || 'General').trim() || 'General';
    let b = buckets.get(code);
    if (!b) {
      b = { T: 0, cf: 0, mw: 0, hw: 0, sk: 0 };
      buckets.set(code, b);
    }
    b.T += 1;
    if (s.finalSkipped) b.sk += 1;
    else if (s.firstTryCorrect) b.cf += 1;
    else if (s.retryRecovery) b.mw += 1;
    else if (s.hardWrongPattern) b.hw += 1;
  }

  const topicRollup: Record<string, MockTopicRollupEntry> = {};
  let hasCriticalBand = false;

  for (const [code, b] of buckets) {
    const rawScore = computeRawScorePercentForTotal(b.cf, b.T);
    const adjustedScore = computeAdjustedScore(rawScore, b.mw);
    const statusBand = statusBandFromAdjusted(adjustedScore);
    if (b.T > 0 && statusBand === 'CRITICAL') hasCriticalBand = true;
    topicRollup[code] = {
      total: b.T,
      correctFirstTry: b.cf,
      mediumWrong: b.mw,
      hardWrong: b.hw,
      skipped: b.sk,
      rawScore,
      adjustedScore,
      statusBand,
    };
  }

  return { topicRollup, hasCriticalBand };
}
