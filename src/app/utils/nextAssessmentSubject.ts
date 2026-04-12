import { SUBJECTS, type SubjectMeta } from '@/app/data/subjects';

/** Next catalog topic after `topicKey` in Stage 1 order (A1→…→B6), or null if last / unknown. */
export function nextAssessmentSubjectAfter(topicKey: string): SubjectMeta | null {
  const i = SUBJECTS.findIndex((s) => s.key === topicKey);
  if (i < 0 || i >= SUBJECTS.length - 1) return null;
  return SUBJECTS[i + 1] ?? null;
}
