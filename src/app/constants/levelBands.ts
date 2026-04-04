/** Canonical level slugs stored in DB / GPT output (snake_case). */
export const LEVEL_SLUGS = [
  'easy',
  'above_easy',
  'medium',
  'above_medium',
  'hard',
  'above_hard',
] as const;

export type LevelBandSlug = (typeof LEVEL_SLUGS)[number];

/** User-facing labels (no "+"). */
export const LEVEL_BAND_LABELS: Record<LevelBandSlug, string> = {
  easy: 'Easy',
  above_easy: 'Above easy',
  medium: 'Medium',
  above_medium: 'Above medium',
  hard: 'Hard',
  above_hard: 'Above hard',
};

export const LEVEL_BAND_PILL_CLASSES: Record<LevelBandSlug, string> = {
  easy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  above_easy: 'bg-teal-500/15 text-teal-800 dark:text-teal-300',
  medium: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  above_medium: 'bg-orange-500/15 text-orange-800 dark:text-orange-300',
  hard: 'bg-rose-500/15 text-rose-800 dark:text-rose-300',
  above_hard: 'bg-destructive/15 text-destructive',
};

export function isLevelBandSlug(s: string): s is LevelBandSlug {
  return (LEVEL_SLUGS as readonly string[]).includes(s);
}

export function normalizeLevelBandSlug(raw: string | null | undefined): LevelBandSlug {
  if (!raw) return 'medium';
  const t = raw.trim().toLowerCase().replace(/\s+/g, '_');
  const aliases: Record<string, LevelBandSlug> = {
    easy: 'easy',
    above_easy: 'above_easy',
    'above easy': 'above_easy',
    easy_above: 'above_easy',
    medium: 'medium',
    above_medium: 'above_medium',
    'above medium': 'above_medium',
    medium_above: 'above_medium',
    hard: 'hard',
    above_hard: 'above_hard',
    'above hard': 'above_hard',
    hard_above: 'above_hard',
  };
  if (aliases[t]) return aliases[t];
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

export function isEphemeralQuestionId(id: string): boolean {
  return (
    id.startsWith('similar-') ||
    id.startsWith('similar-weak-') ||
    id.startsWith('assessment-')
  );
}
