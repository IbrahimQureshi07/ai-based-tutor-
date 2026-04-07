import { supabase } from '@/app/services/supabase';
import type { AssessmentOutcomeKind } from '@/app/utils/assessmentScoring';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import type { StatusBand } from '@/app/utils/assessmentScoring';

export async function createTopicAttempt(
  userId: string,
  topicCode: string,
  options?: { totalQuestions?: number }
): Promise<string | null> {
  const totalQuestions = options?.totalQuestions ?? 35;
  const { data, error } = await supabase
    .from('assessment_topic_attempts')
    .insert({
      user_id: userId,
      topic_code: topicCode,
      status: 'in_progress',
      total_questions: totalQuestions,
      correct_first_try: 0,
      medium_wrong: 0,
      hard_wrong: 0,
      skipped: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[assessmentStageOne] createTopicAttempt', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function insertQuestionOutcome(params: {
  attemptId: string;
  questionId: string;
  difficultyBand: AssessmentTier;
  outcome: AssessmentOutcomeKind;
  firstTryCorrect: boolean;
  usedHint: boolean;
  secondTryCorrect: boolean | null;
}): Promise<boolean> {
  const { error } = await supabase.from('assessment_question_outcomes').insert({
    attempt_id: params.attemptId,
    question_id: params.questionId,
    difficulty_band: params.difficultyBand,
    outcome: params.outcome,
    first_try_correct: params.firstTryCorrect,
    used_hint: params.usedHint,
    second_try_correct: params.secondTryCorrect,
  });

  if (error) {
    console.warn('[assessmentStageOne] insertQuestionOutcome', error.message);
    return false;
  }
  return true;
}

export async function completeTopicAttempt(params: {
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
    .from('assessment_topic_attempts')
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
    console.warn('[assessmentStageOne] completeTopicAttempt', error.message);
    return false;
  }
  return true;
}

/** Topics that have at least one completed attempt (any retake counts). */
export async function fetchCompletedAssessmentTopicCodes(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('assessment_topic_attempts')
    .select('topic_code')
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (error || !data) return [];
  const set = new Set<string>();
  for (const row of data as { topic_code?: string }[]) {
    if (row.topic_code) set.add(row.topic_code);
  }
  return [...set];
}
