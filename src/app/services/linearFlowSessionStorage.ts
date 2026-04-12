import type { Question } from '@/app/data/exam-data';
import type { StageOneTopicRollupEntry } from '@/app/services/practiceStageTwoAggregation';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import type { MistakesTestQueueSource } from '@/app/utils/buildMistakesTestQueue';

const K1 = 'exam_flow_stage1_v1';
const K2 = 'exam_flow_stage2_v1';
const KM = 'exam_flow_mistakes_v1';

export type PerTopicLinearSt = { cf: number; mw: number; hw: number; sk: number };

export type TierStatPersisted = Record<AssessmentTier, { correct: number; total: number }>;

type FlowBase = {
  v: 1;
  userId: string;
  savedAt: number;
  banks: Question[];
  tiers: AssessmentTier[];
  currentIndex: number;
  stats: { cf: number; mw: number; hw: number; sk: number };
  tierStat: TierStatPersisted;
  attemptId: string | null;
  adminCapApplied: boolean;
  shortfallNotice: number | null;
  similarQ: Question | null;
  similarShowReveal: boolean;
  showResult: boolean;
  isCorrect: boolean;
  selectedOption: number | null;
  bankHint: { text: string } | null;
  /** Last graded wrong option (bank + similar); optional for older saved sessions. */
  wrongRevealIndex?: number | null;
  /** When true with showResult, highlight the correct option (hidden on first wrong until hint + 2nd submit). */
  showCorrectReveal?: boolean;
};

export type StageOneFlowSnapshotV1 = FlowBase & {
  kind: 'stage1';
  topicKey: string;
  sessionTotal: number;
};

export type StageTwoFlowSnapshotV1 = FlowBase & {
  kind: 'stage2';
  stageOneRollup: Record<string, StageOneTopicRollupEntry> | null;
  perTopicStageTwo: Record<string, PerTopicLinearSt>;
};

export type MistakesFlowSnapshotV1 = FlowBase & {
  kind: 'mistakes';
  sources: MistakesTestQueueSource[];
  unresolvedHardIds: string[];
  perTopic: Record<string, PerTopicLinearSt>;
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* quota */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadStageOneSnapshot(): StageOneFlowSnapshotV1 | null {
  const p = read<StageOneFlowSnapshotV1>(K1);
  if (!p || p.v !== 1 || p.kind !== 'stage1' || typeof p.userId !== 'string' || !Array.isArray(p.banks)) {
    return null;
  }
  return p;
}

export function saveStageOneSnapshot(s: StageOneFlowSnapshotV1): void {
  write(K1, s);
}

export function clearStageOneSnapshot(): void {
  remove(K1);
}

export function loadStageTwoSnapshot(): StageTwoFlowSnapshotV1 | null {
  const p = read<StageTwoFlowSnapshotV1>(K2);
  if (!p || p.v !== 1 || p.kind !== 'stage2' || typeof p.userId !== 'string' || !Array.isArray(p.banks)) {
    return null;
  }
  return p;
}

export function saveStageTwoSnapshot(s: StageTwoFlowSnapshotV1): void {
  write(K2, s);
}

export function clearStageTwoSnapshot(): void {
  remove(K2);
}

export function loadMistakesSnapshot(): MistakesFlowSnapshotV1 | null {
  const p = read<MistakesFlowSnapshotV1>(KM);
  if (!p || p.v !== 1 || p.kind !== 'mistakes' || typeof p.userId !== 'string' || !Array.isArray(p.banks)) {
    return null;
  }
  return p;
}

export function saveMistakesSnapshot(s: MistakesFlowSnapshotV1): void {
  write(KM, s);
}

export function clearMistakesSnapshot(): void {
  remove(KM);
}

export function clearAllLinearFlowSnapshots(): void {
  clearStageOneSnapshot();
  clearStageTwoSnapshot();
  clearMistakesSnapshot();
}
