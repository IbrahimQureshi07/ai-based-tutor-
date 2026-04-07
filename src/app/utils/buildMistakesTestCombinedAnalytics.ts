import type { Question } from '@/app/data/exam-data';
import { SUBJECTS } from '@/app/data/subjects';
import type { StageOneTopicRollupEntry } from '@/app/services/practiceStageTwoAggregation';
import type { LatestPreparationAttemptSummary, PreparationPerTopicSt } from '@/app/services/practiceStageTwo';
import { subjectLabelMatches } from '@/app/utils/subjectMatch';
import {
  computeAdjustedScore,
  computeRawScorePercentForTotal,
  statusBandFromAdjusted,
  type StatusBand,
} from '@/app/utils/assessmentScoring';

export type MistakesTestPerTopicSt = { cf: number; mw: number; hw: number; sk: number };

export type MistakesTestCombinedTopicRow = {
  topicCode: string;
  topicLabel: string;
  stageOneHasAttempt: boolean;
  stageOneCorrectFirstTry: number;
  stageOneTotalQuestions: number;
  stageOneFirstTryPercent: number | null;
  stageTwoSlotCount: number;
  stageTwoCorrectFirstTry: number;
  stageTwoFirstTryPercent: number | null;
  stage25SlotCount: number;
  stage25CorrectFirstTry: number;
  stage25MediumWrong: number;
  stage25HardWrong: number;
  stage25FirstTryPercent: number | null;
  stage25AdjustedPercent: number;
  stage25StatusBand: StatusBand;
};

export type MistakesTestCombinedAnalyticsPayload = {
  topicsCompared: MistakesTestCombinedTopicRow[];
  summary: {
    stageOneTopicsAttempted: number;
    stageOneWeightedFirstTryPercent: number | null;
    stageTwo: {
      hasData: boolean;
      totalQuestions: number;
      correctFirstTry: number;
      firstTryPercent: number;
      rawScore: number;
      adjustedScore: number;
      statusBand: StatusBand;
      completedAt: string | null;
    };
    stageTwoFive: {
      totalQuestions: number;
      correctFirstTry: number;
      firstTryPercent: number;
      rawScore: number;
      adjustedScore: number;
      statusBand: StatusBand;
    };
  };
};

function topicCodeFromQuestion(q: Question): string {
  for (const s of SUBJECTS) {
    if (subjectLabelMatches(q, s.key)) return s.key;
  }
  return '__unknown__';
}

function countSlotsByTopic(banks: Question[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const q of banks) {
    const c = topicCodeFromQuestion(q);
    m[c] = (m[c] ?? 0) + 1;
  }
  return m;
}

function slotCount(st: PreparationPerTopicSt | MistakesTestPerTopicSt): number {
  return st.cf + st.mw + st.hw + st.sk;
}

/**
 * Cross-stage snapshot for Results after a Stage 2.5 run: latest S1 rollups, latest S2 attempt (DB),
 * and this mistakes-test run per topic.
 */
