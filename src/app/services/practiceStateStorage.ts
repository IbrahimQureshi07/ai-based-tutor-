/**
 * Persist practice test state so user can reload or switch tab and continue.
 * Uses sessionStorage (per-tab; survives refresh, cleared when tab closes).
 */

const KEY = 'exam_tutor_practice_state';
const ASSESSMENT_KEY = 'exam_tutor_assessment_state';
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Same shape as one question in the queue (DB or GPT-generated) for persistence */
export type SavedQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  whyWrong: Record<number, string>;
  subject: string;
  category: string;
  difficulty: string;
};

export interface SavedPracticeState {
  screen: 'practice';
  /** Full question list so GPT-generated questions survive tab switch */
  questions: SavedQuestion[];
  /** Legacy: only present when loading old saved state that had questionIds only */
  questionIds?: string[];
  currentIndex: number;
  savedAt: number;
}

export interface SavedAssessmentState {
  screen: 'assessment';
  questions: SavedQuestion[];
  currentIndex: number;
  savedAt: number;
}

export function savePracticeState(questions: SavedQuestion[], currentIndex: number): void {
  try {
    const state: SavedPracticeState = {
      screen: 'practice',
      questions,
      currentIndex,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function loadPracticeState(): SavedPracticeState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as SavedPracticeState & { questionIds?: string[] };
    if (state.screen !== 'practice' || typeof state.currentIndex !== 'number') return null;
    if (Date.now() - (state.savedAt || 0) > MAX_AGE_MS) return null;
    // New format: full questions array (includes GPT questions)
    if (Array.isArray(state.questions) && state.questions.length > 0) return state as SavedPracticeState;
    // Legacy: only questionIds was saved (no GPT in queue when saved)
    if (Array.isArray(state.questionIds) && state.questionIds.length > 0) {
      return { ...state, questions: [], questionIds: state.questionIds } as SavedPracticeState;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPracticeState(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function saveAssessmentState(questions: SavedAssessmentState['questions'], currentIndex: number): void {
  try {
    const state: SavedAssessmentState = {
      screen: 'assessment',
      questions,
      currentIndex,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(ASSESSMENT_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function loadAssessmentState(): SavedAssessmentState | null {
  try {
    const raw = sessionStorage.getItem(ASSESSMENT_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as SavedAssessmentState;
    if (state.screen !== 'assessment' || !Array.isArray(state.questions) || typeof state.currentIndex !== 'number') return null;
    if (Date.now() - (state.savedAt || 0) > MAX_AGE_MS) return null;
    return state;
  } catch {
    return null;
  }
}

export function clearAssessmentState(): void {
  try {
    sessionStorage.removeItem(ASSESSMENT_KEY);
  } catch {
    // ignore
  }
}
