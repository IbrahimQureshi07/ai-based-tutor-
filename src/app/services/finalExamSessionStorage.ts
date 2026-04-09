import type { Question } from '@/app/data/exam-data';
import type { FinalExamQueueSlot } from '@/app/utils/buildFinalExamQueue';

const KEY = 'exam_final_session_v1';

export type FinalExamSessionSnapshotV1 = {
  v: 1;
  userId: string;
  savedAt: number;
  testQuestions: Question[];
  queueSlots: FinalExamQueueSlot[];
  examPlan: { total: number; adminShort: boolean; bucketCounts: Record<string, number> };
  examSlotTarget: number;
  currentQuestionIndex: number;
  timeLeft: number;
  testStarted: boolean;
  testCompleted: boolean;
  answers: [number, number][];
  attemptId: string | null;
  selectedOption: number | null;
};

export function loadFinalExamSession(): FinalExamSessionSnapshotV1 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as FinalExamSessionSnapshotV1;
    if (p?.v !== 1 || typeof p.userId !== 'string' || !Array.isArray(p.testQuestions)) return null;
    if (p.testCompleted) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveFinalExamSession(snap: FinalExamSessionSnapshotV1): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    /* quota */
  }
}

export function clearFinalExamSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
