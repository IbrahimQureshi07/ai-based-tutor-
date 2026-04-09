import { FINAL_EXAM_PASS_THRESHOLD_PERCENT } from '@/app/constants/finalExam';
import { supabase } from '@/app/services/supabase';
import type { AssessmentTier } from '@/app/utils/assessmentTier';

/** Matches `final_exam_question_outcomes.allocation_bucket` (Backend/sql/final_exam.sql). */
export type FinalExamAllocationBucket =
  | 'fresh_hard'
  | 'easy_balanced'
  | 'mock_wrong'
  | 'weak_weighted'
  | 'fallback';

/** Matches `final_exam_attempts.grade` check constraint. */
export type FinalExamGrade = 'A+' | 'A' | 'B' | 'Fail';

const DEFAULT_PASS_THRESHOLD = FINAL_EXAM_PASS_THRESHOLD_PERCENT;

/**
 * Grade bands: ≥90 A+ · 80–89 A · 75–79 B · &lt;75 Fail.
 * Pass (is_pass) uses `passThreshold` (default 75): percent ≥ threshold.
 */
export function finalExamGradeFromPercent(percent: number): FinalExamGrade {
  const p = Math.round(percent);
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 75) return 'B';
  return 'Fail';
}

export function finalExamIsPass(percent: number, passThresholdPercent: number = DEFAULT_PASS_THRESHOLD): boolean {
  return Math.round(percent) >= passThresholdPercent;
}

export async function createFinalExamAttempt(params: {
  userId: string;
  totalQuestions: number;
  timeLimitSeconds: number;
  passThresholdPercent?: number;
  buildSnapshot?: Record<string, unknown> | null;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('final_exam_attempts')
    .insert({
      user_id: params.userId,
      status: 'in_progress',
      total_questions: params.totalQuestions,
      time_limit_seconds: params.timeLimitSeconds,
      pass_threshold_percent: params.passThresholdPercent ?? DEFAULT_PASS_THRESHOLD,
      correct_count: 0,
      wrong_count: 0,
      unanswered_count: 0,
      build_snapshot: params.buildSnapshot ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[finalExam] createFinalExamAttempt', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function upsertFinalExamQuestionOutcome(params: {
  attemptId: string;
  slotIndex: number;
  questionId: string | null;
  topicCode: string | null;
  difficultyBand: AssessmentTier;
  allocationBucket: FinalExamAllocationBucket;
  firstQuestionText: string | null;
  selectedOption: number | null;
  isCorrect: boolean;
}): Promise<boolean> {
  const payload = {
    attempt_id: params.attemptId,
    slot_index: params.slotIndex,
    question_id: params.questionId,
    topic_code: params.topicCode,
    difficulty_band: params.difficultyBand,
    allocation_bucket: params.allocationBucket,
    first_question_text: params.firstQuestionText,
    selected_option: params.selectedOption,
    is_correct: params.isCorrect,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('final_exam_question_outcomes')
    .upsert(payload, { onConflict: 'attempt_id,slot_index' });

  if (error) {
    console.warn('[finalExam] upsertFinalExamQuestionOutcome', error.message);
    return false;
  }
  return true;
}

export async function completeFinalExamAttempt(params: {
  attemptId: string;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  percentFinal: number;
  passThresholdPercent?: number;
  /** Optional override; otherwise derived from percent + threshold. */
  grade?: FinalExamGrade;
  isPass?: boolean;
  topicRollup?: Record<string, unknown> | null;
  resultsSnapshot?: Record<string, unknown> | null;
}): Promise<boolean> {
  const threshold = params.passThresholdPercent ?? DEFAULT_PASS_THRESHOLD;
  const pct = Math.round(params.percentFinal);
  const grade = params.grade ?? finalExamGradeFromPercent(pct);
  const isPass = params.isPass ?? finalExamIsPass(pct, threshold);

  const { error } = await supabase
    .from('final_exam_attempts')
    .update({
      status: 'completed',
      correct_count: params.correctCount,
      wrong_count: params.wrongCount,
      unanswered_count: params.unansweredCount,
      percent_final: pct,
      grade,
      is_pass: isPass,
      topic_rollup: params.topicRollup ?? null,
      results_snapshot: params.resultsSnapshot ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', params.attemptId);

  if (error) {
    console.warn('[finalExam] completeFinalExamAttempt', error.message);
    return false;
  }
  return true;
}

export async function abandonFinalExamAttempt(attemptId: string): Promise<boolean> {
  const { error } = await supabase
    .from('final_exam_attempts')
    .update({
      status: 'abandoned',
      completed_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .eq('status', 'in_progress');

  if (error) {
    console.warn('[finalExam] abandonFinalExamAttempt', error.message);
    return false;
  }
  return true;
}

/** True if the user has at least one completed final attempt with is_pass. */
export async function userHasPassedFinalExam(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('final_exam_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .eq('is_pass', true);

  if (error) return false;
  return (count ?? 0) > 0;
}
