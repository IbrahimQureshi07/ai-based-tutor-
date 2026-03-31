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

function mapRowToQuestion(row: SupabaseQuestionRow): Question {
  const sub = (row.subject && String(row.subject).trim()) || 'General';
  return {
    id: row.id,
    question: row.Question,
    options: [row.A, row.B, row.C, row.D],
    correctAnswer: parseCorrectAnswerIndex(row['Correct Answer']),
    explanation: row['Feedback / Explanation'] || '',
    whyWrong: {},
    subject: sub,
    category: sub,
    difficulty: 'medium',
  };
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
        const { data, error: fetchError } = await supabase
          .from('questions')
          .select('id, "Question", "A", "B", "C", "D", "Correct Answer", "Feedback / Explanation", subject')
          .order('created_at', { ascending: true });

        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
          setQuestions([]);
          return;
        }

        const mapped = (data || [])
          .filter(isCompleteRow)
          .map(mapRowToQuestion);
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
