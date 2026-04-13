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
  createTopicAttempt,
  insertQuestionOutcome,
  completeTopicAttempt,
} from '@/app/services/assessmentStageOne';
import { buildStageOneAssessmentQueue, STAGE_ONE_TOPIC_TOTAL } from '@/app/utils/buildStageOneAssessmentQueue';
import type { AssessmentTier } from '@/app/utils/assessmentTier';
import {
  computeRawScorePercentForTotal,
  computeAdjustedScore,
  statusBandFromAdjusted,
  buildAssessmentNarrative,
  emptyTierBreakdown,
  type AssessmentOutcomeKind,
} from '@/app/utils/assessmentScoring';
import { generateHint, generateSimilarQuestion } from '@/app/services/aiService';
import {
  loadStageOneSnapshot,
  saveStageOneSnapshot,
  clearStageOneSnapshot,
} from '@/app/services/linearFlowSessionStorage';
import { ArrowLeft, Lightbulb, ChevronRight, SkipForward, MessageCircle } from 'lucide-react';
import { pushQuestionToTutorChat } from '@/app/services/tutorChatPush';

function isSimilarId(id: string): boolean {
  return id.startsWith('similar-');
}

const FEEDBACK_DELAY_MS = 650;

function feedbackDelay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Admins get a short Stage 1 run per topic for QA; learners still need full bank and get 35 Q. */
const STAGE_ONE_ADMIN_QUESTION_CAP = 10;

