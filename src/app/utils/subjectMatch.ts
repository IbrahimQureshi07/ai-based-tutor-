import type { Question } from '@/app/data/exam-data';

/** Compare chosen topic card label to question subject/category (trim + case-insensitive). */
export function subjectLabelMatches(q: Question, selected: string): boolean {
  const a = (q.subject || q.category || '').trim().toLowerCase();
  const b = selected.trim().toLowerCase();
  return a === b;
}
