import { LEVEL_SLUGS, normalizeLevelBandSlug, type LevelBandSlug } from '@/app/constants/levelBands';
import { getUserWrongQuestions, type UserWrongQuestionRow } from '@/app/services/userWrongQuestions';

export function aggregateWeaknessFromRows(rows: UserWrongQuestionRow[]): Map<LevelBandSlug, number> {
  const m = new Map<LevelBandSlug, number>();
  for (const b of LEVEL_SLUGS) m.set(b, 0);
  for (const r of rows) {
    if (!r.level_band) continue;
    const b = normalizeLevelBandSlug(r.level_band);
    const ft = r.first_try_wrong_count ?? 0;
    const wc = r.wrong_count ?? 0;
    const add = ft + (ft === 0 && wc > 0 ? Math.min(3, wc) * 0.25 : 0);
    m.set(b, (m.get(b) ?? 0) + add);
  }
  return m;
}

export function bandWeightsFromWeakness(weak: Map<LevelBandSlug, number>): Map<LevelBandSlug, number> {
  const w = new Map<LevelBandSlug, number>();
  for (const b of LEVEL_SLUGS) {
    w.set(b, 1 + (weak.get(b) ?? 0) * 2.5);
  }
  return w;
}

export async function fetchAdaptiveBandWeights(userId: string): Promise<Map<LevelBandSlug, number>> {
  const rows = await getUserWrongQuestions(userId);
  return bandWeightsFromWeakness(aggregateWeaknessFromRows(rows));
}
