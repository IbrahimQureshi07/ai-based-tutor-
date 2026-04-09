import type { Question } from '@/app/data/exam-data';
import type { MockAllocationBucket } from '@/app/services/mockTest';

const KEY = 'exam_mock_session_v1';

/** Mirrors MockTest `SlotResult` — kept here for persistence only. */
export type MockSlotResultPersisted = {
  firstSelected: number | null;
  firstTryCorrect: boolean;
  firstSkipped: boolean;
  retryOffered: boolean;
  retryQuestionId: string | null;
  retryQuestionText: string | null;
  retrySelected: number | null;
  retryCorrect: boolean | null;
  retrySkipped: boolean;
  finalCorrect: boolean;
  finalSkipped: boolean;
};

export type MockSessionSnapshotV1 = {
  v: 1;
  userId: string;
  savedAt: number;
  selectedMockSubject: string | null;
  testQuestions: Question[];
  allocationBuckets: MockAllocationBucket[];
  mockPlan: { total: number; adminShort: boolean };
  mockSlotTarget: number;
  currentQuestionIndex: number;
  timeLeft: number;
  testStarted: boolean;
  testCompleted: boolean;
  slotResults: Record<string, MockSlotResultPersisted>;
  uncommittedFirstTry: [number, number][];
  flagged: number[];
  inRetry: boolean;
  retryQuestion: Question | null;
  firstWrongSelection: number | null;
  attemptId: string | null;
  selectedOption: number | null;
};

function parseSlotResults(raw: Record<string, MockSlotResultPersisted>): Record<number, MockSlotResultPersisted> {
  const out: Record<number, MockSlotResultPersisted> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(k);
    if (Number.isFinite(n)) out[n] = v;
  }
  return out;
}

export function loadMockSession(): MockSessionSnapshotV1 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as MockSessionSnapshotV1;
    if (p?.v !== 1 || typeof p.userId !== 'string' || !Array.isArray(p.testQuestions)) return null;
    if (p.testCompleted) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveMockSession(snap: MockSessionSnapshotV1): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    /* quota / private mode */
  }
}

export function clearMockSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function slotResultsFromSnapshot(
  raw: Record<string, MockSlotResultPersisted> | undefined
): Record<number, MockSlotResultPersisted> {
  if (!raw || typeof raw !== 'object') return {};
  return parseSlotResults(raw);
}
