import { LEVEL_SLUGS, type LevelBandSlug } from '@/app/constants/levelBands';

/**
 * Spread `total` slots across bands in proportion to positive weights (weak bands get more slots).
 */
export function allocateWeightedQuotas(
  total: number,
  weights: Map<LevelBandSlug, number>
): Map<LevelBandSlug, number> {
  const n = Math.max(0, Math.floor(total));
  const out = new Map<LevelBandSlug, number>();
  if (n === 0) {
    for (const b of LEVEL_SLUGS) out.set(b, 0);
    return out;
  }
  const entries = LEVEL_SLUGS.map((b) => ({
    b,
    w: Math.max(0.05, weights.get(b) ?? 1),
  }));
  const sumW = entries.reduce((s, e) => s + e.w, 0);
  const raw = entries.map(({ b, w }) => ({ b, q: (w / sumW) * n }));
  let allocated = 0;
  const floors = raw.map(({ b, q }) => {
    const f = Math.floor(q);
    allocated += f;
    return { b, f, frac: q - f };
  });
  const rem = n - allocated;
  floors.sort((a, b) => b.frac - a.frac);
  for (const x of floors) out.set(x.b, x.f);
  for (let i = 0; i < rem; i++) {
    const b = floors[i % floors.length].b;
    out.set(b, (out.get(b) ?? 0) + 1);
  }
  return out;
}

/**
 * Spread `total` picks across six bands as evenly as possible (e.g. 5 → 1 each for five bands, 0 for one;
 * 25 → four bands at 4 and two at 5, etc.).
 */
export function allocateBandQuotas(total: number): Map<LevelBandSlug, number> {
  const map = new Map<LevelBandSlug, number>();
  const n = Math.max(0, Math.floor(total));
  if (n === 0) {
    for (const b of LEVEL_SLUGS) map.set(b, 0);
    return map;
  }
  const B = LEVEL_SLUGS.length;
  const base = Math.floor(n / B);
  let rem = n % B;
  for (const b of LEVEL_SLUGS) {
    let c = base;
    if (rem > 0) {
      c++;
      rem--;
    }
    map.set(b, c);
  }
  return map;
}
