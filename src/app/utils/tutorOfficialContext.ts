import type { Question } from '@/app/data/exam-data';

/** Current on-screen MCQ — highest priority for the tutor. */
export interface TutorActiveMcq {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  subject?: string;
}

const STOP = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one', 'our', 'out', 'day',
  'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did',
  'let', 'put', 'say', 'she', 'too', 'use', 'that', 'this', 'with', 'have', 'from', 'they', 'been', 'into', 'more',
  'than', 'some', 'what', 'when', 'will', 'your', 'about', 'which', 'their', 'there', 'each', 'such', 'these', 'them',
  'then', 'than', 'also', 'only', 'just', 'like', 'make', 'know', 'take', 'come', 'could', 'would', 'should',
]);

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Keyword match over loaded Supabase questions — not embeddings, but gives the model
 * official keys for user messages that overlap course wording.
 */
export function buildOfficialBankSnippets(
  allQuestions: Question[],
  userMessage: string,
  conversationText: string,
  maxItems = 8
): string {
  if (!allQuestions.length) return '';

  const haystack = `${userMessage} ${conversationText}`.toLowerCase();
  const tokens = haystack
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));

  const unique = [...new Set(tokens)];
  if (unique.length === 0) return '';

  const scored = allQuestions
    .map((q) => {
      const blob = `${q.question} ${q.options.join(' ')} ${q.subject || ''} ${q.category || ''}`.toLowerCase();
      let score = 0;
      for (const t of unique) {
        if (blob.includes(t)) score += t.length >= 6 ? 4 : t.length >= 4 ? 2 : 1;
      }
      return { q, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);

  if (scored.length === 0) return '';

  return scored
    .map(({ q }, i) => {
      const opts = q.options.map((o, j) => `${LETTERS[j]}) ${o}`).join(' | ');
      const correct = LETTERS[q.correctAnswer] ?? '?';
      const expl = (q.explanation || '').slice(0, 340);
      const sub = q.subject || q.category || 'General';
      return `### Official item ${i + 1} (${sub})\nQ: ${q.question}\nChoices: ${opts}\nOFFICIAL CORRECT (exam key): ${correct}\nCourse explanation: ${expl}`;
    })
    .join('\n\n');
}
