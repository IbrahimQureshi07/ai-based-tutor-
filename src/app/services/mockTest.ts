import { supabase } from '@/app/services/supabase';
import type { AssessmentTier } from '@/app/utils/assessmentTier';

export type MockAllocationBucket =
  | 'hard_wrong'
  | 'medium_wrong'
  | 'easy_balanced'
  | 'weak_ai'
  | 'skip_topup'
  | 'fallback';

export async function createMockTestAttempt(params: {
  userId: string;
  totalQuestions: number;
  timeLimitSeconds: number;
  passThresholdPercent?: number;
  criticalFailEnabled?: boolean;
  buildSnapshot?: Record<string, unknown> | null;
  weakReportSnapshot?: Record<string, unknown> | null;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('mock_test_attempts')
    .insert({
      user_id: params.userId,
      status: 'in_progress',
      total_questions: params.totalQuestions,
      time_limit_seconds: params.timeLimitSeconds,
      pass_threshold_percent: params.passThresholdPercent ?? 90,
      critical_fail_enabled: params.criticalFailEnabled ?? true,
      correct_slots_final: 0,
      wrong_slots_final: 0,
      skipped_slots: 0,
      first_try_correct_count: 0,
      retry_used_count: 0,
      retry_correct_count: 0,
      retry_wrong_count: 0,
      build_snapshot: params.buildSnapshot ?? null,
      weak_report_snapshot: params.weakReportSnapshot ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[mockTest] createMockTestAttempt', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function upsertMockTestQuestionOutcome(params: {
  attemptId: string;
  slotIndex: number;
  questionId: string | null;
  topicCode: string | null;
  difficultyBand: AssessmentTier;
  allocationBucket: MockAllocationBucket;
  firstQuestionText: string | null;
  firstSelectedOption: number | null;
  firstTryCorrect: boolean;
  firstSkipped: boolean;
  retryOffered?: boolean;
  retryQuestionId?: string | null;
  retryQuestionText?: string | null;
  retrySelectedOption?: number | null;
  retryCorrect?: boolean | null;
  retrySkipped?: boolean;
  finalCorrect: boolean;
  finalSkipped: boolean;
}): Promise<boolean> {
  const payload = {
    attempt_id: params.attemptId,
    slot_index: params.slotIndex,
    question_id: params.questionId,
    topic_code: params.topicCode,
    difficulty_band: params.difficultyBand,
    allocation_bucket: params.allocationBucket,
    first_question_text: params.firstQuestionText,
    first_selected_option: params.firstSelectedOption,
    first_try_correct: params.firstTryCorrect,
    first_skipped: params.firstSkipped,
    retry_offered: params.retryOffered ?? false,
    retry_question_id: params.retryQuestionId ?? null,
    retry_question_text: params.retryQuestionText ?? null,
    retry_selected_option: params.retrySelectedOption ?? null,
    retry_correct: params.retryCorrect ?? null,
    retry_skipped: params.retrySkipped ?? false,
    final_correct: params.finalCorrect,
    final_skipped: params.finalSkipped,
  };
  const { error } = await supabase
    .from('mock_test_question_outcomes')
    .upsert(payload, { onConflict: 'attempt_id,slot_index' });

  if (error) {
    console.warn('[mockTest] upsertMockTestQuestionOutcome', error.message);
    return false;
  }
  return true;
}

export async function completeMockTestAttempt(params: {
  attemptId: string;
  correctSlotsFinal: number;
  wrongSlotsFinal: number;
  skippedSlots: number;
  firstTryCorrectCount: number;
  retryUsedCount: number;
  retryCorrectCount: number;
  retryWrongCount: number;
  percentFinal: number;
  hasCriticalBand: boolean;
  isPass: boolean;
  topicRollup?: Record<string, unknown> | null;
  resultsSnapshot?: Record<string, unknown> | null;
}): Promise<boolean> {
  const { error } = await supabase
    .from('mock_test_attempts')
    .update({
      status: 'completed',
      correct_slots_final: params.correctSlotsFinal,
      wrong_slots_final: params.wrongSlotsFinal,
      skipped_slots: params.skippedSlots,
      first_try_correct_count: params.firstTryCorrectCount,
      retry_used_count: params.retryUsedCount,
      retry_correct_count: params.retryCorrectCount,
      retry_wrong_count: params.retryWrongCount,
      percent_final: params.percentFinal,
      has_critical_band: params.hasCriticalBand,
      is_pass: params.isPass,
      topic_rollup: params.topicRollup ?? null,
      results_snapshot: params.resultsSnapshot ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', params.attemptId);

  if (error) {
    console.warn('[mockTest] completeMockTestAttempt', error.message);
    return false;
  }
  return true;
}

export async function abandonMockTestAttempt(attemptId: string): Promise<boolean> {
  const { error } = await supabase
    .from('mock_test_attempts')
    .update({
      status: 'abandoned',
      completed_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .eq('status', 'in_progress');

  if (error) {
    console.warn('[mockTest] abandonMockTestAttempt', error.message);
    return false;
  }
  return true;
}

/** Final-exam eligibility gate: user has at least one passed mock attempt. */
export async function userHasPassedMockTest(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('mock_test_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .eq('is_pass', true);

  if (error) return false;
  return (count ?? 0) > 0;
}

