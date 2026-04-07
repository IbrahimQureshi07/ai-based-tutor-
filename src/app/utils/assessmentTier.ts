import type { LevelBandSlug } from '@/app/constants/levelBands';
import { fallbackBandFromLegacyDifficulty } from '@/app/constants/levelBands';

export type AssessmentTier = 'easy' | 'medium' | 'hard';

/** Bands are already 3-tier (easy | medium | hard); identity for assessment queue. */
export function levelBandToAssessmentTier(band: LevelBandSlug): AssessmentTier {
  return band;
}

export function tierFromQuestion(
  levelMap: Map<string, LevelBandSlug>,
  q: { id: string; difficulty?: string }
): AssessmentTier {
  const fromDb = levelMap.get(q.id);
  const band = fromDb ?? fallbackBandFromLegacyDifficulty(q.difficulty);
  return levelBandToAssessmentTier(band);
}
