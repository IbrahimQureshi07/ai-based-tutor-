const KEY = 'exam_tutor_nav_v1';

export type PersistedNavV1 = {
  v: 1;
  screen: string;
  selectedMockSubject: string | null;
  selectedAssessmentTopic: string | null;
  subjectSelectFor: 'mock' | 'assessment';
};

const RESTORABLE_SCREENS = new Set([
  'dashboard',
  'assessment',
  'subjectSelect',
  'mock',
  'final',
  'results',
  'stageTwoPreparation',
  'mistakesTest',
  'teacherInterventions',
]);

export function isRestorableScreen(screen: string): boolean {
  return RESTORABLE_SCREENS.has(screen);
}

export function loadNav(): PersistedNavV1 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedNavV1;
    if (p?.v !== 1 || typeof p.screen !== 'string') return null;
    if (!isRestorableScreen(p.screen)) return null;
    return {
      v: 1,
      screen: p.screen,
      selectedMockSubject: p.selectedMockSubject ?? null,
      selectedAssessmentTopic: p.selectedAssessmentTopic ?? null,
      subjectSelectFor: p.subjectSelectFor === 'mock' ? 'mock' : 'assessment',
    };
  } catch {
    return null;
  }
}

export function saveNav(nav: Omit<PersistedNavV1, 'v'>): void {
  try {
    const payload: PersistedNavV1 = { v: 1, ...nav };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearNav(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
