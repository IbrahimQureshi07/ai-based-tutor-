/**
 * Stage 2.5 — Build unique mistake question IDs from Stage 1 + Stage 2 outcome history.
 * Rule: if total hard_wrong *rows* (not %) > threshold → only questions that ever had hard_wrong;
 * else include medium_wrong + hard_wrong. Priority when ordering: hard before medium.
 */

import { supabase } from '@/app/services/supabase';
import {
  MISTAKES_TEST_HARD_WRONG_ROW_THRESHOLD,
  MISTAKES_TEST_MISTAKE_SLOTS_TARGET,
} from '@/app/utils/mistakesTestConstants';

function shuffleInPlace<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type OutcomeRow = { question_id: string; outcome: string };

async function fetchAssessmentMistakeRows(attemptIds: string[]): Promise<OutcomeRow[]> {
  if (attemptIds.length === 0) return [];
  const out: OutcomeRow[] = [];
  const BATCH = 100;
  for (let i = 0; i < attemptIds.length; i += BATCH) {
    const chunk = attemptIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('assessment_question_outcomes')
      .select('question_id, outcome')
      .in('attempt_id', chunk);
    if (error) {
      console.warn('[mistakesTestAggregation] assessment outcomes', error.message);
      continue;
    }
    for (const r of data || []) {
      const o = (r as { question_id: string; outcome: string }).outcome;
      if (o === 'medium_wrong' || o === 'hard_wrong') {
        out.push({ question_id: String((r as { question_id: string }).question_id), outcome: o });
      }
    }
  }
  return out;
}

async function fetchPrepMistakeRows(attemptIds: string[]): Promise<OutcomeRow[]> {
  if (attemptIds.length === 0) return [];
  const out: OutcomeRow[] = [];
  const BATCH = 100;
  for (let i = 0; i < attemptIds.length; i += BATCH) {
    const chunk = attemptIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('practice_preparation_question_outcomes')
      .select('question_id, outcome')
      .in('attempt_id', chunk);
    if (error) {
      console.warn('[mistakesTestAggregation] prep outcomes', error.message);
      continue;
    }
    for (const r of data || []) {
      const o = (r as { question_id: string; outcome: string }).outcome;
      if (o === 'medium_wrong' || o === 'hard_wrong') {
        out.push({ question_id: String((r as { question_id: string }).question_id), outcome: o });
      }
    }
  }
  return out;
}

export type MistakePoolBuild = {
  totalHardWrongRows: number;
  hardOnlyRule: boolean;
  /** Unique bank question IDs, hard-priority then medium, max MISTAKES_TEST_MISTAKE_SLOTS_TARGET */
  mistakeQuestionIds: string[];
};

export async function buildMistakeQuestionPool(userId: string): Promise<MistakePoolBuild> {
  const { data: s1Attempts, error: e1 } = await supabase
    .from('assessment_topic_attempts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'completed');

  const { data: s2Attempts, error: e2 } = await supabase
    .from('practice_preparation_attempts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (e1) console.warn('[mistakesTestAggregation] s1 attempts', e1.message);
  if (e2) console.warn('[mistakesTestAggregation] s2 attempts', e2.message);

  const s1Ids = (s1Attempts as { id: string }[] | null)?.map((r) => r.id) ?? [];
  const s2Ids = (s2Attempts as { id: string }[] | null)?.map((r) => r.id) ?? [];

  const s1Out = await fetchAssessmentMistakeRows(s1Ids);
  const s2Out = await fetchPrepMistakeRows(s2Ids);

  const allRows = [...s1Out, ...s2Out];
  let totalHardWrongRows = 0;
  const byQ = new Map<string, { hasHard: boolean; hasMedium: boolean }>();

  for (const row of allRows) {
    const qid = String(row.question_id).trim();
    if (!qid) continue;
    if (row.outcome === 'hard_wrong') totalHardWrongRows += 1;
    const cur = byQ.get(qid) ?? { hasHard: false, hasMedium: false };
    if (row.outcome === 'hard_wrong') cur.hasHard = true;
    if (row.outcome === 'medium_wrong') cur.hasMedium = true;
    byQ.set(qid, cur);
  }

  const hardOnlyRule = totalHardWrongRows > MISTAKES_TEST_HARD_WRONG_ROW_THRESHOLD;

  const eligible: string[] = [];
  for (const [qid, v] of byQ) {
    if (hardOnlyRule) {
      if (v.hasHard) eligible.push(qid);
    } else if (v.hasHard || v.hasMedium) {
      eligible.push(qid);
    }
  }

  const withHard: string[] = [];
  const mediumOnly: string[] = [];
  for (const qid of eligible) {
    const v = byQ.get(qid)!;
    if (v.hasHard) withHard.push(qid);
    else mediumOnly.push(qid);
  }

  shuffleInPlace(withHard);
  shuffleInPlace(mediumOnly);
  const ordered = [...withHard, ...mediumOnly];
  const seen = new Set<string>();
  const uniqueOrdered: string[] = [];
  for (const id of ordered) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniqueOrdered.push(id);
    if (uniqueOrdered.length >= MISTAKES_TEST_MISTAKE_SLOTS_TARGET) break;
  }

  return {
    totalHardWrongRows,
    hardOnlyRule,
    mistakeQuestionIds: uniqueOrdered,
  };
}

export async function userHasCompletedStageTwoPreparation(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('practice_preparation_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (error) return false;
  return (count ?? 0) > 0;
}