export function buildMistakesTestCombinedAnalytics(
  rollupMap: Map<string, StageOneTopicRollupEntry>,
  latestPrep: LatestPreparationAttemptSummary | null,
  prepPerTopic: Record<string, PreparationPerTopicSt>,
  mistakeBanks: Question[],
  perTopic25: Record<string, MistakesTestPerTopicSt>,
  stage25Totals: {
    totalQuestions: number;
    correctFirstTry: number;
    mediumWrong: number;
    rawScore: number;
    adjustedScore: number;
    statusBand: StatusBand;
  }
): MistakesTestCombinedAnalyticsPayload {
  const slot25 = countSlotsByTopic(mistakeBanks);

  let stageOneTopicsAttempted = 0;
  let sumCf1 = 0;
  let sumT1 = 0;

  const topicsCompared: MistakesTestCombinedTopicRow[] = [];

  for (const s of SUBJECTS) {
    const r = rollupMap.get(s.key);
    const p2 = prepPerTopic[s.key] ?? emptyPerTopic();
    const p25 = perTopic25[s.key] ?? emptyPerTopic25();
    const slots2 = slotCount(p2);
    const slots25 = slot25[s.key] ?? 0;

    if (r?.hasAttempt) {
      stageOneTopicsAttempted += 1;
      sumCf1 += r.correctFirstTry;
      sumT1 += r.totalQuestions;
    }

    const n25 = slots25 > 0 ? slots25 : slotCount(p25);
    const raw25 = n25 > 0 ? computeRawScorePercentForTotal(p25.cf, n25) : 0;
    const adj25 = n25 > 0 ? computeAdjustedScore(raw25, p25.mw) : 0;
    const band25 = n25 > 0 ? statusBandFromAdjusted(adj25) : ('AVERAGE' as StatusBand);

    topicsCompared.push({
      topicCode: s.key,
      topicLabel: s.label,
      stageOneHasAttempt: r?.hasAttempt ?? false,
      stageOneCorrectFirstTry: r?.correctFirstTry ?? 0,
      stageOneTotalQuestions: r?.totalQuestions ?? 35,
      stageOneFirstTryPercent:
        r?.hasAttempt && (r.totalQuestions ?? 0) > 0
          ? Math.round((r.correctFirstTry / r.totalQuestions) * 1000) / 10
          : null,
      stageTwoSlotCount: slots2,
      stageTwoCorrectFirstTry: p2.cf,
      stageTwoFirstTryPercent: slots2 > 0 ? Math.round((p2.cf / slots2) * 1000) / 10 : null,
      stage25SlotCount: slots25,
      stage25CorrectFirstTry: p25.cf,
      stage25MediumWrong: p25.mw,
      stage25HardWrong: p25.hw,
      stage25FirstTryPercent: slots25 > 0 ? Math.round((p25.cf / slots25) * 1000) / 10 : null,
      stage25AdjustedPercent: n25 > 0 ? adj25 : 0,
      stage25StatusBand: band25,
    });
  }

  const unk2 = prepPerTopic['__unknown__'] ?? emptyPerTopic();
  const unk25 = perTopic25['__unknown__'] ?? emptyPerTopic25();
  const unkSlots2 = slotCount(unk2);
  const unkSlots25 = slot25['__unknown__'] ?? 0;
  if (unkSlots2 > 0 || unkSlots25 > 0 || unk25.cf + unk25.mw + unk25.hw + unk25.sk > 0) {
    const n25u = unkSlots25 > 0 ? unkSlots25 : slotCount(unk25);
    const raw25u = n25u > 0 ? computeRawScorePercentForTotal(unk25.cf, n25u) : 0;
    const adj25u = n25u > 0 ? computeAdjustedScore(raw25u, unk25.mw) : 0;
    topicsCompared.push({
      topicCode: '__unknown__',
      topicLabel: 'Other / unmatched',
      stageOneHasAttempt: false,
      stageOneCorrectFirstTry: 0,
      stageOneTotalQuestions: 0,
      stageOneFirstTryPercent: null,
      stageTwoSlotCount: unkSlots2,
      stageTwoCorrectFirstTry: unk2.cf,
      stageTwoFirstTryPercent: unkSlots2 > 0 ? Math.round((unk2.cf / unkSlots2) * 1000) / 10 : null,
      stage25SlotCount: unkSlots25,
      stage25CorrectFirstTry: unk25.cf,
      stage25MediumWrong: unk25.mw,
      stage25HardWrong: unk25.hw,
      stage25FirstTryPercent: unkSlots25 > 0 ? Math.round((unk25.cf / unkSlots25) * 1000) / 10 : null,
      stage25AdjustedPercent: n25u > 0 ? adj25u : 0,
      stage25StatusBand: n25u > 0 ? statusBandFromAdjusted(adj25u) : 'AVERAGE',
    });
  }

  const T2 = latestPrep?.totalQuestions ?? 0;
  const cf2 = latestPrep?.correctFirstTry ?? 0;

  return {
    topicsCompared,
    summary: {
      stageOneTopicsAttempted,
      stageOneWeightedFirstTryPercent:
        sumT1 > 0 ? Math.round((sumCf1 / sumT1) * 1000) / 10 : null,
      stageTwo: {
        hasData: latestPrep != null && T2 > 0,
        totalQuestions: T2,
        correctFirstTry: cf2,
        firstTryPercent: T2 > 0 ? Math.round((cf2 / T2) * 1000) / 10 : 0,
        rawScore: latestPrep?.rawScore ?? 0,
        adjustedScore: latestPrep?.adjustedScore ?? 0,
        statusBand: latestPrep?.statusBand ?? 'AVERAGE',
        completedAt: latestPrep?.completedAt ?? null,
      },
      stageTwoFive: {
        totalQuestions: stage25Totals.totalQuestions,
        correctFirstTry: stage25Totals.correctFirstTry,
        firstTryPercent:
          stage25Totals.totalQuestions > 0
            ? Math.round(
                (stage25Totals.correctFirstTry / stage25Totals.totalQuestions) * 1000
              ) / 10
            : 0,
        rawScore: stage25Totals.rawScore,
        adjustedScore: stage25Totals.adjustedScore,
        statusBand: stage25Totals.statusBand,
      },
    },
  };
}

function emptyPerTopic(): PreparationPerTopicSt {
  return { cf: 0, mw: 0, hw: 0, sk: 0 };
}

function emptyPerTopic25(): MistakesTestPerTopicSt {
  return { cf: 0, mw: 0, hw: 0, sk: 0 };
}
