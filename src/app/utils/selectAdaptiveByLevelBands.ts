import type { Question } from '@/app/data/exam-data';
import {
  LEVEL_SLUGS,
  type LevelBandSlug,
  fallbackBandFromLegacyDifficulty,
  isEphemeralQuestionId,
} from '@/app/constants/levelBands';
import { fetchLevelsByQuestionIds } from '@/app/services/questionLevels';
import { fetchAdaptiveBandWeights } from '@/app/services/weaknessByBand';
import { allocateWeightedQuotas } from '@/app/utils/bandQuotas';

function shuffleInPlace<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Order: easy → above_easy → … → above_hard; shuffle only within each band. */
export async function selectQuestionsAdaptiveByBands(
  candidates: Question[],
  targetCount: number,
  userId: string
): Promise<Question[]> {
  const n = Math.max(0, Math.floor(targetCount));
  if (n === 0 || candidates.length === 0) return [];

  const bankOnly = candidates.filter((q) => !isEphemeralQuestionId(q.id));
  if (bankOnly.length === 0) return shuffleInPlace(candidates).slice(0, n);

  const effectiveN = Math.min(n, bankOnly.length);
  const levelMap = await fetchLevelsByQuestionIds(bankOnly.map((q) => q.id));
  const weights = await fetchAdaptiveBandWeights(userId);

  const byBand = new Map<LevelBandSlug, Question[]>();
  for (const b of LEVEL_SLUGS) byBand.set(b, []);

  for (const q of bankOnly) {
    const fromDb = levelMap.get(q.id);
    const band = fromDb ?? fallbackBandFromLegacyDifficulty(q.difficulty);
    byBand.get(band)!.push(q);
  }

  for (const b of LEVEL_SLUGS) {
    byBand.set(b, shuffleInPlace(byBand.get(b)!));
  }

  const quotas = allocateWeightedQuotas(effectiveN, weights);
  const picked: Question[] = [];
  const used = new Set<string>();

  for (const band of LEVEL_SLUGS) {
    const need = quotas.get(band) ?? 0;
    const pool = byBand.get(band)!;
    let taken = 0;
    for (const q of pool) {
      if (taken >= need) break;
      if (used.has(q.id)) continue;
      picked.push(q);
      used.add(q.id);
      taken++;
    }
  }

  if (picked.length < n) {
    for (const band of LEVEL_SLUGS) {
      if (picked.length >= n) break;
      for (const q of byBand.get(band)!) {
        if (picked.length >= n) break;
        if (used.has(q.id)) continue;
        picked.push(q);
        used.add(q.id);
      }
    }
  }

  return picked;
}
