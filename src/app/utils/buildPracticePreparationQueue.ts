import type { Question } from '@/app/data/exam-data';
import type { LevelBandSlug } from '@/app/constants/levelBands';
import { SUBJECTS } from '@/app/data/subjects';
import { fetchLevelsByQuestionIds } from '@/app/services/questionLevels';
import type { PracticePreparationAllocation } from '@/app/services/practiceStageTwoAggregation';
import { subjectLabelMatches } from '@/app/utils/subjectMatch';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import { tierFromQuestion } from '@/app/utils/assessmentTier';
import {
  PRACTICE_PREPARATION_TOTAL,
  allocateQuotasLargestRemainder,
} from '@/app/utils/practicePreparationQuotas';

function shuffleInPlace<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Scale Stage-1 style 12 / 13 / 10 mix to exactly `n` slots (largest remainder on tiers). */
function tierCountsForN(n: number): Record<AssessmentTier, number> {
  if (n <= 0) return { easy: 0, medium: 0, hard: 0 };
  const exact = {
    easy: (n * 12) / 35,
    medium: (n * 13) / 35,
    hard: (n * 10) / 35,
  };
  let e = Math.floor(exact.easy);
  let m = Math.floor(exact.medium);
  let h = Math.floor(exact.hard);
  let leftover = n - e - m - h;
  const parts = [
    { t: 'easy' as const, frac: exact.easy - e },
    { t: 'medium' as const, frac: exact.medium - m },
    { t: 'hard' as const, frac: exact.hard - h },
  ].sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < leftover && i < parts.length; i++) {
    const t = parts[i].t;
    if (t === 'easy') e++;
    else if (t === 'medium') m++;
    else h++;
  }
  return { easy: e, medium: m, hard: h };
}

/**
 * Pick up to `need` questions from a single-topic pool, medium-heavy mix, skip `used` ids.
 */
function pickFromTopicPool(
  pool: Question[],
  need: number,
  used: Set<string>,
  levelMap: Map<string, LevelBandSlug>
): { picked: Question[]; tiers: AssessmentTier[] } {
  const picked: Question[] = [];
  const tiers: AssessmentTier[] = [];
  if (need <= 0 || pool.length === 0) return { picked, tiers };

  const byTier: Record<AssessmentTier, Question[]> = { easy: [], medium: [], hard: [] };
  for (const q of pool) {
    if (used.has(q.id)) continue;
    const t = tierFromQuestion(levelMap, q);
    byTier[t].push(q);
  }
  for (const t of ['easy', 'medium', 'hard'] as const) {
    byTier[t] = shuffleInPlace(byTier[t]);
  }

  const counts = tierCountsForN(need);
  const take = (tier: AssessmentTier, max: number) => {
    let n = 0;
    const avail = byTier[tier];
    while (n < max && picked.length < need && avail.length > 0) {
      const q = avail.pop()!;
      if (used.has(q.id)) continue;
      used.add(q.id);
      picked.push(q);
      tiers.push(tier);
      n++;
    }
  };

  take('easy', counts.easy);
  take('medium', counts.medium);
  take('hard', counts.hard);

  let deficit = need - picked.length;
  if (deficit > 0) {
    const refillOrder: AssessmentTier[] = ['medium', 'hard', 'easy'];
    for (const tier of refillOrder) {
      if (deficit <= 0) break;
      const avail = byTier[tier];
      while (deficit > 0 && avail.length > 0) {
        const q = avail.pop()!;
        if (used.has(q.id)) continue;
        used.add(q.id);
        picked.push(q);
        tiers.push(tier);
        deficit--;
      }
    }
  }

  if (deficit > 0) {
    const rest = shuffleInPlace(pool.filter((q) => !used.has(q.id)));
    for (const q of rest) {
      if (deficit <= 0) break;
      used.add(q.id);
      picked.push(q);
      tiers.push(tierFromQuestion(levelMap, q));
      deficit--;
    }
  }

  return { picked, tiers };
}

