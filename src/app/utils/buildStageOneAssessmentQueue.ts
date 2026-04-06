import type { Question } from '@/app/data/exam-data';
import { subjectLabelMatches } from '@/app/utils/subjectMatch';
import { fetchLevelsByQuestionIds } from '@/app/services/questionLevels';
import { type AssessmentTier, tierFromQuestion } from '@/app/utils/assessmentTier';

export const STAGE_ONE_TOPIC_TOTAL = 35;
export const STAGE_ONE_COUNTS: Record<AssessmentTier, number> = {
  easy: 12,
  medium: 13,
  hard: 10,
};

function shuffleInPlace<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build 35 bank questions for one topic: 12 easy, 13 medium, 10 hard (3-tier).
 * Pools from dataset using `question_levels` when present.
 */
export async function buildStageOneAssessmentQueue(
  allQuestions: Question[],
  topicKey: string
): Promise<{ banks: Question[]; tiers: AssessmentTier[] }> {
  const pool = allQuestions.filter((q) => subjectLabelMatches(q, topicKey));
  if (pool.length === 0) {
    return { banks: [], tiers: [] };
  }

  const levelMap = await fetchLevelsByQuestionIds(pool.map((q) => q.id));

  const byTier: Record<AssessmentTier, Question[]> = { easy: [], medium: [], hard: [] };
  for (const q of pool) {
    const t = tierFromQuestion(levelMap, q);
    byTier[t].push(q);
  }

  for (const t of ['easy', 'medium', 'hard'] as const) {
    byTier[t] = shuffleInPlace(byTier[t]);
  }

  const picked: Question[] = [];
  const tiers: AssessmentTier[] = [];

  const take = (tier: AssessmentTier, need: number) => {
    const avail = byTier[tier];
    let n = 0;
    while (n < need && avail.length > 0) {
      const q = avail.pop()!;
      picked.push(q);
      tiers.push(tier);
      n++;
    }
    return n;
  };

  take('easy', STAGE_ONE_COUNTS.easy);
  take('medium', STAGE_ONE_COUNTS.medium);
  take('hard', STAGE_ONE_COUNTS.hard);

  let deficit = STAGE_ONE_TOPIC_TOTAL - picked.length;
  if (deficit > 0) {
    const refillOrder: AssessmentTier[] = ['medium', 'easy', 'hard'];
    for (const tier of refillOrder) {
      if (deficit <= 0) break;
      while (deficit > 0 && byTier[tier].length > 0) {
        const q = byTier[tier].pop()!;
        picked.push(q);
        tiers.push(tier);
        deficit--;
      }
    }
  }

  if (deficit > 0) {
    const used = new Set(picked.map((q) => q.id));
    const rest = shuffleInPlace(pool.filter((q) => !used.has(q.id)));
    for (const q of rest) {
      if (deficit <= 0) break;
      picked.push(q);
      tiers.push(tierFromQuestion(levelMap, q));
      deficit--;
    }
  }

  return { banks: picked.slice(0, STAGE_ONE_TOPIC_TOTAL), tiers: tiers.slice(0, STAGE_ONE_TOPIC_TOTAL) };
}
