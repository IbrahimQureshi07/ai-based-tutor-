import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { useQuestions } from '@/app/hooks/useQuestions';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import type { Question } from '@/app/data/exam-data';
import { SUBJECTS } from '@/app/data/subjects';
import { getCurrentUserId } from '@/app/services/userWrongQuestions';
import { supabase } from '@/app/services/supabase';
import { isAdminEmail } from '@/app/utils/adminEmails';
import {
  createMistakesTestAttempt,
  insertMistakesTestOutcome,
  completeMistakesTestAttempt,
  insertMistakesTestTeacherAlert,
} from '@/app/services/mistakesTest';
import {
  fetchLatestStageOneRollupByTopic,
  userHasCompletedStageOne,
} from '@/app/services/practiceStageTwoAggregation';
import {
  fetchLatestCompletedPreparationSummary,
  fetchPreparationPerTopicStats,
} from '@/app/services/practiceStageTwo';
import { userHasCompletedStageTwoPreparation } from '@/app/services/mistakesTestAggregation';
import { buildMistakesTestQueue, type MistakesTestQueueSource } from '@/app/utils/buildMistakesTestQueue';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import {
  computeRawScorePercentForTotal,
  computeAdjustedScore,
  statusBandFromAdjusted,
  buildAssessmentNarrative,
  emptyTierBreakdown,
  type AssessmentOutcomeKind,
} from '@/app/utils/assessmentScoring';
import { MISTAKES_TEST_TOTAL } from '@/app/utils/mistakesTestConstants';

/** Admins get a short run for QA; learners unchanged. */
const MISTAKES_TEST_ADMIN_QUESTION_CAP = 10;
import { buildMistakesTestCombinedAnalytics } from '@/app/utils/buildMistakesTestCombinedAnalytics';
import { subjectLabelMatches } from '@/app/utils/subjectMatch';
import { generateHint, generateSimilarQuestion } from '@/app/services/aiService';
import { ArrowLeft, Lightbulb, ChevronRight, SkipForward } from 'lucide-react';

function isSimilarId(id: string): boolean {
  return id.startsWith('similar-');
}

function topicCodeFromBankQuestion(q: Question): string | null {
  for (const s of SUBJECTS) {
    if (subjectLabelMatches(q, s.key)) return s.key;
  }
  return null;
}

type PerTopicSt = { cf: number; mw: number; hw: number; sk: number };

function bumpPerTopic(ref: Record<string, PerTopicSt>, topicKey: string, kind: AssessmentOutcomeKind) {
  if (!ref[topicKey]) ref[topicKey] = { cf: 0, mw: 0, hw: 0, sk: 0 };
  const t = ref[topicKey];
  if (kind === 'correct_first') t.cf += 1;
  if (kind === 'medium_wrong') t.mw += 1;
  if (kind === 'hard_wrong') t.hw += 1;
  if (kind === 'skipped') t.sk += 1;
}