/**
 * Fill remaining slots from unused bank questions; prefer medium → hard → easy.
 */
function fillShortfall(
  allQuestions: Question[],
  need: number,
  used: Set<string>,
  levelMap: Map<string, LevelBandSlug>
): { picked: Question[]; tiers: AssessmentTier[] } {
  const picked: Question[] = [];
  const tiers: AssessmentTier[] = [];
  if (need <= 0) return { picked, tiers };

  const unused = allQuestions.filter((q) => !used.has(q.id));
  const byTier: Record<AssessmentTier, Question[]> = { easy: [], medium: [], hard: [] };
  for (const q of unused) {
    const t = tierFromQuestion(levelMap, q);
    byTier[t].push(q);
  }
  for (const t of ['easy', 'medium', 'hard'] as const) {
    byTier[t] = shuffleInPlace(byTier[t]);
  }

  let left = need;
  for (const tier of ['medium', 'hard', 'easy'] as const) {
    const avail = byTier[tier];
    while (left > 0 && avail.length > 0) {
      const q = avail.pop()!;
      if (used.has(q.id)) continue;
      used.add(q.id);
      picked.push(q);
      tiers.push(tier);
      left--;
    }
  }

  return { picked, tiers };
}

export type PracticePreparationQueueResult = {
  questions: Question[];
  tiers: AssessmentTier[];
  /** Effective per-topic quotas used (after uniform fill if any) */
  quotasUsed: Record<string, number>;
  /** 0 = full 110; >0 = bank too small for some topics */
  shortfall: number;
};

/**
 * Build 110 (or fewer if bank insufficient) unique bank questions from Stage 2 allocation.
 * - Per topic: same 12/13/10 tier mix as Stage 1, scaled to that topic's quota.
 * - `needsUniformFill`: equal weight per catalog topic → largest remainder → 110.
 * - Shortfall after topic passes: fill from global unused pool (medium-heavy).
 */
export async function buildPracticePreparationQueue(
  allQuestions: Question[],
  allocation: PracticePreparationAllocation
): Promise<PracticePreparationQueueResult> {
  const levelMap = await fetchLevelsByQuestionIds(allQuestions.map((q) => q.id));
  const used = new Set<string>();
  const questions: Question[] = [];
  const tiers: AssessmentTier[] = [];

  let quotasUsed: Record<string, number>;

  if (allocation.needsUniformFill) {
    const uniform: Record<string, number> = {};
    for (const s of SUBJECTS) uniform[s.key] = 1;
    quotasUsed = allocateQuotasLargestRemainder(uniform, PRACTICE_PREPARATION_TOTAL);
  } else {
    quotasUsed = { ...allocation.quotasByTopic };
  }

  for (const s of SUBJECTS) {
    const n = quotasUsed[s.key] ?? 0;
    if (n <= 0) continue;
    const pool = allQuestions.filter((q) => subjectLabelMatches(q, s.key));
    const { picked, tiers: ts } = pickFromTopicPool(pool, n, used, levelMap);
    questions.push(...picked);
    tiers.push(...ts);
  }

  let shortfall = PRACTICE_PREPARATION_TOTAL - questions.length;
  if (shortfall > 0) {
    const extra = fillShortfall(allQuestions, shortfall, used, levelMap);
    questions.push(...extra.picked);
    tiers.push(...extra.tiers);
    shortfall = PRACTICE_PREPARATION_TOTAL - questions.length;
  }

  const combined = questions.map((q, i) => ({ q, t: tiers[i] ?? ('medium' as AssessmentTier) }));
  shuffleInPlace(combined);

  return {
    questions: combined.map((c) => c.q).slice(0, PRACTICE_PREPARATION_TOTAL),
    tiers: combined.map((c) => c.t).slice(0, PRACTICE_PREPARATION_TOTAL),
    quotasUsed,
    shortfall: Math.max(0, shortfall),
  };
}
