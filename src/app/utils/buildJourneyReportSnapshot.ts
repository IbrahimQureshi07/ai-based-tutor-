import { SUBJECTS } from '@/app/data/subjects';
import type { UserProgress } from '@/app/data/exam-data';
import {
  fetchLatestStageOneRollupByTopic,
  userHasCompletedStageOne,
} from '@/app/services/practiceStageTwoAggregation';
import { userHasCompletedStageTwoPreparation } from '@/app/services/mistakesTestAggregation';
import {
  fetchLatestCompletedPreparationSummary,
  fetchPreparationPerTopicStats,
} from '@/app/services/practiceStageTwo';
import type { MistakesTestCombinedAnalyticsPayload } from '@/app/utils/buildMistakesTestCombinedAnalytics';

/** Serializable bundle for the combined journey AI report + Results UI. */
export type JourneyReportSnapshot = {
  generatedAtIso: string;
  app: {
    accuracy: number;
    examReadiness: number;
    level: number;
    mockTestsCompleted: number;
    mockUnlockedByReadiness: boolean;
  };
  gates: {
    stageOneStarted: boolean;
    stageTwoPrepUnlocked: boolean;
    mistakesTestUnlocked: boolean;
  };
  stage1ByTopic: Array<{
    topicCode: string;
    topicLabel: string;
    hasAttempt: boolean;
    firstTryPercent: number | null;
    mediumWrong: number;
    hardWrong: number;
    totalQuestions: number;
  }>;
  stage1Summary: {
    topicsAttempted: number;
    weightedFirstTryPercent: number | null;
  };
  latestStage2: {
    totalQuestions: number;
    correctFirstTry: number;
    firstTryPercent: number;
    rawScore: number;
    adjustedScore: number;
    statusBand: string;
    completedAt: string | null;
  } | null;
  stage2ByTopic: Array<{
    topicCode: string;
    slots: number;
    firstTryPercent: number | null;
  }>;
  lastSessionStageOne: Record<string, unknown> | null;
  lastSessionStageTwo: Record<string, unknown> | null;
  lastSessionMistakesTest: Record<string, unknown> | null;
  lastSessionCombined: MistakesTestCombinedAnalyticsPayload | null;
  unresolvedQuestionIds: string[];
};

function pickSessionFields(obj: unknown, keys: string[]): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in o) out[k] = o[k];
  }
  return Object.keys(out).length ? out : null;
}