export function StageOneAssessment({ topicKey }: { topicKey: string }) {
  const {
    setCurrentScreen,
    setLastSessionResults,
    updateProgress,
    userProgress,
    setActiveTutorMcq,
    setSelectedAssessmentTopic,
    setSubjectSelectFor,
    addChatMessage,
    setChatOpen,
    chatMessages,
  } = useApp();

  const { questions, loading: questionsLoading, error: questionsError } = useQuestions();

  const [banks, setBanks] = useState<Question[]>([]);
  const [tiers, setTiers] = useState<AssessmentTier[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [adminStageOneCapApplied, setAdminStageOneCapApplied] = useState(false);
  const sessionTotalRef = useRef(STAGE_ONE_TOPIC_TOTAL);

  const [similarQ, setSimilarQ] = useState<Question | null>(null);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarShowReveal, setSimilarShowReveal] = useState(false);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loadingHint, setLoadingHint] = useState(false);
  const [bankHint, setBankHint] = useState<{ text: string } | null>(null);
  const [wrongRevealIndex, setWrongRevealIndex] = useState<number | null>(null);
  const [showCorrectReveal, setShowCorrectReveal] = useState(false);
  const [tutorPushBusy, setTutorPushBusy] = useState(false);
  const tutorBusyRef = useRef(false);
  /** After hint round on bank: wait for explicit Next (no auto-advance). */
  const [bankHintAwaitNext, setBankHintAwaitNext] = useState(false);
  const pendingBankHintNextRef = useRef<null | { kind: 'leave' } | { kind: 'similar'; tier: AssessmentTier }>(null);

  const statsRef = useRef({ cf: 0, mw: 0, hw: 0, sk: 0 });
  const submitBusyRef = useRef(false);
  const tierStatRef = useRef(emptyTierBreakdown());
  const banksRef = useRef<Question[]>([]);
  const tiersRef = useRef<AssessmentTier[]>([]);
  const currentIndexRef = useRef(0);
  banksRef.current = banks;
  tiersRef.current = tiers;
  currentIndexRef.current = currentIndex;

  const topicLabel = SUBJECTS.find((s) => s.key === topicKey)?.label ?? topicKey;

  const runStageOneTutorPush = useCallback(
    async (q: Question, note: string) => {
      if (tutorBusyRef.current || questionsLoading || questionsError) return;
      tutorBusyRef.current = true;
      setTutorPushBusy(true);
      try {
        await pushQuestionToTutorChat(
          'Stage 1',
          q,
          {
            addChatMessage,
            setChatOpen,
            setActiveTutorMcq,
            chatMessages,
            bankQuestions: questions,
            userProgress: {
              accuracy: userProgress.accuracy,
              weakAreas: userProgress.weakAreas,
              level: userProgress.level,
            },
          },
          note
        );
      } finally {
        tutorBusyRef.current = false;
        setTutorPushBusy(false);
      }
    },
    [
      questionsLoading,
      questionsError,
      addChatMessage,
      setChatOpen,
      setActiveTutorMcq,
      chatMessages,
      questions,
      userProgress.accuracy,
      userProgress.weakAreas,
      userProgress.level,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingQueue(true);
      setQueueError(null);
      try {
        const userIdEarly = await getCurrentUserId();
        if (!userIdEarly) {
          if (!cancelled) setQueueError('Sign in to run this assessment.');
          if (!cancelled) setLoadingQueue(false);
          return;
        }

        const snap = loadStageOneSnapshot();
        if (
          snap &&
          snap.userId === userIdEarly &&
          snap.topicKey === topicKey &&
          snap.banks.length > 0 &&
          !cancelled
        ) {
          sessionTotalRef.current = snap.sessionTotal;
          setAdminStageOneCapApplied(snap.adminCapApplied);
          setBanks(snap.banks);
          setTiers(snap.tiers);
          statsRef.current = { ...snap.stats };
          tierStatRef.current = {
            easy: { ...snap.tierStat.easy },
            medium: { ...snap.tierStat.medium },
            hard: { ...snap.tierStat.hard },
          };
          setCurrentIndex(snap.currentIndex);
          setAttemptId(snap.attemptId);
          setSimilarQ(snap.similarQ);
          setSimilarShowReveal(snap.similarShowReveal);
          setShowResult(snap.showResult);
          setIsCorrect(snap.isCorrect);
          setSelectedOption(snap.selectedOption);
          setBankHint(snap.bankHint);
          setWrongRevealIndex(snap.wrongRevealIndex ?? null);
          setShowCorrectReveal(snap.showCorrectReveal ?? false);
          if (!cancelled) setLoadingQueue(false);
          return;
        }

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

        const { data: sessionWrap } = await supabase.auth.getSession();
        const sessionEmail = sessionWrap?.session?.user?.email;
        const adminShortRun =
          isAdminEmail(sessionEmail) && b.length > STAGE_ONE_ADMIN_QUESTION_CAP;

        const finalBanks = adminShortRun ? b.slice(0, STAGE_ONE_ADMIN_QUESTION_CAP) : b;
        const finalTiers = adminShortRun ? t.slice(0, STAGE_ONE_ADMIN_QUESTION_CAP) : t;
        const effectiveTotal = finalBanks.length;
        sessionTotalRef.current = effectiveTotal;

        if (!cancelled) setAdminStageOneCapApplied(adminShortRun);

        setBanks(finalBanks);
        setTiers(finalTiers);
        const tb = emptyTierBreakdown();
        for (const tier of finalTiers) {
          tb[tier].total += 1;
        }
        tierStatRef.current = tb;

        const id = await createTopicAttempt(userIdEarly, topicKey, {
          totalQuestions: effectiveTotal,
        });
        if (!cancelled) setAttemptId(id);
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
  const currentQ = similarQ ?? bankQ;

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

  useEffect(() => {
    if (banks.length === 0 || !attemptId) return;

    const runSave = () => {
      void getCurrentUserId().then((userId) => {
        if (!userId) return;
        const ts = tierStatRef.current;
        saveStageOneSnapshot({
          v: 1,
          kind: 'stage1',
          userId,
          savedAt: Date.now(),
          topicKey,
          sessionTotal: sessionTotalRef.current,
          banks: banksRef.current,
          tiers: tiersRef.current,
          currentIndex: currentIndexRef.current,
          stats: { ...statsRef.current },
          tierStat: {
            easy: { ...ts.easy },
            medium: { ...ts.medium },
            hard: { ...ts.hard },
          },
          attemptId,
          adminCapApplied: adminStageOneCapApplied,
          shortfallNotice: null,
          similarQ,
          similarShowReveal,
          showResult,
          isCorrect,
          selectedOption,
          bankHint,
          wrongRevealIndex,
          showCorrectReveal,
        });
      });
    };

    const onVis = () => {
      if (document.visibilityState === 'hidden') runSave();
    };
    window.addEventListener('beforeunload', runSave);
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(runSave, 4000);
    return () => {
      window.removeEventListener('beforeunload', runSave);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(iv);
    };
  }, [
    banks.length,
    attemptId,
    topicKey,
    currentIndex,
    similarQ,
    similarShowReveal,
    showResult,
    isCorrect,
    selectedOption,
    bankHint,
    wrongRevealIndex,
    showCorrectReveal,
    adminStageOneCapApplied,
  ]);

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

  const finishTest = useCallback(async () => {
    clearStageOneSnapshot();
    const { cf, mw, hw, sk } = statsRef.current;
    const T = sessionTotalRef.current;
    const raw = computeRawScorePercentForTotal(cf, T);
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
      total: T,
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

  const leaveSlot = useCallback(
    async (idx: number) => {
      pendingBankHintNextRef.current = null;
      setBankHintAwaitNext(false);
      setBankHint(null);
      setSimilarQ(null);
      setSimilarShowReveal(false);
      setShowResult(false);
      setSelectedOption(null);
      setIsCorrect(false);
      setWrongRevealIndex(null);
      setShowCorrectReveal(false);
      if (idx >= banks.length - 1) {
        await finishTest();
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [banks.length, finishTest]
  );

  const loadSimilarAfterHard = async (tier: AssessmentTier) => {
    if (!bankQ) return;
    pendingBankHintNextRef.current = null;
    setBankHintAwaitNext(false);
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
      setWrongRevealIndex(null);
      setShowCorrectReveal(false);
    } catch {
      await leaveSlot(currentIndex);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedOption === null || !bankQ || atEnd) return;
    if (submitBusyRef.current) return;
    submitBusyRef.current = true;
    const tier = tiers[currentIndex];

    try {
      if (similarQ) {
        const correct = selectedOption === similarQ.correctAnswer;
        if (correct) {
          setWrongRevealIndex(null);
          setShowCorrectReveal(true);
          setIsCorrect(true);
          setShowResult(true);
          await feedbackDelay(FEEDBACK_DELAY_MS);
          await leaveSlot(currentIndex);
          return;
        }
        setWrongRevealIndex(selectedOption);
        setShowCorrectReveal(true);
        setIsCorrect(false);
        setShowResult(true);
        setSimilarShowReveal(true);
        return;
      }

      const correct = selectedOption === bankQ.correctAnswer;

      if (bankHint === null) {
        if (correct) {
          setWrongRevealIndex(null);
          setShowCorrectReveal(true);
          setIsCorrect(true);
          setShowResult(true);
          await recordAndInsert('correct_first', bankQ, tier);
          await feedbackDelay(FEEDBACK_DELAY_MS);
          await leaveSlot(currentIndex);
          return;
        }
        setWrongRevealIndex(selectedOption);
        setShowCorrectReveal(false);
        setIsCorrect(false);
        setShowResult(true);
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
        setShowResult(false);
        setWrongRevealIndex(null);
        setShowCorrectReveal(false);
        setSelectedOption(null);
        return;
      }

      if (correct) {
        setWrongRevealIndex(null);
        setShowCorrectReveal(true);
        setIsCorrect(true);
        setShowResult(true);
        await recordAndInsert('medium_wrong', bankQ, tier);
        pendingBankHintNextRef.current = { kind: 'leave' };
        setBankHintAwaitNext(true);
        return;
      }

      setWrongRevealIndex(selectedOption);
      setShowCorrectReveal(true);
      setIsCorrect(false);
      setShowResult(true);
      await recordAndInsert('hard_wrong', bankQ, tier);
      pendingBankHintNextRef.current = { kind: 'similar', tier };
      setBankHintAwaitNext(true);
    } finally {
      submitBusyRef.current = false;
    }
  };

  const handleSkipSimilar = async () => {
    if (!similarQ || !bankQ) return;
    statsRef.current.sk += 1;
    setSimilarQ(null);
    setSimilarShowReveal(false);
    setShowResult(false);
    setSelectedOption(null);
    setWrongRevealIndex(null);
    setShowCorrectReveal(false);
    await leaveSlot(currentIndex);
  };

  const handleNextAfterSimilarWrong = async () => {
    await leaveSlot(currentIndex);
  };

  const handleNextAfterBankHintRound = async () => {
    if (submitBusyRef.current) return;
    const p = pendingBankHintNextRef.current;
    if (!p) return;
    submitBusyRef.current = true;
    pendingBankHintNextRef.current = null;
    setBankHintAwaitNext(false);
    try {
      if (p.kind === 'leave') {
        await leaveSlot(currentIndex);
      } else {
        await loadSimilarAfterHard(p.tier);
      }
    } finally {
      submitBusyRef.current = false;
    }
  };

  const goBack = () => {
    clearStageOneSnapshot();
    setSelectedAssessmentTopic(null);
    setSubjectSelectFor('assessment');
    setCurrentScreen('subjectSelect');
  };

  const revealGreenOnCorrect =
    similarShowReveal || (showResult && (isCorrect || showCorrectReveal));

  const getOptionClass = (index: number) => {
    const revealed = showResult || similarShowReveal;
    if (!revealed) {
      return selectedOption === index
        ? 'border-primary bg-primary/10 ring-2 ring-primary'
        : 'border-border hover:border-primary/50 hover:bg-muted/50';
    }
    if (revealGreenOnCorrect && index === currentQ.correctAnswer) {
      return 'border-success bg-success/10 ring-2 ring-success';
    }
    if (wrongRevealIndex !== null && index === wrongRevealIndex && !isCorrect && showResult) {
      return 'border-destructive bg-destructive/10 ring-2 ring-destructive';
    }
    if (
      selectedOption !== null &&
      selectedOption === index &&
      index !== currentQ.correctAnswer &&
      index !== wrongRevealIndex
    ) {
      return 'border-primary bg-primary/10 ring-2 ring-primary';
    }
    return 'border-border opacity-50';
  };

  const optionLetterClass = (index: number) => {
    const revealed = showResult || similarShowReveal;
    if (revealGreenOnCorrect && index === currentQ.correctAnswer) {
      return 'bg-success text-success-foreground';
    }
    if (wrongRevealIndex !== null && index === wrongRevealIndex && !isCorrect && showResult) {
      return 'bg-destructive text-destructive-foreground';
    }
    if (selectedOption === index) {
      return 'bg-primary text-primary-foreground';
    }
    return 'bg-muted';
  };

  const optionsDisabled =
    similarShowReveal ||
    loadingSimilar ||
    loadingHint ||
    bankHintAwaitNext ||
    (showResult && isCorrect);

  if (questionsLoading || loadingQueue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Building Stage 1 assessment (up to {STAGE_ONE_TOPIC_TOTAL} questions)…</p>
        </div>
      </div>
    );
  }

  if (questionsError || queueError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive text-center max-w-md">{queueError || questionsError}</p>
        <Button
          onClick={() => {
            clearStageOneSnapshot();
            setCurrentScreen('dashboard');
          }}
        >
          Dashboard
        </Button>
      </div>
    );
  }

  if (atEnd) {
    return null;
  }

  const totalSlots = banks.length;
  const progressPct = totalSlots > 0 ? ((currentIndex + 1) / totalSlots) * 100 : 0;
  const showSkip = similarQ !== null && isSimilarId(similarQ.id) && !similarShowReveal;

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
              {currentIndex + 1} / {totalSlots}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2 truncate">
            {topicLabel}
            {adminStageOneCapApplied
              ? ` · Admin preview: ${STAGE_ONE_ADMIN_QUESTION_CAP} questions only (learners get ${STAGE_ONE_TOPIC_TOTAL})`
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
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      Stage 1 Assessment
                    </span>
                    {!similarQ && (
                      <span className="px-3 py-1 rounded-full bg-muted text-xs font-medium capitalize">
                        {tiers[currentIndex]} · Bank
                      </span>
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
                      hint, it counts as a medium wrong; if still wrong, you&apos;ll get a related practice question
                      you can skip.
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
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${optionLetterClass(index)}`}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="flex-1">{option}</span>
                    </div>
                  </button>
                ))}
              </div>

              {!similarQ &&
                bankHint &&
                showResult &&
                showCorrectReveal &&
                (wrongRevealIndex !== null || isCorrect) &&
                Boolean(bankQ?.explanation?.trim()) && (
                  <div className="mb-6 p-4 rounded-xl border border-border bg-muted/30 text-sm">
                    <p className="font-medium mb-1">Explanation</p>
                    <p className="text-muted-foreground">{bankQ.explanation}</p>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={tutorPushBusy}
                        onClick={() =>
                          void runStageOneTutorPush(
                            bankQ,
                            `${topicLabel} · bank question · after hint round (topic assessment).`
                          )
                        }
                      >
                        <MessageCircle className="w-4 h-4" />
                        Add to chat
                      </Button>
                    </div>
                  </div>
                )}

              {similarShowReveal && similarQ && (
                <div className="mb-6 p-4 rounded-xl border border-border bg-muted/30 text-sm">
                  <p className="font-medium mb-1">Explanation</p>
                  <p className="text-muted-foreground">{similarQ.explanation}</p>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={tutorPushBusy}
                      onClick={() =>
                        void runStageOneTutorPush(
                          similarQ,
                          `${topicLabel} · similar (harder) question after wrong on follow-up.`
                        )
                      }
                    >
                      <MessageCircle className="w-4 h-4" />
                      Add to chat
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {similarShowReveal && (
                  <Button onClick={() => void handleNextAfterSimilarWrong()} className="gap-2">
                    {currentIndex >= banks.length - 1 ? 'View results' : 'Next question'}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}

                {bankHintAwaitNext && !similarQ && (
                  <Button onClick={() => void handleNextAfterBankHintRound()} className="gap-2">
                    {pendingBankHintNextRef.current?.kind === 'leave' && currentIndex >= banks.length - 1
                      ? 'View results'
                      : 'Next question'}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}

                {!similarShowReveal && !bankHintAwaitNext && !loadingSimilar && (
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
