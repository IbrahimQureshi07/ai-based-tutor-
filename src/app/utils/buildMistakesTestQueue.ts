import type { Question } from '@/app/data/exam-data';
import type { LevelBandSlug } from '@/app/constants/levelBands';
import { SUBJECTS } from '@/app/data/subjects';
import { fetchLevelsByQuestionIds } from '@/app/services/questionLevels';
import { buildPracticePreparationAllocation } from '@/app/services/practiceStageTwoAggregation';
import { buildMistakeQuestionPool } from '@/app/services/mistakesTestAggregation';
import { subjectLabelMatches } from '@/app/utils/subjectMatch';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import { tierFromQuestion } from '@/app/utils/assessmentTier';
import {
  fillShortfall,
  pickFromTopicPool,
} from '@/app/utils/buildPracticePreparationQueue';
import { allocateQuotasLargestRemainder } from '@/app/utils/practicePreparationQuotas';
import {
  MISTAKES_TEST_MISTAKE_SLOTS_TARGET,
  MISTAKES_TEST_TOTAL,
} from '@/app/utils/mistakesTestConstants';

function shuffleInPlace<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type MistakesTestQueueSource = 'mistake_bank' | 'fresh_weighted';

export type MistakesTestQueueResult = {
  questions: Question[];
  tiers: AssessmentTier[];
  sources: MistakesTestQueueSource[];
  buildSnapshot: Record<string, unknown>;
  shortfall: number;
};

/**
 * Up to 110 questions: past mistakes (unique, priority hard→medium, max 80) + topic-weighted fresh fill.
 */
export async function buildMistakesTestQueue(
  allQuestions: Question[],
  userId: string
): Promise<MistakesTestQueueResult> {
  const pool = await buildMistakeQuestionPool(userId);

  const mistakeQuestions: Question[] = [];
  for (const id of pool.mistakeQuestionIds) {
    const q = allQuestions.find((x) => x.id === id);
    if (q) mistakeQuestions.push(q);
  }

  const mistakePortion = mistakeQuestions.slice(0, MISTAKES_TEST_MISTAKE_SLOTS_TARGET);
  const used = new Set(mistakePortion.map((q) => q.id));

  const levelMap = await fetchLevelsByQuestionIds(allQuestions.map((q) => q.id));

  const tiersMistake: AssessmentTier[] = mistakePortion.map((q) => tierFromQuestion(levelMap, q));
  const sourcesMistake: MistakesTestQueueSource[] = mistakePortion.map(() => 'mistake_bank');

  const freshNeed = Math.max(0, MISTAKES_TEST_TOTAL - mistakePortion.length);
  const allocation = await buildPracticePreparationAllocation(userId);

  const scoresByTopic: Record<string, number> = {};
  for (const s of SUBJECTS) {
    scoresByTopic[s.key] = allocation.baselines.find((b) => b.topicCode === s.key)?.topicScore ?? 0;
  }

  const freshQuotas =
    allocation.needsUniformFill && freshNeed > 0
      ? allocateQuotasLargestRemainder(
          Object.fromEntries(SUBJECTS.map((s) => [s.key, 1])),
          freshNeed
        )
      : allocateQuotasLargestRemainder(scoresByTopic, freshNeed);

  const freshQuestions: Question[] = [];
  const tiersFresh: AssessmentTier[] = [];
  const sourcesFresh: MistakesTestQueueSource[] = [];

  for (const s of SUBJECTS) {
    const n = freshQuotas[s.key] ?? 0;
    if (n <= 0) continue;
    const topicPool = allQuestions.filter((q) => subjectLabelMatches(q, s.key));
    const { picked, tiers: ts } = pickFromTopicPool(topicPool, n, used, levelMap as Map<string, LevelBandSlug>);
    for (let i = 0; i < picked.length; i++) {
      freshQuestions.push(picked[i]);
      tiersFresh.push(ts[i]);
      sourcesFresh.push('fresh_weighted');
    }
  }

  let deficit = freshNeed - freshQuestions.length;
  if (deficit > 0) {
    const extra = fillShortfall(allQuestions, deficit, used, levelMap as Map<string, LevelBandSlug>);
    for (let i = 0; i < extra.picked.length; i++) {
      freshQuestions.push(extra.picked[i]);
      tiersFresh.push(extra.tiers[i]);
      sourcesFresh.push('fresh_weighted');
    }
  }

  let combinedQ = [...mistakePortion, ...freshQuestions];
  let combinedTiers = [...tiersMistake, ...tiersFresh];
  let combinedSources: MistakesTestQueueSource[] = [...sourcesMistake, ...sourcesFresh];

  let shortfall = MISTAKES_TEST_TOTAL - combinedQ.length;
  if (shortfall > 0) {
    const extra = fillShortfall(allQuestions, shortfall, used, levelMap as Map<string, LevelBandSlug>);
    for (let i = 0; i < extra.picked.length; i++) {
      combinedQ.push(extra.picked[i]);
      combinedTiers.push(extra.tiers[i]);
      combinedSources.push('fresh_weighted');
    }
    shortfall = MISTAKES_TEST_TOTAL - combinedQ.length;
  }

  const packed = combinedQ.map((q, i) => ({
    q,
    t: combinedTiers[i] ?? ('medium' as AssessmentTier),
    s: combinedSources[i] ?? 'fresh_weighted',
  }));
  shuffleInPlace(packed);

  const buildSnapshot: Record<string, unknown> = {
    totalHardWrongRows: pool.totalHardWrongRows,
    hardOnlyRule: pool.hardOnlyRule,
    mistakeIdsRequested: pool.mistakeQuestionIds.length,
    mistakeSlotsUsed: mistakePortion.length,
    freshSlotsTarget: freshNeed,
    needsUniformFill: allocation.needsUniformFill,
  };

  return {
    questions: packed.map((p) => p.q).slice(0, MISTAKES_TEST_TOTAL),
    tiers: packed.map((p) => p.t).slice(0, MISTAKES_TEST_TOTAL),
    sources: packed.map((p) => p.s).slice(0, MISTAKES_TEST_TOTAL),
    buildSnapshot,
    shortfall: Math.max(0, shortfall),
  };
}
