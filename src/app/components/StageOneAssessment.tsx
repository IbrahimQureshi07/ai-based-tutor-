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
import {
  createTopicAttempt,
  insertQuestionOutcome,
  completeTopicAttempt,
} from '@/app/services/assessmentStageOne';
import { buildStageOneAssessmentQueue, STAGE_ONE_TOPIC_TOTAL } from '@/app/utils/buildStageOneAssessmentQueue';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import {
  computeRawScorePercent,
  computeAdjustedScore,
  statusBandFromAdjusted,
  buildAssessmentNarrative,
  emptyTierBreakdown,
  type AssessmentOutcomeKind,
} from '@/app/utils/assessmentScoring';
import { generateHint } from '@/app/services/aiService';
import { ArrowLeft, Lightbulb, ChevronRight } from 'lucide-react';

export function StageOneAssessment({ topicKey }: { topicKey: string }) {
  const {
    setCurrentScreen,
    setLastSessionResults,
    updateProgress,
    userProgress,
    setActiveTutorMcq,
    setSelectedAssessmentTopic,
    setSubjectSelectFor,
  } = useApp();

  const { questions, loading: questionsLoading, error: questionsError } = useQuestions();

  const [banks, setBanks] = useState<Question[]>([]);
  const [tiers, setTiers] = useState<AssessmentTier[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loadingHint, setLoadingHint] = useState(false);
  const [showRevealAfterHard, setShowRevealAfterHard] = useState(false);
  /** After first wrong: hint shown; user gets one more try on the same bank question. */
  const [bankHint, setBankHint] = useState<{ text: string } | null>(null);

  const statsRef = useRef({ cf: 0, mw: 0, hw: 0, sk: 0 });
  const tierStatRef = useRef(emptyTierBreakdown());

  const topicLabel = SUBJECTS.find((s) => s.key === topicKey)?.label ?? topicKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingQueue(true);
      setQueueError(null);
      try {
        const { banks: b, tiers: t } = await buildStageOneAssessmentQueue(questions, topicKey);
        if (cancelled) return;
        if (b.length < STAGE_ONE_TOPIC_TOTAL) {
          setQueueError(
            `Not enough questions for this topic in the bank (need ${STAGE_ONE_TOPIC_TOTAL}, found ${b.length}).`
          );
          setBanks([]);
          setTiers([]);
          setLoadingQueue(false);
          return;
        }
        setBanks(b);
        setTiers(t);
        const tb = emptyTierBreakdown();
        for (const tier of t) {
          tb[tier].total += 1;
        }
        tierStatRef.current = tb;

        const userId = await getCurrentUserId();
        if (userId) {
          const id = await createTopicAttempt(userId, topicKey);
          if (!cancelled) setAttemptId(id);
        }
      } catch (e) {
        if (!cancelled) setQueueError(e instanceof Error ? e.message : 'Failed to build assessment');
      } finally {
        if (!cancelled) setLoadingQueue(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questions, topicKey]);

  const bankQ = banks[currentIndex];
  const atEnd = currentIndex >= banks.length;

  useEffect(() => {
    const q = bankQ;
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
  }, [bankQ, questionsLoading, questionsError, atEnd, setActiveTutorMcq]);

  /** Hide correct answer until first-try correct, or after hard wrong reveal, or medium wrong auto-advance. */
  const hideCorrectAnswer =
    showResult && !isCorrect && !showRevealAfterHard && bankHint === null;

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

      if (attemptId) {
        await insertQuestionOutcome({
          attemptId,
          questionId: bankSlot.id,
          difficultyBand: tier,
          outcome: kind,
          firstTryCorrect,
          usedHint,
          secondTryCorrect,
        });
      }
    },
    [attemptId]
  );

  const advance = useCallback(() => {
    setBankHint(null);
    setShowRevealAfterHard(false);
    setShowResult(false);
    setSelectedOption(null);
    setIsCorrect(false);
    setCurrentIndex((i) => i + 1);
  }, []);

  const finishTest = useCallback(async () => {
    const { cf, mw, hw, sk } = statsRef.current;
    const raw = computeRawScorePercent(cf);
    const adj = computeAdjustedScore(raw, mw);
    const band = statusBandFromAdjusted(adj);
    const ts = tierStatRef.current;

    if (attemptId) {
      await completeTopicAttempt({
        attemptId,
        correctFirstTry: cf,
        mediumWrong: mw,
        hardWrong: hw,
        skipped: sk,
        rawScore: raw,
        adjustedScore: adj,
        statusBand: band,
      });
    }

    setLastSessionResults({
      total: STAGE_ONE_TOPIC_TOTAL,
      correct: cf,
      incorrect: mw + hw + sk,
      byDifficulty: {
        easy: { correct: ts.easy.correct, total: ts.easy.total },
        medium: { correct: ts.medium.correct, total: ts.medium.total },
        hard: { correct: ts.hard.correct, total: ts.hard.total },
      },
      byCategory: {},
      stageOneAssessment: {
        topicCode: topicKey,
        topicLabel,
        totalQuestions: STAGE_ONE_TOPIC_TOTAL,
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
      },
    });

    if (!userProgress.completedAssessment) {
      updateProgress({ completedAssessment: true });
    }

    setSelectedAssessmentTopic(null);
    setCurrentScreen('results');
  }, [
    attemptId,
    topicKey,
    topicLabel,
    setLastSessionResults,
    setCurrentScreen,
    updateProgress,
    userProgress.completedAssessment,
    setSelectedAssessmentTopic,
  ]);

  const handleSubmit = async () => {
    if (selectedOption === null || !bankQ || atEnd) return;
    const tier = tiers[currentIndex];
    const correct = selectedOption === bankQ.correctAnswer;

    if (bankHint === null) {
      if (correct) {
        await recordAndInsert('correct_first', bankQ, tier);
        if (currentIndex >= banks.length - 1) {
          await finishTest();
        } else {
          advance();
        }
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
      if (currentIndex >= banks.length - 1) {
        await finishTest();
      } else {
        advance();
      }
      return;
    }

    setIsCorrect(false);
    setShowResult(true);
    setShowRevealAfterHard(true);
    await recordAndInsert('hard_wrong', bankQ, tier);
  };

  const handleNextAfterHard = async () => {
    if (currentIndex >= banks.length - 1) {
      await finishTest();
    } else {
      advance();
    }
  };

  const goBack = () => {
    setSelectedAssessmentTopic(null);
    setSubjectSelectFor('assessment');
    setCurrentScreen('subjectSelect');
  };

  const getOptionClass = (index: number) => {
    if (!showResult && !showRevealAfterHard) {
      return selectedOption === index
        ? 'border-primary bg-primary/10 ring-2 ring-primary'
        : 'border-border hover:border-primary/50 hover:bg-muted/50';
    }
    const reveal = isCorrect || showRevealAfterHard;
    if (reveal && index === bankQ.correctAnswer) {
      return 'border-success bg-success/10 ring-2 ring-success';
    }
    if (index === selectedOption && !isCorrect && showResult) {
      return 'border-destructive bg-destructive/10 ring-2 ring-destructive';
    }
    if (!reveal && hideCorrectAnswer && index === bankQ.correctAnswer) {
      return 'border-border opacity-60';
    }
    return 'border-border opacity-50';
  };

  const optionsDisabled =
    showRevealAfterHard || (showResult && bankHint === null);

  if (questionsLoading || loadingQueue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Building Stage 1 assessment (35 questions)…</p>
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

  const progressPct = ((currentIndex + 1) / STAGE_ONE_TOPIC_TOTAL) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-card/80 border-b border-border/50 px-4 py-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Topics
            </Button>
            <span className="text-sm font-medium">
              {currentIndex + 1} / {STAGE_ONE_TOPIC_TOTAL}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2 truncate">{topicLabel}</p>
          <Progress value={progressPct} className="h-2" />
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentIndex}-${bankHint ? 'hint' : 'clean'}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="p-6 md:p-8 mb-6">
              <div className="flex items-start justify-between gap-3 mb-6">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      Stage 1 Assessment
                    </span>
                    <span className="px-3 py-1 rounded-full bg-muted text-xs font-medium capitalize">
                      {tiers[currentIndex]} · Bank
                    </span>
                    {bankHint && !showRevealAfterHard && (
                      <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-medium">
                        2nd try
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-semibold">{bankQ.question}</h2>
                  {bankHint && !showRevealAfterHard && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Read the hint below, then choose your answer again. Correct after hint counts as a medium wrong;
                      still wrong counts as a hard wrong.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {bankQ.options.map((option, index) => (
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
                          (isCorrect || showRevealAfterHard) && index === bankQ.correctAnswer
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

              {bankHint && bankHint.text && !showRevealAfterHard && (
                <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/30 flex gap-3">
                  <Lightbulb className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-warning mb-1">Hint</h4>
                    <p className="text-sm text-muted-foreground">
                      {loadingHint ? 'Getting a hint…' : bankHint.text}
                    </p>
                  </div>
                </div>
              )}

              {showResult && showRevealAfterHard && (
                <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm">
                  <p className="font-medium text-destructive mb-1">Hard wrong</p>
                  <p className="text-muted-foreground mb-2">
                    After the hint, the answer was still incorrect. Review the explanation, then continue.
                  </p>
                  <p className="font-medium mb-1">Explanation</p>
                  <p className="text-muted-foreground">{bankQ.explanation}</p>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {showRevealAfterHard && (
                  <Button onClick={() => void handleNextAfterHard()} className="gap-2">
                    {currentIndex >= banks.length - 1 ? 'View results' : 'Next question'}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}

                {!showRevealAfterHard && (
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={selectedOption === null || loadingHint}
                    className="gap-2"
                  >
                    {loadingHint ? 'Getting hint…' : bankHint ? 'Submit answer' : 'Submit'}
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
