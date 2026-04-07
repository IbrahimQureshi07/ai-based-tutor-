/** Canonical level slugs stored in DB / GPT output (snake_case). Only three bands. */
export const LEVEL_SLUGS = ['easy', 'medium', 'hard'] as const;

export type LevelBandSlug = (typeof LEVEL_SLUGS)[number];

/** User-facing labels. */
export const LEVEL_BAND_LABELS: Record<LevelBandSlug, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const LEVEL_BAND_PILL_CLASSES: Record<LevelBandSlug, string> = {
  easy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  hard: 'bg-rose-500/15 text-rose-800 dark:text-rose-300',
};

export function isLevelBandSlug(s: string): s is LevelBandSlug {
  return (LEVEL_SLUGS as readonly string[]).includes(s);
}

/**
 * Normalize any raw label (including legacy 6-band rows) to one of easy | medium | hard.
 */
export function normalizeLevelBandSlug(raw: string | null | undefined): LevelBandSlug {
  if (!raw) return 'medium';
  const t = raw.trim().toLowerCase().replace(/\s+/g, '_');

  const legacyToCanonical: Record<string, LevelBandSlug> = {
    easy: 'easy',
    above_easy: 'easy',
    'above easy': 'easy',
    easy_above: 'easy',
    simple: 'easy',
    basic: 'easy',
    beginner: 'easy',
    recall: 'easy',
    straightforward: 'easy',
    trivial: 'easy',

    medium: 'medium',
    above_medium: 'medium',
    'above medium': 'medium',
    medium_above: 'medium',
    moderate: 'medium',
    intermediate: 'medium',
    standard: 'medium',
    typical: 'medium',
    average: 'medium',

    hard: 'hard',
    above_hard: 'hard',
    'above hard': 'hard',
    hard_above: 'hard',
    challenging: 'hard',
    difficult: 'hard',
    tricky: 'hard',
    advanced: 'hard',
    demanding: 'hard',
    expert: 'hard',
  };

  if (legacyToCanonical[t]) return legacyToCanonical[t];
  if (isLevelBandSlug(t)) return t;
  return 'medium';
}

export function fallbackBandFromLegacyDifficulty(
  d: 'easy' | 'medium' | 'hard' | string | undefined
): LevelBandSlug {
  if (d === 'easy') return 'easy';
  if (d === 'hard') return 'hard';
  return 'medium';
}

/**
 * Only easy/hard from a real bank column are treated as authoritative.
 * `medium` / missing / unknown → undefined (do not use as fake “legacy” for GPT fallback).
 */
export function legacyBandIfExplicitEasyOrHard(
  d: 'easy' | 'medium' | 'hard' | string | undefined
): LevelBandSlug | undefined {
  if (d === 'easy') return 'easy';
  if (d === 'hard') return 'hard';
  return undefined;
}

export function isEphemeralQuestionId(id: string): boolean {
  return (
    id.startsWith('similar-') ||
    id.startsWith('similar-weak-') ||
    id.startsWith('assessment-')
  );
}
