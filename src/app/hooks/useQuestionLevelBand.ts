import { useState, useEffect } from 'react';
import type { Question } from '@/app/data/exam-data';
import {
  LEVEL_BAND_LABELS,
  LEVEL_BAND_PILL_CLASSES,
  type LevelBandSlug,
  fallbackBandFromLegacyDifficulty,
} from '@/app/constants/levelBands';
import { getOrClassifyLevelBand } from '@/app/services/questionLevels';

export function useQuestionLevelBand(question: Question | null | undefined) {
  const [slug, setSlug] = useState<LevelBandSlug | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!question) {
      setSlug(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSlug(null);
    getOrClassifyLevelBand(question)
      .then((b) => {
        if (!cancelled) setSlug(b);
      })
      .catch(() => {
        if (!cancelled) setSlug(fallbackBandFromLegacyDifficulty(question.difficulty));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [question?.id]);

  return {
    slug,
    label: slug ? LEVEL_BAND_LABELS[slug] : '…',
    loading,
    pillClass: slug ? LEVEL_BAND_PILL_CLASSES[slug] : 'bg-muted text-muted-foreground',
  };
}
