import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import { useQuestions } from '@/app/hooks/useQuestions';
import type { Question } from '@/app/data/exam-data';
import { LevelBandPill } from '@/app/components/LevelBandPill';
import { isEphemeralQuestionId } from '@/app/constants/levelBands';
import { getCurrentUserEmail, getCurrentUserId, saveWrongQuestion } from '@/app/services/userWrongQuestions';
import { getOrClassifyLevelBand } from '@/app/services/questionLevels';
import { aggregateMockFinalByLevelBand } from '@/app/utils/buildSessionResultsByLevelBand';
import {
  abandonMockTestAttempt,
  completeMockTestAttempt,
  createMockTestAttempt,
  upsertMockTestQuestionOutcome,
  type MockAllocationBucket,
} from '@/app/services/mockTest';
import { buildMockTestQueue, MOCK_ADMIN_TOTAL_QUESTIONS, MOCK_TOTAL_QUESTIONS } from '@/app/utils/buildMockTestQueue';
import { isAdminEmail } from '@/app/utils/adminEmails';
import { generateSimilarQuestion } from '@/app/services/aiService';
import { mockTopicRollupsAndCritical, buildAssessmentNarrative } from '@/app/utils/assessmentScoring';
import { Clock, Flag, AlertTriangle, CheckCircle2, RotateCcw, ClipboardList } from 'lucide-react';
import { MOCK_PASS_THRESHOLD_PERCENT, MOCK_TIME_LIMIT_SECONDS } from '@/app/constants/mockExam';
import {
  loadMockSession,
  saveMockSession,
  clearMockSession,
  slotResultsFromSnapshot,
  type MockSlotResultPersisted,
} from '@/app/services/mockTestSessionStorage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import type { AssessmentTier } from '@/app/utils/assessmentTier';

type SlotResult = MockSlotResultPersisted;

function tierFromQuestion(q: Question): AssessmentTier {
  const d = String(q.difficulty || 'medium').toLowerCase();
  if (d === 'easy' || d === 'hard') return d;
  return 'medium';
}

function harderTier(d: AssessmentTier): AssessmentTier {
  if (d === 'easy') return 'medium';
  if (d === 'medium') return 'hard';
  return 'hard';
}

function topicCodeOf(q: Question): string {
  return (q.category || q.subject || 'General').trim() || 'General';
}

/** Timer / early submit: no deliberate skip — counts as unanswered (wrong), not “skipped”. */
function unansweredSlotPenalty(): SlotResult {
  return {
    firstSelected: null,
    firstTryCorrect: false,
    firstSkipped: false,
    retryOffered: false,
    retryQuestionId: null,
    retryQuestionText: null,
    retrySelected: null,
    retryCorrect: null,
    retrySkipped: false,
    finalCorrect: false,
    finalSkipped: false,
  };
}

/** Single row per (attempt, slot_index); same payload at incremental finalize and final submit. */
function buildMockSlotUpsertParams(
  attemptId: string,
  slotIndex: number,
  question: Question,
  allocationBucket: MockAllocationBucket,
  s: SlotResult
) {
  return {
    attemptId,
    slotIndex,
    questionId: isEphemeralQuestionId(question.id) ? null : question.id,
    topicCode: question.category || question.subject || null,
    difficultyBand: tierFromQuestion(question),
    allocationBucket,
    firstQuestionText: question.question ?? null,
    firstSelectedOption: s.firstSelected,
    firstTryCorrect: s.firstTryCorrect,
    firstSkipped: s.firstSkipped,
    retryOffered: s.retryOffered,
    retryQuestionId: s.retryQuestionId,
    retryQuestionText: s.retryQuestionText,
    retrySelectedOption: s.retrySelected,
    retryCorrect: s.retryCorrect,
    retrySkipped: s.retrySkipped,
    finalCorrect: s.finalCorrect,
    finalSkipped: s.finalSkipped,
  };
}

