/**
 * Stage 2 preparation test: weight score from Stage 1 medium/hard wrongs + 110-slot allocation.
 */

export const PRACTICE_PREPARATION_TOTAL = 110;

/** topicScore = 2 × hard_wrong + 1 × medium_wrong */
export function topicPrepScore(mediumWrong: number, hardWrong: number): number {
  const m = Math.max(0, Math.floor(mediumWrong));
  const h = Math.max(0, Math.floor(hardWrong));
  return 2 * h + m;
}

/**
 * Distribute `totalSlots` across topics proportional to positive scores.
 * Uses largest remainder so quotas sum exactly to `totalSlots`.
 * Topics with score 0 get quota 0.
 */
export function allocateQuotasLargestRemainder(
  scoresByTopic: Record<string, number>,
  totalSlots: number
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(scoresByTopic)) out[k] = 0;

  const positive = Object.entries(scoresByTopic).filter(([, s]) => s > 0);
  const sum = positive.reduce((a, [, s]) => a + s, 0);

  if (totalSlots <= 0 || sum === 0) return out;

  const parts = positive.map(([topic, s]) => {
    const exact = (totalSlots * s) / sum;
    const floor = Math.floor(exact);
    const remainder = exact - floor;
    return { topic, floor, remainder };
  });

  const allocated = parts.reduce((a, p) => a + p.floor, 0);
  let leftover = totalSlots - allocated;

  parts.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < parts.length; i++) {
    const extra = i < leftover ? 1 : 0;
    out[parts[i].topic] = parts[i].floor + extra;
  }

  return out;
}
