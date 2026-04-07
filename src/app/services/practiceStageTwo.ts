import { supabase } from '@/app/services/supabase';
import type { AssessmentOutcomeKind } from '@/app/utils/assessmentScoring';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import type { StatusBand } from '@/app/utils/assessmentScoring';

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
