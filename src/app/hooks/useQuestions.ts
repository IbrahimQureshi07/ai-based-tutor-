import { useState, useEffect } from 'react';
import { supabase } from '@/app/services/supabase';
import type { Question } from '@/app/data/exam-data';

interface SupabaseQuestionRow {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: number;
  subject: string | null;
  topic: string | null;
  explanation: string | null;
}

function mapRowToQuestion(row: SupabaseQuestionRow): Question {
  return {
    id: row.id,
    question: row.question,
    options: [row.option_a, row.option_b, row.option_c, row.option_d],
    correctAnswer: (row.correct_option || 1) - 1,
    explanation: row.explanation || '',
    whyWrong: {},
    subject: row.subject || 'General',
    category: row.subject || row.topic || 'General',
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
          .select('id, question, option_a, option_b, option_c, option_d, correct_option, subject, topic, explanation')
          .order('created_at', { ascending: true });

        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
          setQuestions([]);
          return;
        }

        const mapped = (data || []).map(mapRowToQuestion);
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