export async function buildJourneyReportSnapshot(
  userId: string,
  lastSessionResults: {
    stageOneAssessment?: unknown;
    stageTwoAssessment?: unknown;
    mistakesTestAssessment?: unknown;
    mistakesTestCombinedAnalytics?: MistakesTestCombinedAnalyticsPayload | undefined;
  } | null,
  userProgress: UserProgress
): Promise<JourneyReportSnapshot> {
  const rollupMap = await fetchLatestStageOneRollupByTopic(userId);
  const s1Done = await userHasCompletedStageOne(userId);
  const s2PrepDone = await userHasCompletedStageTwoPreparation(userId);

  const latestPrep = await fetchLatestCompletedPreparationSummary(userId);
  const prepPerTopic = latestPrep ? await fetchPreparationPerTopicStats(latestPrep.attemptId) : {};

  const stage1ByTopic = SUBJECTS.map((s) => {
    const r = rollupMap.get(s.key);
    const has = r?.hasAttempt ?? false;
    const tq = r?.totalQuestions ?? 35;
    const pct =
      has && tq > 0 ? Math.round((r!.correctFirstTry / tq) * 1000) / 10 : null;
    return {
      topicCode: s.key,
      topicLabel: s.label,
      hasAttempt: has,
      firstTryPercent: pct,
      mediumWrong: r?.mediumWrong ?? 0,
      hardWrong: r?.hardWrong ?? 0,
      totalQuestions: tq,
    };
  });

  let sumCf = 0;
  let sumT = 0;
  let topicsAttempted = 0;
  for (const row of stage1ByTopic) {
    if (row.hasAttempt) {
      topicsAttempted += 1;
      const r = rollupMap.get(row.topicCode);
      if (r) {
        sumCf += r.correctFirstTry;
        sumT += r.totalQuestions;
      }
    }
  }

  const stage2ByTopic = SUBJECTS.map((s) => {
    const p = prepPerTopic[s.key] ?? { cf: 0, mw: 0, hw: 0, sk: 0 };
    const slots = p.cf + p.mw + p.hw + p.sk;
    return {
      topicCode: s.key,
      slots,
      firstTryPercent: slots > 0 ? Math.round((p.cf / slots) * 1000) / 10 : null,
    };
  });

  const unresolved =
    lastSessionResults?.mistakesTestAssessment &&
    typeof lastSessionResults.mistakesTestAssessment === 'object' &&
    'unresolvedQuestionIds' in lastSessionResults.mistakesTestAssessment
      ? (lastSessionResults.mistakesTestAssessment as { unresolvedQuestionIds: string[] })
          .unresolvedQuestionIds
      : [];

  const T2 = latestPrep?.totalQuestions ?? 0;
  const cf2 = latestPrep?.correctFirstTry ?? 0;

  return {
    generatedAtIso: new Date().toISOString(),
    app: {
      accuracy: userProgress.accuracy,
      examReadiness: userProgress.examReadiness,
      level: userProgress.level,
      mockTestsCompleted: userProgress.mockTestsCompleted,
      mockUnlockedByReadiness: userProgress.examReadiness >= 80,
    },
    gates: {
      stageOneStarted: s1Done,
      stageTwoPrepUnlocked: s1Done,
      mistakesTestUnlocked: s1Done && s2PrepDone,
    },
    stage1ByTopic,
    stage1Summary: {
      topicsAttempted,
      weightedFirstTryPercent: sumT > 0 ? Math.round((sumCf / sumT) * 1000) / 10 : null,
    },
    latestStage2:
      latestPrep && T2 > 0
        ? {
            totalQuestions: T2,
            correctFirstTry: cf2,
            firstTryPercent: Math.round((cf2 / T2) * 1000) / 10,
            rawScore: latestPrep.rawScore,
            adjustedScore: latestPrep.adjustedScore,
            statusBand: latestPrep.statusBand,
            completedAt: latestPrep.completedAt,
          }
        : null,
    stage2ByTopic,
    lastSessionStageOne: pickSessionFields(lastSessionResults?.stageOneAssessment, [
      'topicLabel',
      'rawScore',
      'adjustedScore',
      'statusBand',
      'correctFirstTry',
      'mediumWrong',
      'hardWrong',
      'totalQuestions',
    ]),
    lastSessionStageTwo: pickSessionFields(lastSessionResults?.stageTwoAssessment, [
      'topicLabel',
      'rawScore',
      'adjustedScore',
      'statusBand',
      'correctFirstTry',
      'mediumWrong',
      'hardWrong',
      'totalQuestions',
    ]),
    lastSessionMistakesTest: pickSessionFields(lastSessionResults?.mistakesTestAssessment, [
      'topicLabel',
      'rawScore',
      'adjustedScore',
      'statusBand',
      'correctFirstTry',
      'mediumWrong',
      'hardWrong',
      'totalQuestions',
      'unresolvedQuestionIds',
      'teacherAlertSent',
    ]),
    lastSessionCombined: lastSessionResults?.mistakesTestCombinedAnalytics ?? null,
    unresolvedQuestionIds: unresolved,
  };
}

export function subjectStrengthLabel(
  firstTryPercent: number | null,
  hasAttempt: boolean
): 'strong' | 'average' | 'weak' | 'unknown' {
  if (!hasAttempt || firstTryPercent == null) return 'unknown';
  if (firstTryPercent >= 75) return 'strong';
  if (firstTryPercent >= 50) return 'average';
  return 'weak';
}
