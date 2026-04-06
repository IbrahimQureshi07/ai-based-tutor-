import type { LevelBandSlug } from '@/app/constants/levelBands';
import { fallbackBandFromLegacyDifficulty } from '@/app/constants/levelBands';

export type AssessmentTier = 'easy' | 'medium' | 'hard';

/** Map 6 DB bands → 3 assessment tiers. */
export function levelBandToAssessmentTier(band: LevelBandSlug): AssessmentTier {
  if (band === 'easy' || band === 'above_easy') return 'easy';
  if (band === 'medium' || band === 'above_medium') return 'medium';
  return 'hard';
}

export function tierFromQuestion(
  levelMap: Map<string, LevelBandSlug>,
  q: { id: string; difficulty: string }
): AssessmentTier {
  const fromDb = levelMap.get(q.id);
  const band = fromDb ?? fallbackBandFromLegacyDifficulty(q.difficulty);
  return levelBandToAssessmentTier(band);
}
