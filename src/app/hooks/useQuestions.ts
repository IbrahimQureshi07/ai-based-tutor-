import { useState, useEffect } from 'react';
import { supabase } from '@/app/services/supabase';
import type { Question } from '@/app/data/exam-data';

// New table: Question, A, B, C, D, Correct Answer, Feedback / Explanation
interface SupabaseQuestionRow {
  id: string;
  Question: string;
  A: string;
  B: string;
  C: string;
  D: string;
  'Correct Answer': string;
  'Feedback / Explanation': string | null;
  subject?: string | null;
  /** Optional column — add via Backend/sql/add_questions_difficulty_column.sql if missing. */
  difficulty?: string | null;
}

function parseCorrectAnswerIndex(val: string | null | undefined): number {
  if (!val || typeof val !== 'string') return 0;
  const letter = val.trim().charAt(0).toUpperCase();
  const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  return map[letter] ?? 0;
}

/** Returns true only if all 4 options are non-empty strings. */
function isCompleteRow(row: SupabaseQuestionRow): boolean {
  const opts = [row.A, row.B, row.C, row.D];
  return (
    Boolean(row.Question && String(row.Question).trim()) &&
    opts.every((o) => typeof o === 'string' && o.trim().length > 0)
  );
}

function parseDifficultyFromBank(raw: string | null | undefined): 'easy' | 'medium' | 'hard' | undefined {
  if (raw == null || typeof raw !== 'string') return undefined;
  const t = raw.trim().toLowerCase();
  if (t === 'easy' || t === 'e') return 'easy';
  if (t === 'hard' || t === 'h') return 'hard';
  if (t === 'medium' || t === 'med' || t === 'm') return 'medium';
  return undefined;
}

function mapRowToQuestion(row: SupabaseQuestionRow): Question {
  const sub = (row.subject && String(row.subject).trim()) || 'General';
  const bankDifficulty = parseDifficultyFromBank(row.difficulty ?? undefined);
  const q: Question = {
    id: row.id,
    question: row.Question,
    options: [row.A, row.B, row.C, row.D],
    correctAnswer: parseCorrectAnswerIndex(row['Correct Answer']),
    explanation: row['Feedback / Explanation'] || '',
    whyWrong: {},
    subject: sub,
    category: sub,
  };
  if (bankDifficulty !== undefined) q.difficulty = bankDifficulty;
  return q;
}

export function useQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchQuestions() {
      try {
        setLoading(true);
        setError(null);
        // PostgREST default max ~1000 rows per request. Without paging, subjects added
        // later (e.g. A6, B5) never reach the client when total rows exceed that cap.
        const pageSize = 1000;
        const rows: SupabaseQuestionRow[] = [];
        let from = 0;
        // After `add_questions_difficulty_column.sql`, add `difficulty` to this select to map legacy easy/hard from the bank.
        for (;;) {
          const { data, error: fetchError } = await supabase
            .from('questions')
            .select('id, "Question", "A", "B", "C", "D", "Correct Answer", "Feedback / Explanation", subject')
            .order('created_at', { ascending: true })
            .range(from, from + pageSize - 1);

          if (cancelled) return;

          if (fetchError) {
            setError(fetchError.message);
            setQuestions([]);
            return;
          }

          const chunk = data || [];
          rows.push(...(chunk as SupabaseQuestionRow[]));
          if (chunk.length < pageSize) break;
          from += pageSize;
        }

        const mapped = rows.filter(isCompleteRow).map(mapRowToQuestion);
        setQuestions(mapped);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load questions');
          setQuestions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQuestions();
    return () => { cancelled = true; };
  }, []);

  return { questions, loading, error };
}
