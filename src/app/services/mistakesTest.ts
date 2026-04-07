import { supabase } from '@/app/services/supabase';
import type { AssessmentOutcomeKind } from '@/app/utils/assessmentScoring';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import type { StatusBand } from '@/app/utils/assessmentScoring';
import type { MistakesTestQueueSource } from '@/app/utils/buildMistakesTestQueue';

export async function createMistakesTestAttempt(
  userId: string,
  params: {
    totalQuestions: number;
    buildSnapshot: Record<string, unknown>;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('mistakes_test_attempts')
    .insert({
      user_id: userId,
      status: 'in_progress',
      total_questions: params.totalQuestions,
      correct_first_try: 0,
      medium_wrong: 0,
      hard_wrong: 0,
      skipped: 0,
      build_snapshot: params.buildSnapshot,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[mistakesTest] createMistakesTestAttempt', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function insertMistakesTestOutcome(params: {
  attemptId: string;
  questionId: string;
  topicCode: string | null;
  difficultyBand: AssessmentTier;
  outcome: AssessmentOutcomeKind;
  firstTryCorrect: boolean;
  usedHint: boolean;
  secondTryCorrect: boolean | null;
  questionSource: MistakesTestQueueSource | null;
}): Promise<boolean> {
  const { error } = await supabase.from('mistakes_test_question_outcomes').insert({
    attempt_id: params.attemptId,
    question_id: params.questionId,
    topic_code: params.topicCode,
    difficulty_band: params.difficultyBand,
    outcome: params.outcome,
    first_try_correct: params.firstTryCorrect,
    used_hint: params.usedHint,
    second_try_correct: params.secondTryCorrect,
    question_source: params.questionSource,
  });

  if (error) {
    console.warn('[mistakesTest] insertMistakesTestOutcome', error.message);
    return false;
  }
  return true;
}

export async function completeMistakesTestAttempt(params: {
  attemptId: string;
  correctFirstTry: number;
  mediumWrong: number;
  hardWrong: number;
  skipped: number;
  rawScore: number;
  adjustedScore: number;
  statusBand: StatusBand;
  unresolvedSnapshot: Record<string, unknown> | null;
}): Promise<boolean> {
  const { error } = await supabase
    .from('mistakes_test_attempts')
    .update({
      status: 'completed',
      correct_first_try: params.correctFirstTry,
      medium_wrong: params.mediumWrong,
      hard_wrong: params.hardWrong,
      skipped: params.skipped,
      raw_score: params.rawScore,
      adjusted_score: params.adjustedScore,
      status_band: params.statusBand,
      unresolved_snapshot: params.unresolvedSnapshot,
      completed_at: new Date().toISOString(),
    })
    .eq('id', params.attemptId);

  if (error) {
    console.warn('[mistakesTest] completeMistakesTestAttempt', error.message);
    return false;
  }
  return true;
}

export async function insertMistakesTestTeacherAlert(params: {
  userId: string;
  attemptId: string;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  const { error } = await supabase.from('mistakes_test_teacher_alerts').insert({
    user_id: params.userId,
    attempt_id: params.attemptId,
    payload: params.payload,
  });

  if (error) {
    console.warn('[mistakesTest] insertMistakesTestTeacherAlert', error.message);
    return false;
  }
  return true;
}
