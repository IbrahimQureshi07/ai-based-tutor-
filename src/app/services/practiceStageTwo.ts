import { supabase } from '@/app/services/supabase';
import type { AssessmentOutcomeKind } from '@/app/utils/assessmentScoring';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import type { StatusBand } from '@/app/utils/assessmentScoring';

export type PreparationPerTopicSt = { cf: number; mw: number; hw: number; sk: number };

function emptyPerTopic(): PreparationPerTopicSt {
  return { cf: 0, mw: 0, hw: 0, sk: 0 };
}

export type LatestPreparationAttemptSummary = {
  attemptId: string;
  totalQuestions: number;
  correctFirstTry: number;
  mediumWrong: number;
  hardWrong: number;
  skipped: number;
  rawScore: number;
  adjustedScore: number;
  statusBand: StatusBand;
  completedAt: string | null;
};

/** Most recent completed Stage 2 preparation attempt (for Results / cross-stage analytics). */
export async function fetchLatestCompletedPreparationSummary(
  userId: string
): Promise<LatestPreparationAttemptSummary | null> {
  const { data, error } = await supabase
    .from('practice_preparation_attempts')
    .select(
      'id, total_questions, correct_first_try, medium_wrong, hard_wrong, skipped, raw_score, adjusted_score, status_band, completed_at'
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[practiceStageTwo] fetchLatestCompletedPreparationSummary', error.message);
    return null;
  }

  const row = data as {
    id: string;
    total_questions: number;
    correct_first_try: number;
    medium_wrong: number;
    hard_wrong: number;
    skipped: number;
    raw_score: number | string | null;
    adjusted_score: number | string | null;
    status_band: string | null;
    completed_at: string | null;
  };

  const rawNum = row.raw_score == null ? 0 : Number(row.raw_score);
  const adjNum = row.adjusted_score == null ? 0 : Number(row.adjusted_score);

  return {
    attemptId: row.id,
    totalQuestions: row.total_questions ?? 0,
    correctFirstTry: row.correct_first_try ?? 0,
    mediumWrong: row.medium_wrong ?? 0,
    hardWrong: row.hard_wrong ?? 0,
    skipped: row.skipped ?? 0,
    rawScore: Number.isFinite(rawNum) ? Math.round(rawNum * 10) / 10 : 0,
    adjustedScore: Number.isFinite(adjNum) ? Math.round(adjNum * 10) / 10 : 0,
    statusBand: (row.status_band as StatusBand) || 'AVERAGE',
    completedAt: row.completed_at,
  };
}

/** Per-topic outcome counts for one Stage 2 preparation attempt. */
export async function fetchPreparationPerTopicStats(
  attemptId: string
): Promise<Record<string, PreparationPerTopicSt>> {
  const { data, error } = await supabase
    .from('practice_preparation_question_outcomes')
    .select('topic_code, outcome')
    .eq('attempt_id', attemptId);

  const out: Record<string, PreparationPerTopicSt> = {};
  if (error || !data) {
    if (error) console.warn('[practiceStageTwo] fetchPreparationPerTopicStats', error.message);
    return out;
  }

  for (const r of data as { topic_code: string | null; outcome: string }[]) {
    const code = (r.topic_code?.trim() || '__unknown__') as string;
    if (!out[code]) out[code] = emptyPerTopic();
    const t = out[code];
    const o = r.outcome;
    if (o === 'correct_first') t.cf += 1;
    else if (o === 'medium_wrong') t.mw += 1;
    else if (o === 'hard_wrong') t.hw += 1;
    else if (o === 'skipped') t.sk += 1;
  }
  return out;
}

export async function createPreparationAttempt(
  userId: string,
  params: {
    totalQuestions: number;
    baselineSnapshot: Record<string, unknown>;
    weightSnapshot: Record<string, unknown>;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('practice_preparation_attempts')
    .insert({
      user_id: userId,
      status: 'in_progress',
      total_questions: params.totalQuestions,
      correct_first_try: 0,
      medium_wrong: 0,
      hard_wrong: 0,
      skipped: 0,
      baseline_snapshot: params.baselineSnapshot,
      weight_snapshot: params.weightSnapshot,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[practiceStageTwo] createPreparationAttempt', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function insertPreparationOutcome(params: {
  attemptId: string;
  questionId: string;
  topicCode: string | null;
  difficultyBand: AssessmentTier;
  outcome: AssessmentOutcomeKind;
  firstTryCorrect: boolean;
  usedHint: boolean;
  secondTryCorrect: boolean | null;
}): Promise<boolean> {
  const { error } = await supabase.from('practice_preparation_question_outcomes').insert({
    attempt_id: params.attemptId,
    question_id: params.questionId,
    topic_code: params.topicCode,
    difficulty_band: params.difficultyBand,
    outcome: params.outcome,
    first_try_correct: params.firstTryCorrect,
    used_hint: params.usedHint,
    second_try_correct: params.secondTryCorrect,
  });

  if (error) {
    console.warn('[practiceStageTwo] insertPreparationOutcome', error.message);
    return false;
  }
  return true;
}

export async function completePreparationAttempt(params: {
  attemptId: string;
  correctFirstTry: number;
  mediumWrong: number;
  hardWrong: number;
  skipped: number;
  rawScore: number;
  adjustedScore: number;
  statusBand: StatusBand;
}): Promise<boolean> {
  const { error } = await supabase
    .from('practice_preparation_attempts')
    .update({
      status: 'completed',
      correct_first_try: params.correctFirstTry,
      medium_wrong: params.mediumWrong,
      hard_wrong: params.hardWrong,
      skipped: params.skipped,
      raw_score: params.rawScore,
      adjusted_score: params.adjustedScore,
      status_band: params.statusBand,
      completed_at: new Date().toISOString(),
    })
    .eq('id', params.attemptId);

  if (error) {
    console.warn('[practiceStageTwo] completePreparationAttempt', error.message);
    return false;
  }
  return true;
}