export function MistakesTest() {
  const { setCurrentScreen, setLastSessionResults, setActiveTutorMcq } = useApp();

  const { questions, loading: questionsLoading, error: questionsError } = useQuestions();

  const [banks, setBanks] = useState<Question[]>([]);
  const [tiers, setTiers] = useState<AssessmentTier[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [shortfallNotice, setShortfallNotice] = useState<number | null>(null);
  const [adminMistakesCapApplied, setAdminMistakesCapApplied] = useState(false);

  const [similarQ, setSimilarQ] = useState<Question | null>(null);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarShowReveal, setSimilarShowReveal] = useState(false);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loadingHint, setLoadingHint] = useState(false);
  const [bankHint, setBankHint] = useState<{ text: string } | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  const statsRef = useRef({ cf: 0, mw: 0, hw: 0, sk: 0 });
  const tierStatRef = useRef(emptyTierBreakdown());
  const totalSlotsRef = useRef(0);
  const banksRef = useRef<Question[]>([]);
  const perTopicRef = useRef<Record<string, PerTopicSt>>({});
  const sourcesRef = useRef<MistakesTestQueueSource[]>([]);
  const unresolvedHardIdsRef = useRef<string[]>([]);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    totalSlotsRef.current = banks.length;
    banksRef.current = banks;
  }, [banks]);

  useEffect(() => {
    if (questionsLoading) {
      return;
    }
    if (questions.length === 0) {
      setLoadingQueue(false);
      if (questionsError) {
        setQueueError(null);
      } else {
        setQueueError('No questions available in the bank.');
      }
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingQueue(true);
      setQueueError(null);
      setShortfallNotice(null);
      try {
        const userId = await getCurrentUserId();
        if (!userId) {
          if (!cancelled) setQueueError('Sign in to run the mistakes test.');
          return;
        }
        if (!(await userHasCompletedStageOne(userId))) {
          if (!cancelled) {
            setQueueError('Complete at least one Stage 1 topic assessment first.');
          }
          return;
        }
        if (!(await userHasCompletedStageTwoPreparation(userId))) {
          if (!cancelled) {
            setQueueError('Complete Stage 2 preparation at least once to unlock the mistakes test.');
          }
          return;
        }

        const queueResult = await buildMistakesTestQueue(questions, userId);
        if (cancelled) return;

        if (queueResult.questions.length === 0) {
          setQueueError(
            'Could not build a mistakes test. Add more practice with mistakes in Stage 1 & 2, or check your question bank.'
          );
          return;
        }

        const { data: sessionWrap } = await supabase.auth.getSession();
        const sessionEmail = sessionWrap?.session?.user?.email;
        const adminShortRun =
          isAdminEmail(sessionEmail) &&
          queueResult.questions.length > MISTAKES_TEST_ADMIN_QUESTION_CAP;

        const finalQuestions = adminShortRun
          ? queueResult.questions.slice(0, MISTAKES_TEST_ADMIN_QUESTION_CAP)
          : queueResult.questions;
        const finalTiers = adminShortRun
          ? queueResult.tiers.slice(0, MISTAKES_TEST_ADMIN_QUESTION_CAP)
          : queueResult.tiers;
        const finalSources = adminShortRun
          ? queueResult.sources.slice(0, MISTAKES_TEST_ADMIN_QUESTION_CAP)
          : queueResult.sources;

        if (queueResult.shortfall > 0 && !adminShortRun) {
          setShortfallNotice(queueResult.shortfall);
        } else {
          setShortfallNotice(null);
        }

        statsRef.current = { cf: 0, mw: 0, hw: 0, sk: 0 };
        perTopicRef.current = {};
        unresolvedHardIdsRef.current = [];
        sourcesRef.current = finalSources;
        userIdRef.current = userId;

        if (!cancelled) setAdminMistakesCapApplied(adminShortRun);

        setBanks(finalQuestions);
        setTiers(finalTiers);
        const tb = emptyTierBreakdown();
        for (const tier of finalTiers) {
          tb[tier].total += 1;
        }
        tierStatRef.current = tb;

        const buildSnapshot = {
          ...queueResult.buildSnapshot,
          ...(adminShortRun ? { adminQuestionCap: MISTAKES_TEST_ADMIN_QUESTION_CAP } : {}),
        };

        const aid = await createMistakesTestAttempt(userId, {
          totalQuestions: finalQuestions.length,
          buildSnapshot,
        });
        if (!cancelled) setAttemptId(aid);
      } catch (e) {
        if (!cancelled) setQueueError(e instanceof Error ? e.message : 'Failed to build mistakes test');
      } finally {
        if (!cancelled) setLoadingQueue(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questions, questionsLoading, questionsError]);

  const bankQ = banks[currentIndex];
  const atEnd = currentIndex >= banks.length;
  const currentQ = similarQ ?? bankQ;
  const totalSlots = banks.length;

  useEffect(() => {
    const q = currentQ;
    if (questionsLoading || questionsError || !q || atEnd) {
      setActiveTutorMcq(null);
      return;
    }
    setActiveTutorMcq({
      question: q.question,
      options: q.options,
      correctIndex: q.correctAnswer,
      explanation: q.explanation,
      subject: q.subject || q.category,
    });
    return () => setActiveTutorMcq(null);
  }, [currentQ, questionsLoading, questionsError, atEnd, setActiveTutorMcq]);

  const hideCorrectAnswer =
    !isCorrect &&
    !similarShowReveal &&
    ((similarQ === null && bankHint !== null) || (similarQ !== null && !similarShowReveal && !showResult));

  const recordAndInsert = useCallback(
    async (kind: AssessmentOutcomeKind, bankSlot: Question, tier: AssessmentTier) => {
      if (kind === 'correct_first') statsRef.current.cf += 1;
      if (kind === 'medium_wrong') statsRef.current.mw += 1;
      if (kind === 'hard_wrong') statsRef.current.hw += 1;
      if (kind === 'skipped') statsRef.current.sk += 1;
      if (kind === 'correct_first') {
        tierStatRef.current[tier].correct += 1;
      }

      const firstTryCorrect = kind === 'correct_first';
      const usedHint = kind === 'medium_wrong' || kind === 'hard_wrong';
      let secondTryCorrect: boolean | null = null;
      if (kind === 'medium_wrong') secondTryCorrect = true;
      if (kind === 'hard_wrong') secondTryCorrect = false;

      if (kind === 'hard_wrong') {
        unresolvedHardIdsRef.current.push(bankSlot.id);
      }

      const topicCode = topicCodeFromBankQuestion(bankSlot);
      const topicKey = topicCode ?? '__unknown__';
      bumpPerTopic(perTopicRef.current, topicKey, kind);

      const qSource: MistakesTestQueueSource | null = sourcesRef.current[currentIndex] ?? null;

      if (attemptId) {
        await insertMistakesTestOutcome({
          attemptId,
          questionId: bankSlot.id,
          topicCode,
          difficultyBand: tier,
          outcome: kind,
          firstTryCorrect,
          usedHint,
          secondTryCorrect,
          questionSource: qSource,
        });
      }
    },
    [attemptId]
  );

  const finishTest = useCallback(async () => {
    const { cf, mw, hw, sk } = statsRef.current;
    const T = totalSlotsRef.current || totalSlots;
    const raw = computeRawScorePercentForTotal(cf, T);
    const adj = computeAdjustedScore(raw, mw);
    const band = statusBandFromAdjusted(adj);
    const ts = tierStatRef.current;

    const unresolved = [...new Set(unresolvedHardIdsRef.current)];
    let teacherAlertSent = false;

    if (attemptId) {
      await completeMistakesTestAttempt({
        attemptId,
        correctFirstTry: cf,
        mediumWrong: mw,
        hardWrong: hw,
        skipped: sk,
        rawScore: raw,
        adjustedScore: adj,
        statusBand: band,
        unresolvedSnapshot:
          unresolved.length > 0
            ? { unresolved_question_ids: unresolved, note: 'hard_wrong on bank slot in Stage 2.5 run' }
            : null,
      });

      if (unresolved.length > 0 && userIdRef.current) {
        teacherAlertSent = await insertMistakesTestTeacherAlert({
          userId: userIdRef.current,
          attemptId,
          payload: {
            unresolved_question_ids: unresolved,
            source: 'mistakes_test_stage_2_5',
          },
        });
      }
    }

    const uid = userIdRef.current;
    let mistakesTestCombinedAnalytics = undefined;
    if (uid) {
      try {
        const rollupMap = await fetchLatestStageOneRollupByTopic(uid);
        const latestPrep = await fetchLatestCompletedPreparationSummary(uid);
        const prepPerTopic = latestPrep
          ? await fetchPreparationPerTopicStats(latestPrep.attemptId)
          : {};
        const perTopicCopy: Record<string, PerTopicSt> = {};
        for (const [k, v] of Object.entries(perTopicRef.current)) {
          perTopicCopy[k] = { ...v };
        }
        mistakesTestCombinedAnalytics = buildMistakesTestCombinedAnalytics(
          rollupMap,
          latestPrep,
          prepPerTopic,
          banksRef.current,
          perTopicCopy,
          {
            totalQuestions: T,
            correctFirstTry: cf,
            mediumWrong: mw,
            rawScore: raw,
            adjustedScore: adj,
            statusBand: band,
          }
        );
      } catch (e) {
        console.warn('[MistakesTest] combined analytics', e);
      }
    }

    setLastSessionResults({
      total: T,
      correct: cf,
      incorrect: mw + hw + sk,
      byDifficulty: {
        easy: { correct: ts.easy.correct, total: ts.easy.total },
        medium: { correct: ts.medium.correct, total: ts.medium.total },
        hard: { correct: ts.hard.correct, total: ts.hard.total },
      },
      byCategory: {},
      mistakesTestAssessment: {
        topicCode: 'mistakes_test',
        topicLabel: 'Mistakes test (Stage 2.5)',
        totalQuestions: T,
        correctFirstTry: cf,
        mediumWrong: mw,
        hardWrong: hw,
        skipped: sk,
        rawScore: raw,
        adjustedScore: adj,
        statusBand: band,
        easyCorrect: ts.easy.correct,
        easyTotal: ts.easy.total,
        mediumCorrect: ts.medium.correct,
        mediumTotal: ts.medium.total,
        hardCorrect: ts.hard.correct,
        hardTotal: ts.hard.total,
        narrative: buildAssessmentNarrative(mw, hw),
        unresolvedQuestionIds: unresolved,
        teacherAlertSent,
      },
      mistakesTestCombinedAnalytics,
    });

    setCurrentScreen('results');
  }, [attemptId, totalSlots, setLastSessionResults, setCurrentScreen]);

  const leaveSlot = useCallback(
    async (idx: number) => {
      setBankHint(null);
      setSimilarQ(null);
      setSimilarShowReveal(false);
      setShowResult(false);
      setSelectedOption(null);
      setIsCorrect(false);
      if (idx >= banks.length - 1) {
        await finishTest();
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [banks.length, finishTest]
  );

  const loadSimilarAfterHard = async (_tier: AssessmentTier) => {
    if (!bankQ) return;
    setLoadingSimilar(true);
    try {
      const similar = await generateSimilarQuestion(
        bankQ.question,
        bankQ.subject || bankQ.category,
        bankQ.difficulty || 'medium'
      );
      const newQ: Question = {
        id: `similar-${Date.now()}`,
        question: similar.question,
        options: similar.options,
        correctAnswer: similar.correctAnswer,
        explanation: similar.explanation,
        whyWrong: {},
        subject: similar.category,
        category: similar.category,
        difficulty: bankQ.difficulty || 'medium',
      };
      setSimilarQ(newQ);
      setBankHint(null);
      setShowResult(false);
      setSelectedOption(null);
      setIsCorrect(false);
      setSimilarShowReveal(false);
    } catch {
      await leaveSlot(currentIndex);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedOption === null || !bankQ || atEnd) return;
    const tier = tiers[currentIndex];

    if (similarQ) {
      const correct = selectedOption === similarQ.correctAnswer;
      if (correct) {
        await leaveSlot(currentIndex);
        return;
      }
      setIsCorrect(false);
      setShowResult(true);
      setSimilarShowReveal(true);
      return;
    }

    const correct = selectedOption === bankQ.correctAnswer;

    if (bankHint === null) {
      if (correct) {
        await recordAndInsert('correct_first', bankQ, tier);
        await leaveSlot(currentIndex);
        return;
      }
      setLoadingHint(true);
      try {
        const hint = await generateHint(
          bankQ.question,
          bankQ.options,
          bankQ.category || 'General',
          bankQ.difficulty || 'medium'
        );
        setBankHint({ text: hint });
      } catch {
        setBankHint({
          text: 'Re-read the question carefully and compare each option before you try again.',
        });
      } finally {
        setLoadingHint(false);
      }
      setSelectedOption(null);
      setShowResult(false);
      setIsCorrect(false);
      return;
    }

    if (correct) {
      await recordAndInsert('medium_wrong', bankQ, tier);
      await leaveSlot(currentIndex);
      return;
    }

    await recordAndInsert('hard_wrong', bankQ, tier);
    await loadSimilarAfterHard(tier);
  };

  const handleSkipSimilar = async () => {
    if (!similarQ || !bankQ) return;
    statsRef.current.sk += 1;
    const tk = topicCodeFromBankQuestion(bankQ) ?? '__unknown__';
    bumpPerTopic(perTopicRef.current, tk, 'skipped');
    setSimilarQ(null);
    setSimilarShowReveal(false);
    setShowResult(false);
    setSelectedOption(null);
    await leaveSlot(currentIndex);
  };

  const handleNextAfterSimilarWrong = async () => {
    await leaveSlot(currentIndex);
  };

  const goBack = () => {
    setCurrentScreen('dashboard');
  };

  const getOptionClass = (index: number) => {
    if (!showResult && !similarShowReveal) {
      return selectedOption === index
        ? 'border-primary bg-primary/10 ring-2 ring-primary'
        : 'border-border hover:border-primary/50 hover:bg-muted/50';
    }
    const reveal = isCorrect || similarShowReveal;
    if (reveal && index === currentQ.correctAnswer) {
      return 'border-success bg-success/10 ring-2 ring-success';
    }
    if (index === selectedOption && !isCorrect && showResult) {
      return 'border-destructive bg-destructive/10 ring-2 ring-destructive';
    }
    if (!reveal && hideCorrectAnswer && index === currentQ.correctAnswer) {
      return 'border-border opacity-60';
    }
    return 'border-border opacity-50';
  };

  const optionsDisabled =
    similarShowReveal ||
    loadingSimilar ||
    (showResult && similarQ === null && bankHint === null);

  if (questionsLoading || loadingQueue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Building Stage 2.5 mistakes test (up to {MISTAKES_TEST_TOTAL} questions)…</p>
        </div>
      </div>
    );
  }

  if (questionsError || queueError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive text-center max-w-md">{queueError || questionsError}</p>
        <Button onClick={() => setCurrentScreen('dashboard')}>Dashboard</Button>
      </div>
    );
  }

  if (atEnd) {
    return null;
  }

  const progressPct = totalSlots > 0 ? ((currentIndex + 1) / totalSlots) * 100 : 0;
  const showSkip = similarQ !== null && isSimilarId(similarQ.id) && !similarShowReveal;
  const slotSource = sourcesRef.current[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-card/80 border-b border-border/50 px-4 py-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
            <span className="text-sm font-medium">
              {currentIndex + 1} / {totalSlots}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2 truncate">
            Past mistakes + weighted fresh · mixed topics
            {shortfallNotice != null && shortfallNotice > 0
              ? ` · ${shortfallNotice} slot(s) short of ${MISTAKES_TEST_TOTAL} (bank limit)`
              : ''}
            {adminMistakesCapApplied
              ? ` · Admin preview: first ${MISTAKES_TEST_ADMIN_QUESTION_CAP} questions only (full length unchanged for other users)`
              : ''}
          </p>
          <Progress value={progressPct} className="h-2" />
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentIndex}-${similarQ?.id ?? 'bank'}-${bankHint ? 'h' : ''}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="p-6 md:p-8 mb-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="px-3 py-1 rounded-full bg-rose-500/15 text-rose-800 dark:text-rose-300 text-xs font-semibold">
                      Stage 2.5 · Mistakes test
                    </span>
                    {!similarQ && (
                      <>
                        <span className="px-3 py-1 rounded-full bg-muted text-xs font-medium capitalize">
                          {tiers[currentIndex]} · Bank
                        </span>
                        <span className="px-3 py-1 rounded-full bg-slate-500/15 text-xs font-medium">
                          {slotSource === 'mistake_bank' ? 'From past mistakes' : 'Fresh (weighted)'}
                        </span>
                      </>
                    )}
                    {similarQ && (
                      <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-medium">
                        Practice variant
                      </span>
                    )}
                    {bankHint && !similarQ && (
                      <span className="px-3 py-1 rounded-full bg-violet-500/15 text-violet-800 dark:text-violet-300 text-xs font-medium">
                        2nd try
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-semibold">{currentQ.question}</h2>

                  {bankHint && !similarQ && (
                    <p className="text-xs text-muted-foreground/90 mt-2 leading-relaxed">
                      A hint is shown below — read it, then select your answer again and press{' '}
                      <span className="font-medium text-foreground">Submit answer</span>. If you get it right after the
                      hint, it counts as a medium wrong; if still wrong, you&apos;ll get a related practice question you
                      can skip.
                    </p>
                  )}

                  {similarQ && !similarShowReveal && (
                    <p className="text-xs text-muted-foreground/90 mt-2">
                      Related practice question — answer if you want, or use Skip to move on (counts as skipped).
                    </p>
                  )}
                </div>
                {showSkip && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1 border-dashed"
                    onClick={() => void handleSkipSimilar()}
                  >
                    <SkipForward className="w-4 h-4" />
                    Skip
                  </Button>
                )}
              </div>

              {bankHint && bankHint.text && !similarQ && (
                <div className="mb-5 p-4 rounded-xl bg-warning/10 border border-warning/30 flex gap-3">
                  <Lightbulb className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-warning mb-1">Hint</h4>
                    <p className="text-sm text-muted-foreground">
                      {loadingHint ? 'Getting a hint…' : bankHint.text}
                    </p>
                  </div>
                </div>
              )}

              {loadingSimilar && (
                <p className="text-sm text-muted-foreground mb-4">Loading related practice question…</p>
              )}

              <div className="space-y-3 mb-6">
                {currentQ.options.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => !optionsDisabled && setSelectedOption(index)}
                    disabled={optionsDisabled}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${getOptionClass(index)}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                          (isCorrect || similarShowReveal) && index === currentQ.correctAnswer
                            ? 'bg-success text-success-foreground'
                            : showResult && index === selectedOption && !isCorrect
                              ? 'bg-destructive text-destructive-foreground'
                              : selectedOption === index
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                        }`}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="flex-1">{option}</span>
                    </div>
                  </button>
                ))}
              </div>

              {similarShowReveal && similarQ && (
                <div className="mb-6 p-4 rounded-xl border border-border bg-muted/30 text-sm">
                  <p className="font-medium mb-1">Explanation</p>
                  <p className="text-muted-foreground">{similarQ.explanation}</p>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {similarShowReveal && (
                  <Button onClick={() => void handleNextAfterSimilarWrong()} className="gap-2">
                    {currentIndex >= banks.length - 1 ? 'View results' : 'Next question'}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}

                {!similarShowReveal && !loadingSimilar && (
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={selectedOption === null || loadingHint || loadingSimilar}
                    className="gap-2"
                  >
                    {loadingHint ? 'Getting hint…' : bankHint && !similarQ ? 'Submit answer' : 'Submit'}
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
