/**
 * Persist practice test state so user can reload or switch tab and continue.
 * Uses sessionStorage (per-tab; survives refresh, cleared when tab closes).
 */

const KEY = 'exam_tutor_practice_state';
const ASSESSMENT_KEY = 'exam_tutor_assessment_state';
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface SavedPracticeState {
  screen: 'practice';
  questionIds: string[];
  currentIndex: number;
  savedAt: number;
}

export interface SavedAssessmentState {
  screen: 'assessment';
  questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation: string; whyWrong: Record<number, string>; subject: string; category: string; difficulty: string }>;
  currentIndex: number;
  savedAt: number;
}

export function savePracticeState(questionIds: string[], currentIndex: number): void {
  try {
    const state: SavedPracticeState = {
      screen: 'practice',
      questionIds,
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
    const state = JSON.parse(raw) as SavedPracticeState;
    if (state.screen !== 'practice' || !Array.isArray(state.questionIds) || typeof state.currentIndex !== 'number') return null;
    if (Date.now() - (state.savedAt || 0) > MAX_AGE_MS) return null;
    return state;
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
