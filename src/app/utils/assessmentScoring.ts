import type { AssessmentTier } from '@/app/utils/assessmentTier';
import { STAGE_ONE_TOPIC_TOTAL } from '@/app/utils/buildStageOneAssessmentQueue';

export type AssessmentOutcomeKind = 'correct_first' | 'medium_wrong' | 'hard_wrong' | 'skipped';

export function computeRawScorePercent(correctFirstTry: number): number {
  if (STAGE_ONE_TOPIC_TOTAL <= 0) return 0;
  return Math.round((correctFirstTry / STAGE_ONE_TOPIC_TOTAL) * 1000) / 10;
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
