import type { Question } from '@/app/data/exam-data';
import { useQuestionLevelBand } from '@/app/hooks/useQuestionLevelBand';

export function LevelBandPill({ question }: { question: Question }) {
  const { label, loading, pillClass } = useQuestionLevelBand(question);
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${pillClass}`}>
      {loading ? 'Level…' : label}
    </span>
  );
}