export function MockTest() {
  const {
    setCurrentScreen,
    answerQuestion,
    updateProgress,
    userProgress,
    addChatMessage,
    setChatOpen,
    setLastSessionResults,
    selectedMockSubject,
    setSelectedMockSubject,
    setSubjectSelectFor,
    setActiveTutorMcq,
  } = useApp();
  const { questions, loading: questionsLoading, error: questionsError } = useQuestions();
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [allocationBuckets, setAllocationBuckets] = useState<MockAllocationBucket[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const flaggedQuestionsRef = useRef(flaggedQuestions);
  flaggedQuestionsRef.current = flaggedQuestions;
  const [timeLeft, setTimeLeft] = useState(MOCK_TIME_LIMIT_SECONDS);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [inRetry, setInRetry] = useState(false);
  const [retryQuestion, setRetryQuestion] = useState<Question | null>(null);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [firstPhaseHint, setFirstPhaseHint] = useState<string | null>(null);
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [mockSlotTarget, setMockSlotTarget] = useState(MOCK_TOTAL_QUESTIONS);

  const attemptIdRef = useRef<string | null>(null);
  const creatingAttemptRef = useRef(false);
  const submittingRef = useRef(false);
  const slotResultsRef = useRef<Record<number, SlotResult>>({});
  const uncommittedFirstTryRef = useRef<Map<number, number>>(new Map());
  const firstWrongSelectionRef = useRef<number | null>(null);

  const currentQuestionIndexRef = useRef(0);
  const inRetryRef = useRef(false);
  const retryQuestionRef = useRef<Question | null>(null);
  const selectedOptionRef = useRef<number | null>(null);
  const testQuestionsRef = useRef<Question[]>([]);
  const allocationBucketsRef = useRef<MockAllocationBucket[]>([]);

  currentQuestionIndexRef.current = currentQuestionIndex;
  inRetryRef.current = inRetry;
  retryQuestionRef.current = retryQuestion;
  selectedOptionRef.current = selectedOption;
  testQuestionsRef.current = testQuestions;
  allocationBucketsRef.current = allocationBuckets;

  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;
  const selectedMockSubjectRef = useRef(selectedMockSubject);
  selectedMockSubjectRef.current = selectedMockSubject;
  const mockSlotTargetRef = useRef(mockSlotTarget);
  mockSlotTargetRef.current = mockSlotTarget;

  const submitTestRef = useRef<() => void>(() => {});
  /** Set when the queue is built; used so attempt snapshot matches planned admin vs full mock. */
  const mockPlanRef = useRef<{ total: number; adminShort: boolean }>({
    total: MOCK_TOTAL_QUESTIONS,
    adminShort: false,
  });

  const timerMinutesTotal = Math.floor(MOCK_TIME_LIMIT_SECONDS / 60);

  /** Phase 6: persist each slot to Supabase when finalized (same row updated if user already wrote first-try fields). */
  const persistSlotOutcomeIncremental = useCallback(async (idx: number, r: SlotResult) => {
    const aid = attemptIdRef.current;
    if (!aid) return;
    const q = testQuestionsRef.current[idx];
    if (!q) return;
    const bucket = allocationBucketsRef.current[idx] ?? 'fallback';
    await upsertMockTestQuestionOutcome(buildMockSlotUpsertParams(aid, idx, q, bucket, r));
  }, []);

  const recordSlot = useCallback(
    (idx: number, r: SlotResult) => {
      slotResultsRef.current[idx] = r;
      uncommittedFirstTryRef.current.delete(idx);
      setSlotsVersion((v) => v + 1);
      void persistSlotOutcomeIncremental(idx, r);
    },
    [persistSlotOutcomeIncremental]
  );

  const getSlot = useCallback((idx: number) => slotResultsRef.current[idx], []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /** 90m exam: green with plenty of time left, warn in last ~10m (aligned with final-exam-style tiers). */
  const getTimerColor = () => {
    if (timeLeft > 30 * 60) return 'text-success';
    if (timeLeft > 10 * 60) return 'text-warning';
    return 'text-destructive';
  };

  /** Resolve the current slot if still open (timer / forced submit). */
  const finalizeOpenSlot = useCallback(
    (into: Record<number, SlotResult>) => {
      const idx = currentQuestionIndexRef.current;
      if (into[idx]) return;
      const bank = testQuestionsRef.current[idx];
      if (!bank) return;

      const sel = selectedOptionRef.current;
      const retry = inRetryRef.current;
      const rq = retryQuestionRef.current;

      if (retry && rq) {
        const firstSel = firstWrongSelectionRef.current;
        if (sel === null) {
          into[idx] = {
            firstSelected: firstSel,
            firstTryCorrect: false,
            firstSkipped: false,
            retryOffered: true,
            retryQuestionId: isEphemeralQuestionId(rq.id) ? null : rq.id,
            retryQuestionText: rq.question ?? null,
            retrySelected: null,
            retryCorrect: false,
            retrySkipped: false,
            finalCorrect: false,
            finalSkipped: false,
          };
        } else {
          const rc = sel === rq.correctAnswer;
          into[idx] = {
            firstSelected: firstSel,
            firstTryCorrect: false,
            firstSkipped: false,
            retryOffered: true,
            retryQuestionId: isEphemeralQuestionId(rq.id) ? null : rq.id,
            retryQuestionText: rq.question ?? null,
            retrySelected: sel,
            retryCorrect: rc,
            retrySkipped: false,
            finalCorrect: rc,
            finalSkipped: false,
          };
        }
        return;
      }

      if (sel === null) {
        into[idx] = unansweredSlotPenalty();
        return;
      }
      const firstCorrect = sel === bank.correctAnswer;
      into[idx] = {
        firstSelected: sel,
        firstTryCorrect: firstCorrect,
        firstSkipped: false,
        retryOffered: false,
        retryQuestionId: null,
        retryQuestionText: null,
        retrySelected: null,
        retryCorrect: null,
        retrySkipped: false,
        finalCorrect: firstCorrect,
        finalSkipped: false,
      };
    },
    []
  );

  const advanceAfterSlot = useCallback(
    (idx: number) => {
      setInRetry(false);
      setRetryQuestion(null);
      setRetryHint(null);
      setFirstPhaseHint(null);
      firstWrongSelectionRef.current = null;
      setLoadingSimilar(false);

      if (idx < testQuestionsRef.current.length - 1) {
        const next = idx + 1;
        setCurrentQuestionIndex(next);
        const done = slotResultsRef.current[next];
        setSelectedOption(
          done ? done.firstSelected : uncommittedFirstTryRef.current.get(next) ?? null
        );
      }
    },
    []
  );

  const submitTest = useCallback(() => {
    if (submittingRef.current) return;
    clearMockSession();
    submittingRef.current = true;
    setTestCompleted(true);

    const allSlots: Record<number, SlotResult> = { ...slotResultsRef.current };
    finalizeOpenSlot(allSlots);
    const totalSlots = testQuestionsRef.current.length;
    for (let i = 0; i < totalSlots; i++) {
      if (!allSlots[i]) {
        const b = testQuestionsRef.current[i];
        if (b) allSlots[i] = unansweredSlotPenalty();
      }
    }
    slotResultsRef.current = allSlots;
    setSlotsVersion((v) => v + 1);

    const firstTryCorrectCount = Object.values(allSlots).filter((s) => s.firstTryCorrect).length;
    const retryUsedCount = Object.values(allSlots).filter((s) => s.retryOffered).length;
    const retryCorrectCount = Object.values(allSlots).filter((s) => s.retryCorrect === true).length;
    const retryWrongCount = Object.values(allSlots).filter(
      (s) => s.retryOffered && s.retryCorrect !== true
    ).length;
    const skippedSlots = Object.values(allSlots).filter((s) => s.finalSkipped).length;
    const correctSlotsFinal = Object.values(allSlots).filter((s) => s.finalCorrect).length;
    const wrongSlotsFinal = Math.max(0, totalSlots - correctSlotsFinal - skippedSlots);
    const percentFinal = totalSlots > 0 ? Math.round(((correctSlotsFinal / totalSlots) * 1000) / 10) : 0;

    const topicSlots = testQuestionsRef.current.map((q, i) => {
      const s = allSlots[i]!;
      const retryRecovery = s.retryOffered && s.retryCorrect === true;
      const hardWrongPattern = !s.finalSkipped && !s.firstTryCorrect && !retryRecovery;
      return {
        topicCode: topicCodeOf(q),
        firstTryCorrect: s.firstTryCorrect,
        finalSkipped: s.finalSkipped,
        retryRecovery,
        hardWrongPattern,
      };
    });

    const { topicRollup, hasCriticalBand } = mockTopicRollupsAndCritical(topicSlots);
    const isPass = percentFinal >= MOCK_PASS_THRESHOLD_PERCENT && !hasCriticalBand;
    const firstTryPercent =
      totalSlots > 0 ? Math.round(((firstTryCorrectCount / totalSlots) * 1000) / 10) : 0;
    const belowThreshold = percentFinal < MOCK_PASS_THRESHOLD_PERCENT;
    const failReason: null | 'below_threshold' | 'critical_topic' | 'both' = isPass
      ? null
      : belowThreshold && hasCriticalBand
        ? 'both'
        : hasCriticalBand
          ? 'critical_topic'
          : 'below_threshold';

    testQuestionsRef.current.forEach((question, index) => {
      const s = allSlots[index]!;
      if (s.finalSkipped) return;
      const lastSel =
        s.retryOffered && s.retrySelected !== null ? s.retrySelected : s.firstSelected;
      if (lastSel === null) return;
      answerQuestion(question.id, lastSel, s.finalCorrect);
    });

    void (async () => {
      const getOutcome = (i: number) => {
        const s = allSlots[i]!;
        if (s.finalSkipped) return 'skipped' as const;
        return s.finalCorrect ? ('correct' as const) : ('wrong' as const);
      };

      const { byDifficulty, byCategory, correct, total } = await aggregateMockFinalByLevelBand(
        testQuestionsRef.current,
        getOutcome
      );

      const mwSum = Object.values(allSlots).filter((s) => s.retryOffered && s.retryCorrect === true).length;
      const hwSum = Object.values(allSlots).filter((s) => s.retryOffered && s.retryCorrect === false).length;

      setLastSessionResults({
        total,
        correct,
        incorrect: total - correct,
        byDifficulty,
        byCategory,
        mockTestAssessment: {
          totalSlots,
          correctSlotsFinal,
          skippedSlots,
          percentFinal,
          firstTryPercent,
          passThresholdPercent: MOCK_PASS_THRESHOLD_PERCENT,
          firstTryCorrectCount,
          retryUsedCount,
          retryCorrectCount,
          retryWrongCount,
          hasCriticalBand,
          isPass,
          failReason,
          narrative: buildAssessmentNarrative(mwSum, hwSum),
        },
      });

      const userId = await getCurrentUserId();

      if (userId) {
        if (attemptIdRef.current) {
          for (let i = 0; i < testQuestionsRef.current.length; i++) {
            const question = testQuestionsRef.current[i];
            const s = allSlots[i]!;
            const bucket = allocationBucketsRef.current[i] ?? 'fallback';
            await upsertMockTestQuestionOutcome(
              buildMockSlotUpsertParams(attemptIdRef.current, i, question, bucket, s)
            );
          }
          await completeMockTestAttempt({
            attemptId: attemptIdRef.current,
            correctSlotsFinal,
            wrongSlotsFinal,
            skippedSlots,
            firstTryCorrectCount,
            retryUsedCount,
            retryCorrectCount,
            retryWrongCount,
            percentFinal,
            hasCriticalBand,
            isPass,
            topicRollup,
            resultsSnapshot: {
              byDifficulty,
              byCategory,
              total: totalSlots,
              answered: totalSlots - skippedSlots,
              correct: correctSlotsFinal,
              skipped: skippedSlots,
              mode: 'phase6_persist',
              firstTryCorrectCount,
              retryUsedCount,
            },
          });
        }
        for (let i = 0; i < testQuestionsRef.current.length; i++) {
          const question = testQuestionsRef.current[i];
          const s = allSlots[i]!;
          if (s.finalSkipped || s.finalCorrect) continue;
          if (isEphemeralQuestionId(question.id)) continue;
          try {
            const band = await getOrClassifyLevelBand(question);
            await saveWrongQuestion(userId, question.id, question.category || question.subject || 'General', {
              levelBand: band,
              isFirstTry: true,
            });
          } catch (e) {
            console.warn('mock saveWrongQuestion', e);
          }
        }
      }

      updateProgress({
        mockTestsCompleted: userProgress.mockTestsCompleted + 1,
      });

      setSelectedMockSubject(null);

      await new Promise((r) => setTimeout(r, 2000));
      setCurrentScreen('results');
      submittingRef.current = false;
    })();
  }, [
    finalizeOpenSlot,
    setLastSessionResults,
    answerQuestion,
    updateProgress,
    userProgress.mockTestsCompleted,
    setCurrentScreen,
    setSelectedMockSubject,
  ]);

  submitTestRef.current = submitTest;

  useEffect(() => {
    if (questionsLoading || loadingQueue || testQuestions.length === 0 || testStarted) return;
    addChatMessage(
      'ai',
      "⚠️ This test simulates real exam conditions. You'll have a timer, no hints, you cannot skip items — you must choose an answer before moving on, and if you get a retry you must answer it before continuing. The first wrong answer on each question unlocks one harder similar question. Take your time and stay focused. Good luck!"
    );
    setChatOpen(true);
    setTestStarted(true);
  }, [questionsLoading, loadingQueue, testQuestions.length, testStarted, addChatMessage, setChatOpen]);

  useEffect(() => {
    if (questionsLoading || questionsError) return;
    if (questions.length === 0) return;
    if (testQuestions.length > 0) return;
    let cancelled = false;
    setLoadingQueue(true);
    setQueueError(null);
    void (async () => {
      const uid = await getCurrentUserId();
      if (!uid) {
        if (!cancelled) setQueueError('Sign in to run mock test.');
        if (!cancelled) setLoadingQueue(false);
        return;
      }
      const snap = loadMockSession();
      if (
        snap &&
        snap.userId === uid &&
        snap.selectedMockSubject === selectedMockSubject &&
        snap.testQuestions.length > 0 &&
        !snap.testCompleted
      ) {
        mockPlanRef.current = snap.mockPlan;
        if (!cancelled) setMockSlotTarget(snap.mockSlotTarget);
        if (!cancelled) setTestQuestions(snap.testQuestions);
        if (!cancelled) setAllocationBuckets(snap.allocationBuckets);
        slotResultsRef.current = slotResultsFromSnapshot(snap.slotResults) as Record<number, SlotResult>;
        uncommittedFirstTryRef.current = new Map(snap.uncommittedFirstTry);
        if (!cancelled) setFlaggedQuestions(new Set(snap.flagged));
        if (!cancelled) setCurrentQuestionIndex(snap.currentQuestionIndex);
        if (!cancelled) setTimeLeft(snap.timeLeft);
        if (!cancelled) setTestStarted(snap.testStarted);
        if (!cancelled) setTestCompleted(false);
        if (!cancelled) setInRetry(snap.inRetry);
        if (!cancelled) setRetryQuestion(snap.retryQuestion);
        firstWrongSelectionRef.current = snap.firstWrongSelection;
        attemptIdRef.current = snap.attemptId;
        if (!cancelled) setSelectedOption(snap.selectedOption);
        if (!cancelled) setSlotsVersion((v) => v + 1);
        if (!cancelled) setLoadingQueue(false);
        return;
      }
      const email = await getCurrentUserEmail();
      const adminShort = isAdminEmail(email);
      const totalSlots = adminShort ? MOCK_ADMIN_TOTAL_QUESTIONS : MOCK_TOTAL_QUESTIONS;
      mockPlanRef.current = { total: totalSlots, adminShort };
      if (!cancelled) setMockSlotTarget(totalSlots);
      try {
        const built = await buildMockTestQueue(questions, uid, { totalQuestions: totalSlots });
        if (!cancelled) {
          setTestQuestions(built.questions);
          setAllocationBuckets(built.slots.map((s) => s.allocationBucket));
        }
      } catch (e) {
        if (!cancelled) setQueueError(e instanceof Error ? e.message : 'Failed to build mock queue.');
      } finally {
        if (!cancelled) setLoadingQueue(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questions, questionsLoading, questionsError, testQuestions.length, selectedMockSubject]);

  useEffect(() => {
    if (!testStarted || testCompleted || testQuestions.length === 0) return;

    const runSave = () => {
      void getCurrentUserId().then((userId) => {
        if (!userId) return;
        const sr: Record<string, MockSlotResultPersisted> = {};
        for (const [k, v] of Object.entries(slotResultsRef.current)) {
          sr[String(k)] = v;
        }
        saveMockSession({
          v: 1,
          userId,
          savedAt: Date.now(),
          selectedMockSubject: selectedMockSubjectRef.current,
          testQuestions: testQuestionsRef.current,
          allocationBuckets: allocationBucketsRef.current,
          mockPlan: { ...mockPlanRef.current },
          mockSlotTarget: mockSlotTargetRef.current,
          currentQuestionIndex: currentQuestionIndexRef.current,
          timeLeft: timeLeftRef.current,
          testStarted: true,
          testCompleted: false,
          slotResults: sr,
          uncommittedFirstTry: [...uncommittedFirstTryRef.current.entries()],
          flagged: [...flaggedQuestionsRef.current],
          inRetry: inRetryRef.current,
          retryQuestion: retryQuestionRef.current,
          firstWrongSelection: firstWrongSelectionRef.current,
          attemptId: attemptIdRef.current,
          selectedOption: selectedOptionRef.current,
        });
      });
    };

    const onVis = () => {
      if (document.visibilityState === 'hidden') runSave();
    };
    window.addEventListener('beforeunload', runSave);
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(runSave, 4000);
    return () => {
      window.removeEventListener('beforeunload', runSave);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(id);
    };
  }, [testStarted, testCompleted, testQuestions.length]);

  useEffect(() => {
    if (!testStarted || questionsLoading || loadingQueue || testQuestions.length === 0) return;
    if (attemptIdRef.current || creatingAttemptRef.current) return;
    creatingAttemptRef.current = true;
    void (async () => {
      const userId = await getCurrentUserId();
      if (!userId) {
        creatingAttemptRef.current = false;
        return;
      }
      const attemptId = await createMockTestAttempt({
        userId,
        totalQuestions: testQuestions.length,
        timeLimitSeconds: timeLeft,
        passThresholdPercent: MOCK_PASS_THRESHOLD_PERCENT,
        criticalFailEnabled: true,
        buildSnapshot: {
          selectedMockSubject,
          phase: 'phase6_persist',
          adminShortMock: mockPlanRef.current.adminShort,
          mockQuestionCount: testQuestions.length,
        },
      });
      attemptIdRef.current = attemptId;
      creatingAttemptRef.current = false;
    })();
  }, [questionsLoading, loadingQueue, selectedMockSubject, testQuestions.length, testStarted, timeLeft]);

  useEffect(() => {
    if (testCompleted) return;
    if (questionsLoading || loadingQueue || testQuestions.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          submitTestRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [testCompleted, questionsLoading, loadingQueue, testQuestions.length]);

  const bankQuestion = testQuestions[currentQuestionIndex];
  const displayQuestion =
    inRetry && retryQuestion ? retryQuestion : bankQuestion;

  useEffect(() => {
    if (
      questionsLoading ||
      questionsError ||
      questions.length === 0 ||
      loadingQueue ||
      testQuestions.length === 0 ||
      !testStarted ||
      testCompleted ||
      !displayQuestion
    ) {
      setActiveTutorMcq(null);
      return;
    }
    setActiveTutorMcq({
      question: displayQuestion.question,
      options: displayQuestion.options,
      correctIndex: displayQuestion.correctAnswer,
      explanation: displayQuestion.explanation,
      subject: displayQuestion.subject || displayQuestion.category,
    });
    return () => setActiveTutorMcq(null);
  }, [
    questionsLoading,
    questionsError,
    questions.length,
    loadingQueue,
    testQuestions,
    displayQuestion,
    testStarted,
    testCompleted,
    setActiveTutorMcq,
    inRetry,
    retryQuestion,
    currentQuestionIndex,
  ]);

  const stashUncommittedAndGoTo = (targetIndex: number) => {
    const idx = currentQuestionIndex;
    if (!getSlot(idx) && !inRetry && selectedOption !== null) {
      uncommittedFirstTryRef.current.set(idx, selectedOption);
    }
    setCurrentQuestionIndex(targetIndex);
    const done = getSlot(targetIndex);
    setInRetry(false);
    setRetryQuestion(null);
    setRetryHint(null);
    setFirstPhaseHint(null);
    firstWrongSelectionRef.current = null;
    setLoadingSimilar(false);
    setSelectedOption(
      done ? done.firstSelected : uncommittedFirstTryRef.current.get(targetIndex) ?? null
    );
  };

  const handleOptionSelect = (index: number) => {
    if (loadingSimilar) return;
    setSelectedOption(index);
    setRetryHint(null);
    setFirstPhaseHint(null);
    if (!inRetry) {
      uncommittedFirstTryRef.current.set(currentQuestionIndex, index);
    }
  };

  const runFirstWrongRetry = async (idx: number, bank: Question, wrongSel: number) => {
    firstWrongSelectionRef.current = wrongSel;
    setLoadingSimilar(true);
    setRetryHint(null);
    setFirstPhaseHint(null);
    try {
      const harder = harderTier(tierFromQuestion(bank));
      const gen = await generateSimilarQuestion(
        bank.question,
        bank.subject || bank.category || 'General',
        harder
      );
      const rq: Question = {
        id: `ephemeral-mock-retry-${idx}-${Date.now()}`,
        subject: bank.subject || '',
        difficulty: harder,
        question: gen.question,
        options: gen.options,
        correctAnswer: gen.correctAnswer,
        explanation: gen.explanation,
        whyWrong: {},
        category: gen.category || bank.category,
      };
      setRetryQuestion(rq);
      setInRetry(true);
      setSelectedOption(null);
    } catch (e) {
      console.warn('mock retry similar', e);
      recordSlot(idx, {
        firstSelected: wrongSel,
        firstTryCorrect: false,
        firstSkipped: false,
        retryOffered: false,
        retryQuestionId: null,
        retryQuestionText: null,
        retrySelected: null,
        retryCorrect: null,
        retrySkipped: false,
        finalCorrect: false,
        finalSkipped: false,
      });
      const last = idx === testQuestions.length - 1;
      if (last) submitTestRef.current();
      else advanceAfterSlot(idx);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const handleNext = async () => {
    const idx = currentQuestionIndex;
    const bank = testQuestions[idx];
    if (!bank) return;

    if (getSlot(idx)) {
      advanceAfterSlot(idx);
      return;
    }

    if (inRetry && retryQuestion) {
      if (selectedOption === null) {
        setRetryHint('Select an answer for the retry question to continue.');
        return;
      }
      const retryCorrect = selectedOption === retryQuestion.correctAnswer;
      recordSlot(idx, {
        firstSelected: firstWrongSelectionRef.current,
        firstTryCorrect: false,
        firstSkipped: false,
        retryOffered: true,
        retryQuestionId: isEphemeralQuestionId(retryQuestion.id) ? null : retryQuestion.id,
        retryQuestionText: retryQuestion.question ?? null,
        retrySelected: selectedOption,
        retryCorrect,
        retrySkipped: false,
        finalCorrect: retryCorrect,
        finalSkipped: false,
      });
      const last = idx === testQuestions.length - 1;
      if (last) submitTestRef.current();
      else advanceAfterSlot(idx);
      return;
    }

    if (selectedOption === null) {
      setFirstPhaseHint('Select an answer to continue.');
      return;
    }

    if (selectedOption === bank.correctAnswer) {
      recordSlot(idx, {
        firstSelected: selectedOption,
        firstTryCorrect: true,
        firstSkipped: false,
        retryOffered: false,
        retryQuestionId: null,
        retryQuestionText: null,
        retrySelected: null,
        retryCorrect: null,
        retrySkipped: false,
        finalCorrect: true,
        finalSkipped: false,
      });
      const last = idx === testQuestions.length - 1;
      if (last) return;
      advanceAfterSlot(idx);
      return;
    }

    await runFirstWrongRetry(idx, bank, selectedOption);
  };

  const handlePrevious = () => {
    if (loadingSimilar) return;
    if (inRetry && retryQuestion) return;
    if (currentQuestionIndex > 0) {
      stashUncommittedAndGoTo(currentQuestionIndex - 1);
    }
  };

  const handleFlag = () => {
    const newFlagged = new Set(flaggedQuestions);
    if (newFlagged.has(currentQuestionIndex)) {
      newFlagged.delete(currentQuestionIndex);
    } else {
      newFlagged.add(currentQuestionIndex);
    }
    setFlaggedQuestions(newFlagged);
  };

  const handleSubmit = () => {
    setShowSubmitDialog(true);
  };

  const confirmSubmit = () => {
    setShowSubmitDialog(false);
    submitTest();
  };

  const handleExit = () => {
    setShowExitDialog(true);
  };

  const confirmExit = () => {
    clearMockSession();
    if (attemptIdRef.current) {
      void abandonMockTestAttempt(attemptIdRef.current);
    }
    setSelectedMockSubject(null);
    setCurrentScreen('dashboard');
  };

  if (questionsLoading || loadingQueue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">
            Building mock exam ({mockSlotTarget} questions, {timerMinutesTotal} min timer)…
          </p>
        </div>
      </div>
    );
  }
  if (questionsError || queueError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center max-w-md p-6">
          <p className="text-destructive mb-4">{questionsError || queueError}</p>
          <Button
            onClick={() => {
              clearMockSession();
              setCurrentScreen('dashboard');
            }}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center max-w-md p-6">
          <p className="text-muted-foreground mb-4">No questions available. Add questions in Supabase.</p>
          <Button
            onClick={() => {
              clearMockSession();
              setCurrentScreen('dashboard');
            }}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  if (testQuestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center max-w-md p-6">
          <p className="text-muted-foreground mb-4">No questions for mock queue. Please check question bank data.</p>
          <Button
            onClick={() => {
              clearMockSession();
              setSelectedMockSubject(null);
              setSubjectSelectFor('mock');
              setCurrentScreen('subjectSelect');
            }}
          >
            Choose subject
          </Button>
        </div>
      </div>
    );
  }

  const progress = testQuestions.length ? ((currentQuestionIndex + 1) / testQuestions.length) * 100 : 0;
  const resolvedCount = Object.keys(slotResultsRef.current).length;
  const answeredCount = resolvedCount;
  const unansweredCount = testQuestions.length - resolvedCount;
  void slotsVersion;

  const isLast = currentQuestionIndex === testQuestions.length - 1;
  const currentResolved = getSlot(currentQuestionIndex) !== undefined;
  const nextBlocked = !currentResolved && selectedOption === null;
  const navLocked = inRetry || loadingSimilar || nextBlocked;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-sky-500/10 flex flex-col">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b-2 border-primary shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-lg tracking-tight text-foreground">FULL MOCK EXAM</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {timerMinutesTotal}-minute timed paper · Pass ≥{MOCK_PASS_THRESHOLD_PERCENT}% and no CRITICAL topic · No hints · No
                  skipping — choose an answer on every item · First wrong unlocks one harder similar question
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2 md:hidden">
                  <span className="px-2.5 py-0.5 rounded-md bg-muted text-xs font-medium">
                    Q{currentQuestionIndex + 1}/{testQuestions.length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-muted text-xs font-medium">
                    Resolved {answeredCount}/{testQuestions.length}
                  </span>
                  {flaggedQuestions.size > 0 && (
                    <span className="px-2.5 py-0.5 rounded-md bg-warning/15 text-warning text-xs font-medium inline-flex items-center gap-1">
                      <Flag className="w-3 h-3" />
                      {flaggedQuestions.size}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <div
                className={`flex flex-col items-end sm:items-center gap-0.5 px-4 py-2 rounded-xl bg-muted/80 border border-border font-mono ${getTimerColor()}`}
              >
                <div className="flex items-center gap-2 text-xl font-bold tabular-nums">
                  <Clock className="w-5 h-5 shrink-0" />
                  {formatTime(timeLeft)}
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-sans">Time left</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleExit} className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                <AlertTriangle className="w-4 h-4" />
                Exit
              </Button>
            </div>
          </div>

          <div className="hidden md:flex flex-wrap items-center gap-2 mt-3">
            <div className="px-3 py-1 rounded-lg bg-muted text-sm font-medium">
              Question {currentQuestionIndex + 1}/{testQuestions.length}
            </div>
            <div className="px-3 py-1 rounded-lg bg-muted text-sm">Resolved: {answeredCount}</div>
            {flaggedQuestions.size > 0 && (
              <div className="px-3 py-1 rounded-lg bg-warning/10 text-warning text-sm flex items-center gap-1">
                <Flag className="w-3 h-3" />
                {flaggedQuestions.size} Flagged
              </div>
            )}
          </div>

          <Progress value={progress} className="h-2 mt-3" />
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentQuestionIndex}-${inRetry ? 'r' : 'b'}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-6 md:p-8 border-2 border-primary/20 shadow-xl">
                <div className="flex items-start justify-between gap-4 mb-8">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                        Q{currentQuestionIndex + 1}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-muted text-xs font-semibold">{displayQuestion.category}</span>
                      <LevelBandPill question={bankQuestion} />
                      {inRetry && (
                        <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          Retry (similar, harder)
                        </span>
                      )}
                      {loadingSimilar && (
                        <span className="text-xs text-muted-foreground animate-pulse">Loading similar question…</span>
                      )}
                      {flaggedQuestions.has(currentQuestionIndex) && (
                        <span className="px-3 py-1 rounded-full bg-warning/15 text-warning text-xs font-semibold inline-flex items-center gap-1">
                          <Flag className="w-3 h-3" />
                          Flagged
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl md:text-2xl font-semibold leading-relaxed">{displayQuestion.question}</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFlag}
                    className={`shrink-0 ${flaggedQuestions.has(currentQuestionIndex) ? 'text-warning' : 'text-muted-foreground'}`}
                    aria-label={flaggedQuestions.has(currentQuestionIndex) ? 'Unflag question' : 'Flag question'}
                  >
                    <Flag className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4 mb-8">
                  {displayQuestion.options.map((option, index) => (
                    <motion.button
                      type="button"
                      key={index}
                      whileHover={{ scale: loadingSimilar ? 1 : 1.01 }}
                      whileTap={{ scale: loadingSimilar ? 1 : 0.99 }}
                      disabled={loadingSimilar}
                      onClick={() => handleOptionSelect(index)}
                      className={`w-full text-left p-4 md:p-5 rounded-xl border-2 transition-all ${
                        selectedOption === index
                          ? 'border-primary bg-primary/10 ring-2 ring-primary shadow-lg'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      } ${loadingSimilar ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div
                          className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                            selectedOption === index ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}
                        >
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span className="flex-1 text-base md:text-lg">{option}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {(retryHint || firstPhaseHint) && (
                  <p className="text-sm text-destructive mb-4">{retryHint ?? firstPhaseHint}</p>
                )}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-6 border-t-2 border-border">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handlePrevious}
                    disabled={loadingSimilar || inRetry || (currentQuestionIndex === 0 && !inRetry)}
                    className="w-full sm:w-auto"
                  >
                    ← Previous
                  </Button>

                  <div className="text-sm text-muted-foreground text-center order-first sm:order-none">
                    {answeredCount}/{testQuestions.length} slots resolved
                    {navLocked && !loadingSimilar && (
                      <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">
                        {inRetry
                          ? 'Finish the retry question to use the navigator.'
                          : nextBlocked
                            ? 'Select an answer to use the navigator.'
                            : null}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-end">
                    {isLast && currentResolved && !inRetry ? (
                      <Button size="lg" onClick={handleSubmit} className="bg-success hover:bg-success/90 text-base w-full sm:w-auto">
                        Submit mock exam
                      </Button>
                    ) : isLast && inRetry ? (
                      <Button
                        size="lg"
                        onClick={() => void handleNext()}
                        disabled={loadingSimilar || selectedOption === null}
                        className="w-full sm:w-auto"
                      >
                        Finish &amp; submit
                      </Button>
                    ) : isLast && !currentResolved && !inRetry ? (
                      <>
                        <Button
                          variant="secondary"
                          size="lg"
                          onClick={() => void handleNext()}
                          disabled={loadingSimilar || nextBlocked}
                          className="w-full sm:w-auto"
                        >
                          Next →
                        </Button>
                        <Button
                          size="lg"
                          onClick={handleSubmit}
                          className="bg-success hover:bg-success/90 w-full sm:w-auto"
                          disabled={loadingSimilar}
                        >
                          Submit mock exam
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="lg"
                        onClick={() => void handleNext()}
                        disabled={loadingSimilar || nextBlocked}
                        className="w-full sm:w-auto"
                      >
                        Next →
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-4 md:p-5 border border-primary/15 bg-card/80">
                <h3 className="font-semibold mb-1">Question navigator</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Jump to any slot. Colors show final outcome after retry. Current question is highlighted.
                </p>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                  {testQuestions.map((_, index) => (
                    <button
                      type="button"
                      key={index}
                      disabled={navLocked}
                      onClick={() => {
                        if (navLocked) return;
                        stashUncommittedAndGoTo(index);
                      }}
                      className={`aspect-square rounded-lg font-semibold text-sm transition-all ${
                        index === currentQuestionIndex
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                          : getSlot(index)
                            ? getSlot(index)?.finalCorrect
                              ? 'bg-success/20 text-success border border-success'
                              : 'bg-destructive/15 text-destructive border border-destructive/40'
                            : uncommittedFirstTryRef.current.has(index)
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : flaggedQuestions.has(index)
                                ? 'bg-warning/20 text-warning border border-warning'
                                : 'bg-muted hover:bg-muted/70'
                      } ${navLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-4 text-sm flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-success/20 border border-success" />
                    <span className="text-muted-foreground">Correct (final)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-destructive/15 border border-destructive/40" />
                    <span className="text-muted-foreground">Wrong (final)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary/15 border border-primary/30" />
                    <span className="text-muted-foreground">In progress</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Submit full mock exam?
            </DialogTitle>
            <DialogDescription>
              You have resolved {answeredCount} of {testQuestions.length} slots. Any slot not finalized will be counted as
              incorrect for pass ({MOCK_PASS_THRESHOLD_PERCENT}% + no CRITICAL topic).
              {unansweredCount > 0 && ` ${unansweredCount} slot(s) are not finalized yet.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Keep reviewing
            </Button>
            <Button onClick={confirmSubmit} className="bg-success hover:bg-success/90">
              Yes, submit mock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Leave mock exam?
            </DialogTitle>
            <DialogDescription>
              Your attempt will be abandoned and this session’s answers will not count toward results. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Stay in exam
            </Button>
            <Button variant="destructive" onClick={confirmExit}>
              Yes, exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {testCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="text-center"
          >
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 360],
              }}
              transition={{ duration: 1 }}
              className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="w-12 h-12 text-success" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Mock exam submitted</h2>
            <p className="text-muted-foreground">Scoring your slots and topic bands…</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
