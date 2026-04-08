import type { Question } from '@/app/data/exam-data';
import {
  type LevelBandSlug,
  fallbackBandFromLegacyDifficulty,
  isEphemeralQuestionId,
  normalizeLevelBandSlug,
} from '@/app/constants/levelBands';
import { fetchLevelsByQuestionIds, getOrClassifyLevelBand } from '@/app/services/questionLevels';

export type SessionAggregate = {
  byDifficulty: Record<string, { correct: number; total: number }>;
  byCategory: Record<string, { correct: number; total: number }>;
  correct: number;
  total: number;
};

/**
 * Build Results charts using three level bands (DB cache + legacy fallback; ephemeral → classify).
 */
export async function aggregateResultsByLevelBand(
  questionsList: Question[],
  getUserAnswer: (index: number) => number | undefined
): Promise<SessionAggregate> {
  const byDifficulty: Record<string, { correct: number; total: number }> = {};
  const byCategory: Record<string, { correct: number; total: number }> = {};
  let correct = 0;
  let total = 0;

  const answered = questionsList
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => getUserAnswer(i) !== undefined);
  const bankIds = answered.map(({ q }) => q.id).filter((id) => !isEphemeralQuestionId(id));
  const levelMap = await fetchLevelsByQuestionIds(bankIds);

  for (const { q: question, i: index } of answered) {
    const userAnswer = getUserAnswer(index)!;
    total++;
    const isCorrect = userAnswer === question.correctAnswer;
    if (isCorrect) correct++;

    let band: LevelBandSlug;
    if (isEphemeralQuestionId(question.id)) {
      band = await getOrClassifyLevelBand(question);
    } else {
      band = normalizeLevelBandSlug(
        levelMap.get(question.id) ?? fallbackBandFromLegacyDifficulty(question.difficulty)
      );
    }

    if (!byDifficulty[band]) byDifficulty[band] = { correct: 0, total: 0 };
    byDifficulty[band].total += 1;
    if (isCorrect) byDifficulty[band].correct += 1;

    const cat = question.category || question.subject || 'General';
    if (!byCategory[cat]) byCategory[cat] = { correct: 0, total: 0 };
    byCategory[cat].total += 1;
    if (isCorrect) byCategory[cat].correct += 1;
  }

  return { byDifficulty, byCategory, correct, total };
}

export type MockSlotFinalOutcome = 'correct' | 'wrong' | 'skipped';

/**
 * Mock test: every bank slot counts toward totals; outcome is slot-final (after optional retry).
 */
export async function aggregateMockFinalByLevelBand(
  bankQuestions: Question[],
  getSlotOutcome: (index: number) => MockSlotFinalOutcome
): Promise<SessionAggregate> {
  const byDifficulty: Record<string, { correct: number; total: number }> = {};
  const byCategory: Record<string, { correct: number; total: number }> = {};
  let correct = 0;
  const total = bankQuestions.length;

  const levelMap = await fetchLevelsByQuestionIds(
    bankQuestions.map((q) => q.id).filter((id) => !isEphemeralQuestionId(id))
  );

  for (let i = 0; i < bankQuestions.length; i++) {
    const question = bankQuestions[i];
    const outcome = getSlotOutcome(i);

    let band: LevelBandSlug;
    if (isEphemeralQuestionId(question.id)) {
      band = await getOrClassifyLevelBand(question);
    } else {
      band = normalizeLevelBandSlug(
        levelMap.get(question.id) ?? fallbackBandFromLegacyDifficulty(question.difficulty)
      );
    }

    if (!byDifficulty[band]) byDifficulty[band] = { correct: 0, total: 0 };
    byDifficulty[band].total += 1;
    if (outcome === 'correct') {
      correct++;
      byDifficulty[band].correct += 1;
    }

    const cat = question.category || question.subject || 'General';
    if (!byCategory[cat]) byCategory[cat] = { correct: 0, total: 0 };
    byCategory[cat].total += 1;
    if (outcome === 'correct') byCategory[cat].correct += 1;
  }

  return { byDifficulty, byCategory, correct, total };
}
