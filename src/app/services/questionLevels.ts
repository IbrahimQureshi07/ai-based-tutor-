/**
 * Resolve GPT level band per question: Supabase question_levels → localStorage → OpenAI classify.
 * Ephemeral IDs (similar-*, assessment-*) use in-memory session cache only.
 */

import type { Question } from '@/app/data/exam-data';
import {
  type LevelBandSlug,
  normalizeLevelBandSlug,
  fallbackBandFromLegacyDifficulty,
  isEphemeralQuestionId,
} from '@/app/constants/levelBands';
import { classifyQuestionLevelBand } from '@/app/services/aiService';
import { supabase } from '@/app/services/supabase';

const LS_PREFIX = 'qLevel:v1:';

const ephemeralBandCache = new Map<string, LevelBandSlug>();

function readLocal(questionId: string): LevelBandSlug | null {
  try {
    const v = localStorage.getItem(LS_PREFIX + questionId);
    if (!v) return null;
    return normalizeLevelBandSlug(v);
  } catch {
    return null;
  }
}

function writeLocal(questionId: string, band: LevelBandSlug): void {
  try {
    localStorage.setItem(LS_PREFIX + questionId, band);
  } catch {
    /* ignore quota */
  }
}

const LEVEL_BATCH = 200;

/**
 * Load cached bands for many question ids (for balanced queue building).
 */
export async function fetchLevelsByQuestionIds(ids: string[]): Promise<Map<string, LevelBandSlug>> {
  const out = new Map<string, LevelBandSlug>();
  const clean = [...new Set(ids)].filter((id) => id && !isEphemeralQuestionId(id));
  for (let i = 0; i < clean.length; i += LEVEL_BATCH) {
    const chunk = clean.slice(i, i + LEVEL_BATCH);
    const { data, error } = await supabase
      .from('question_levels')
      .select('question_id, level_band')
      .in('question_id', chunk);
    if (error) continue;
    for (const row of data ?? []) {
      const id = (row as { question_id?: string; level_band?: string }).question_id;
      const lb = (row as { question_id?: string; level_band?: string }).level_band;
      if (id && lb) out.set(id, normalizeLevelBandSlug(lb));
    }
  }
  return out;
}

async function fetchDbLevel(questionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('question_levels')
    .select('level_band')
    .eq('question_id', questionId)
    .maybeSingle();

  if (error || !data?.level_band) return null;
  return data.level_band;
}

async function persistDbLevel(questionId: string, band: LevelBandSlug): Promise<void> {
  const { error } = await supabase.from('question_levels').upsert(
    {
      question_id: questionId,
      level_band: band,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'question_id' }
  );
  if (error) {
    console.warn('[question_levels] upsert skipped:', error.message);
  }
}

/**
 * Classify and persist levels for bank questions missing from `question_levels` (e.g. batch backfill).
 */
export async function backfillMissingQuestionLevels(
  allQuestions: Question[],
  opts?: { batchSize?: number; maxTotal?: number; onProgress?: (done: number) => void }
): Promise<{ done: number; failed: number }> {
  const batchSize = opts?.batchSize ?? 25;
  const maxTotal = opts?.maxTotal ?? 500;
  const bank = allQuestions.filter((q) => !isEphemeralQuestionId(q.id));
  const levelMap = await fetchLevelsByQuestionIds(bank.map((q) => q.id));
  const missing = bank.filter((q) => !levelMap.has(q.id)).slice(0, maxTotal);
  let done = 0;
  let failed = 0;
  for (let i = 0; i < missing.length; i += batchSize) {
    const chunk = missing.slice(i, i + batchSize);
    for (const q of chunk) {
      try {
        await getOrClassifyLevelBand(q);
        done++;
        opts?.onProgress?.(done);
      } catch {
        failed++;
      }
    }
  }
  return { done, failed };
}

export async function getOrClassifyLevelBand(q: Question): Promise<LevelBandSlug> {
  const ctx = q.category || q.subject || 'General';

  if (isEphemeralQuestionId(q.id)) {
    const hit = ephemeralBandCache.get(q.id);
    if (hit) return hit;
    try {
      const band = await classifyQuestionLevelBand(q.question, q.options, ctx);
      ephemeralBandCache.set(q.id, band);
      return band;
    } catch {
      const fb = fallbackBandFromLegacyDifficulty(q.difficulty);
      ephemeralBandCache.set(q.id, fb);
      return fb;
    }
  }

  const local = readLocal(q.id);
  if (local) return local;

  const fromDb = await fetchDbLevel(q.id);
  if (fromDb) {
    const band = normalizeLevelBandSlug(fromDb);
    writeLocal(q.id, band);
    return band;
  }

  try {
    const band = await classifyQuestionLevelBand(q.question, q.options, ctx);
    await persistDbLevel(q.id, band);
    writeLocal(q.id, band);
    return band;
  } catch {
    const fb = fallbackBandFromLegacyDifficulty(q.difficulty);
    await persistDbLevel(q.id, fb);
    writeLocal(q.id, fb);
    return fb;
  }
}
