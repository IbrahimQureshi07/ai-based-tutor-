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
import {
  FINAL_EXAM_ADMIN_QUESTIONS,
  FINAL_EXAM_PASS_THRESHOLD_PERCENT,
  FINAL_EXAM_TIME_LIMIT_SECONDS,
  FINAL_EXAM_TOTAL_QUESTIONS,
} from '@/app/constants/finalExam';
import { SUBJECTS } from '@/app/data/subjects';
import { getCurrentUserEmail, getCurrentUserId, saveWrongQuestion } from '@/app/services/userWrongQuestions';
import { getOrClassifyLevelBand } from '@/app/services/questionLevels';
import {
  abandonFinalExamAttempt,
  completeFinalExamAttempt,
  createFinalExamAttempt,
  finalExamGradeFromPercent,
  finalExamIsPass,
  upsertFinalExamQuestionOutcome,
  type FinalExamGrade,
} from '@/app/services/finalExam';
import { isAdminEmail } from '@/app/utils/adminEmails';
import { aggregateMockFinalByLevelBand } from '@/app/utils/buildSessionResultsByLevelBand';
import { buildFinalExamQueue, type FinalExamQueueSlot } from '@/app/utils/buildFinalExamQueue';
import { subjectLabelMatches } from '@/app/utils/subjectMatch';
import { Clock, AlertTriangle, Award, Download, Share2, ClipboardList } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import {
  loadFinalExamSession,
  saveFinalExamSession,
  clearFinalExamSession,
} from '@/app/services/finalExamSessionStorage';

function uuidForOutcome(id: string): string | null {
  if (isEphemeralQuestionId(id)) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return id;
  return null;
}

function buildFinalSubjectRows(
  testQuestions: Question[],
  answers: Map<number, number>
): Array<{
  label: string;
  correct: number;
  total: number;
  percent: number;
  band: 'strong' | 'average' | 'weak';
}> {
  return SUBJECTS.map((s) => {
    let total = 0;
    let correct = 0;
    testQuestions.forEach((q, i) => {
      if (!subjectLabelMatches(q, s.key)) return;
      total += 1;
      const ua = answers.get(i);
      if (ua !== undefined && ua === q.correctAnswer) correct += 1;
    });
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const band: 'strong' | 'average' | 'weak' =
      percent >= 75 ? 'strong' : percent >= 50 ? 'average' : 'weak';
    return { label: s.label, correct, total, percent, band };
  }).filter((r) => r.total > 0);
}

export function FinalExam() {
  const {
    setCurrentScreen,
    answerQuestion,
    updateProgress,
    addChatMessage,
    setChatOpen,
    setLastSessionResults,
    setActiveTutorMcq,
  } = useApp();
  const { questions: bankQuestions, loading: questionsLoading, error: questionsError } = useQuestions();

  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [queueSlots, setQueueSlots] = useState<FinalExamQueueSlot[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [examSlotTarget, setExamSlotTarget] = useState(FINAL_EXAM_TOTAL_QUESTIONS);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [timeLeft, setTimeLeft] = useState(FINAL_EXAM_TIME_LIMIT_SECONDS);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [navHint, setNavHint] = useState<string | null>(null);
  const [finalPercent, setFinalPercent] = useState(0);
  const [finalGrade, setFinalGrade] = useState<FinalExamGrade>('Fail');
  const [finalIsPass, setFinalIsPass] = useState(false);

  const attemptIdRef = useRef<string | null>(null);
  const creatingAttemptRef = useRef(false);
  const submittingRef = useRef(false);
  const submitTestRef = useRef<() => void>(() => {});
  const examPlanRef = useRef<{
    total: number;
    adminShort: boolean;
    bucketCounts: Record<string, number>;
  }>({ total: FINAL_EXAM_TOTAL_QUESTIONS, adminShort: false, bucketCounts: {} });

  const testQuestionsRef = useRef<Question[]>([]);
  const queueSlotsRef = useRef<FinalExamQueueSlot[]>([]);
  const answersRef = useRef(answers);
  testQuestionsRef.current = testQuestions;
  queueSlotsRef.current = queueSlots;
  answersRef.current = answers;

  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  currentQuestionIndexRef.current = currentQuestionIndex;
  const selectedOptionRef = useRef(selectedOption);
  selectedOptionRef.current = selectedOption;
  const examSlotTargetRef = useRef(examSlotTarget);
  examSlotTargetRef.current = examSlotTarget;

  const timerMinutesTotal = Math.floor(FINAL_EXAM_TIME_LIMIT_SECONDS / 60);

  useEffect(() => {
    if (questionsLoading || questionsError || bankQuestions.length === 0 || testQuestions.length > 0) return;
    let cancelled = false;
    setLoadingQueue(true);
    setQueueError(null);
    void (async () => {
      const uid = await getCurrentUserId();
      if (!uid) {
        if (!cancelled) {
          setQueueError('Sign in to take the final exam.');
          setLoadingQueue(false);
        }
        return;
      }
      const snap = loadFinalExamSession();
      if (snap && snap.userId === uid && snap.testQuestions.length > 0 && !snap.testCompleted) {
        examPlanRef.current = snap.examPlan;
        if (!cancelled) setExamSlotTarget(snap.examSlotTarget);
        if (!cancelled) setTestQuestions(snap.testQuestions);
        if (!cancelled) setQueueSlots(snap.queueSlots);
        if (!cancelled) setCurrentQuestionIndex(snap.currentQuestionIndex);
        if (!cancelled) setTimeLeft(snap.timeLeft);
        if (!cancelled) setTestStarted(snap.testStarted);
        if (!cancelled) setTestCompleted(false);
        if (!cancelled) setAnswers(new Map(snap.answers));
        attemptIdRef.current = snap.attemptId;
        if (!cancelled) setSelectedOption(snap.selectedOption);
        if (!cancelled) setLoadingQueue(false);
        return;
      }
      const email = await getCurrentUserEmail();
      const adminShort = isAdminEmail(email);
      const totalSlots = adminShort ? FINAL_EXAM_ADMIN_QUESTIONS : FINAL_EXAM_TOTAL_QUESTIONS;
      examPlanRef.current = {
        ...examPlanRef.current,
        total: totalSlots,
        adminShort,
      };
      if (!cancelled) setExamSlotTarget(totalSlots);
      try {
        const built = await buildFinalExamQueue(bankQuestions, uid, { totalQuestions: totalSlots });
        if (!cancelled) {
          examPlanRef.current = {
            total: built.questions.length,
            adminShort,
            bucketCounts: built.bucketCounts as Record<string, number>,
          };
          setTestQuestions(built.questions);
          setQueueSlots(built.slots);
        }
      } catch (e) {
        if (!cancelled) setQueueError(e instanceof Error ? e.message : 'Failed to build final exam.');
      } finally {
        if (!cancelled) setLoadingQueue(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questionsLoading, questionsError, bankQuestions, testQuestions.length]);

  useEffect(() => {
    if (!testStarted || testCompleted || testQuestions.length === 0) return;

    const runSave = () => {
      void getCurrentUserId().then((userId) => {
        if (!userId) return;
        saveFinalExamSession({
          v: 1,
          userId,
          savedAt: Date.now(),
          testQuestions: testQuestionsRef.current,
          queueSlots: queueSlotsRef.current,
          examPlan: { ...examPlanRef.current },
          examSlotTarget: examSlotTargetRef.current,
          currentQuestionIndex: currentQuestionIndexRef.current,
          timeLeft: timeLeftRef.current,
          testStarted: true,
          testCompleted: false,
          answers: [...answersRef.current.entries()],
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
    if (!testStarted && !questionsLoading && !loadingQueue && testQuestions.length > 0) {
      addChatMessage(
        'ai',
        '🎓 Final exam: timed paper, no hints, no retries — pick an answer before moving on. Good luck!'
      );
      setChatOpen(true);
      setTestStarted(true);
    }
  }, [testStarted, questionsLoading, loadingQueue, testQuestions.length, addChatMessage, setChatOpen]);

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
      const id = await createFinalExamAttempt({
        userId,
        totalQuestions: testQuestions.length,
        timeLimitSeconds: FINAL_EXAM_TIME_LIMIT_SECONDS,
        passThresholdPercent: FINAL_EXAM_PASS_THRESHOLD_PERCENT,
        buildSnapshot: {
          phase: 'final_exam_v1',
          adminShortMock: examPlanRef.current.adminShort,
          mockQuestionCount: testQuestions.length,
          bucketCounts: examPlanRef.current.bucketCounts,
        },
      });
      attemptIdRef.current = id;
      creatingAttemptRef.current = false;
    })();
  }, [testStarted, questionsLoading, loadingQueue, testQuestions.length]);

  const currentQuestion = testQuestions[currentQuestionIndex];
  const progress = testQuestions.length ? ((currentQuestionIndex + 1) / testQuestions.length) * 100 : 0;
  const answeredCount = answers.size;
  const nextBlocked = !answers.has(currentQuestionIndex) && selectedOption === null;
  const navLocked = nextBlocked;

  useEffect(() => {
    if (questionsLoading || loadingQueue || testQuestions.length === 0 || testCompleted || !testStarted) {
      setActiveTutorMcq(null);
      return;
    }
    const q = testQuestions[currentQuestionIndex];
    if (!q) {
      setActiveTutorMcq(null);
      return;
    }
    setActiveTutorMcq({
      question: q.question,
      options: q.options,
      correctIndex: q.correctAnswer,
      explanation: '',
      subject: q.subject || q.category,
    });
    return () => setActiveTutorMcq(null);
  }, [
    questionsLoading,
    loadingQueue,
    testQuestions,
    currentQuestionIndex,
    testCompleted,
    testStarted,
    setActiveTutorMcq,
  ]);

  useEffect(() => {
    if (testCompleted) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          submitTestRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [testCompleted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft > 30 * 60) return 'text-success';
    if (timeLeft > 10 * 60) return 'text-warning';
    return 'text-destructive';
  };

  const stashAndGoTo = (targetIndex: number) => {
    setCurrentQuestionIndex(targetIndex);
    setSelectedOption(answers.get(targetIndex) ?? null);
    setNavHint(null);
  };

  const handleOptionSelect = (index: number) => {
    setSelectedOption(index);
    setNavHint(null);
    const next = new Map(answers);
    next.set(currentQuestionIndex, index);
    setAnswers(next);
  };

  const handleNext = () => {
    if (nextBlocked) {
      setNavHint('Select an answer to continue.');
      return;
    }
    if (currentQuestionIndex < testQuestions.length - 1) {
      stashAndGoTo(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) stashAndGoTo(currentQuestionIndex - 1);
  };

  const submitTest = useCallback(() => {
    if (submittingRef.current) return;
    const tq = testQuestionsRef.current;
    const slots = queueSlotsRef.current;
    if (tq.length === 0) return;
    clearFinalExamSession();
    submittingRef.current = true;
    setTestCompleted(true);

    const answersSnap = new Map(answersRef.current);
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    for (let i = 0; i < tq.length; i++) {
      const ua = answersSnap.get(i);
      if (ua === undefined) unanswered += 1;
      else if (ua === tq[i].correctAnswer) correct += 1;
      else wrong += 1;
    }
    const pct = tq.length > 0 ? Math.round((correct / tq.length) * 100) : 0;
    const grade = finalExamGradeFromPercent(pct);
    const isPass = finalExamIsPass(pct, FINAL_EXAM_PASS_THRESHOLD_PERCENT);
    setFinalPercent(pct);
    setFinalGrade(grade);
    setFinalIsPass(isPass);

    void (async () => {
      try {
      const userId = await getCurrentUserId();
      const attemptId = attemptIdRef.current;

      const topicRollup: Record<string, { correct: number; total: number }> = {};
      for (let i = 0; i < tq.length; i++) {
        const q = tq[i];
        const cat = q.category || q.subject || 'General';
        if (!topicRollup[cat]) topicRollup[cat] = { correct: 0, total: 0 };
        topicRollup[cat].total += 1;
        const ua = answersSnap.get(i);
        if (ua !== undefined && ua === q.correctAnswer) topicRollup[cat].correct += 1;
      }

      const subjectRows = buildFinalSubjectRows(tq, answersSnap);
      const { byDifficulty, byCategory, correct: aggCorrect, total: aggTotal } =
        await aggregateMockFinalByLevelBand(tq, (i) => {
          const ua = answersSnap.get(i);
          if (ua === undefined) return 'wrong';
          return ua === tq[i].correctAnswer ? 'correct' : 'wrong';
        });

      if (attemptId) {
        for (let i = 0; i < tq.length; i++) {
          const q = tq[i];
          const slot = slots[i];
          const ua = answersSnap.get(i);
          const isCorrect = ua !== undefined && ua === q.correctAnswer;
          await upsertFinalExamQuestionOutcome({
            attemptId,
            slotIndex: i,
            questionId: uuidForOutcome(q.id),
            topicCode: q.category || q.subject || null,
            difficultyBand: slot?.tier ?? 'medium',
            allocationBucket: slot?.allocationBucket ?? 'fallback',
            firstQuestionText: q.question ?? null,
            selectedOption: ua ?? null,
            isCorrect,
          });
        }

        await completeFinalExamAttempt({
          attemptId,
          correctCount: correct,
          wrongCount: wrong,
          unansweredCount: unanswered,
          percentFinal: pct,
          passThresholdPercent: FINAL_EXAM_PASS_THRESHOLD_PERCENT,
          topicRollup,
          resultsSnapshot: {
            grade,
            isPass,
            bucketCounts: examPlanRef.current.bucketCounts,
            subjectRows,
          },
        });
      } else {
        console.warn('[FinalExam] No attempt id — results saved locally only.');
      }

      setLastSessionResults({
        total: aggTotal,
        correct: aggCorrect,
        incorrect: aggTotal - aggCorrect,
        byDifficulty,
        byCategory,
        finalExamAssessment: {
          totalSlots: tq.length,
          correctCount: correct,
          wrongCount: wrong,
          unansweredCount: unanswered,
          percentFinal: pct,
          grade,
          isPass,
          passThresholdPercent: FINAL_EXAM_PASS_THRESHOLD_PERCENT,
          subjectRows,
        },
      });

      if (userId) {
        for (let i = 0; i < tq.length; i++) {
          const q = tq[i];
          const ua = answersSnap.get(i);
          if (ua === undefined) continue;
          const ok = ua === q.correctAnswer;
          answerQuestion(q.id, ua, ok);
          if (ok || isEphemeralQuestionId(q.id)) continue;
          try {
            const band = await getOrClassifyLevelBand(q);
            await saveWrongQuestion(userId, q.id, q.category || q.subject || 'General', {
              levelBand: band,
              isFirstTry: true,
            });
          } catch (e) {
            console.warn('final saveWrongQuestion', e);
          }
        }
      }

      updateProgress({ finalExamUnlocked: true });
      setTimeout(() => setShowCertificate(true), 1500);
      } catch (e) {
        console.warn('[FinalExam] submit', e);
      } finally {
        submittingRef.current = false;
      }
    })();
  }, [answerQuestion, setLastSessionResults, updateProgress]);

  useEffect(() => {
    submitTestRef.current = submitTest;
  }, [submitTest]);

  const handleSubmitClick = () => setShowSubmitDialog(true);
  const confirmSubmit = () => {
    setShowSubmitDialog(false);
    submitTest();
  };

  const handleExit = () => setShowExitDialog(true);
  const confirmExit = () => {
    clearFinalExamSession();
    if (attemptIdRef.current) void abandonFinalExamAttempt(attemptIdRef.current);
    setCurrentScreen('dashboard');
  };

  const isLast = currentQuestionIndex === testQuestions.length - 1;

  if (questionsLoading || loadingQueue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">
            Building final exam ({examSlotTarget} Q, {timerMinutesTotal} min)…
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
              clearFinalExamSession();
              setCurrentScreen('dashboard');
            }}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  if (bankQuestions.length === 0 || testQuestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center max-w-md p-6">
          <p className="text-muted-foreground mb-4">No questions available for the final exam queue.</p>
          <Button
            onClick={() => {
              clearFinalExamSession();
              setCurrentScreen('dashboard');
            }}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-purple-500/10 flex flex-col">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b-2 border-primary shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-lg tracking-tight">FINAL EXAMINATION</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {timerMinutesTotal}-min timed · {testQuestions.length} Q · Pass ≥{FINAL_EXAM_PASS_THRESHOLD_PERCENT}% (grades A+/A/B) ·
                    No hints · No retries
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/80 border font-mono text-lg font-bold ${getTimerColor()}`}
                >
                  <Clock className="w-5 h-5 shrink-0" />
                  {formatTime(timeLeft)}
                </div>
                <Button variant="outline" size="sm" onClick={handleSubmitClick} disabled={testCompleted}>
                  Submit
                </Button>
                <Button variant="destructive" size="sm" onClick={handleExit} className="gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Exit
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
              <span className="px-2 py-0.5 rounded-md bg-muted">
                Q{currentQuestionIndex + 1}/{testQuestions.length}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-muted">Answered {answeredCount}</span>
            </div>
            <Progress value={progress} className="h-2 mt-2" />
          </div>
        </header>

        <div className="flex-1 container mx-auto px-4 py-6 md:py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-6 md:p-8 border-2 border-primary/20 shadow-xl">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                        Q{currentQuestionIndex + 1}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-muted text-xs font-semibold">
                        {currentQuestion.category}
                      </span>
                      <LevelBandPill question={currentQuestion} />
                    </div>
                    <h2 className="text-xl md:text-2xl font-semibold leading-relaxed">{currentQuestion.question}</h2>
                  </div>

                  <div className="space-y-3 mb-6">
                    {currentQuestion.options.map((option, index) => (
                      <motion.button
                        key={index}
                        type="button"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleOptionSelect(index)}
                        className={`w-full text-left p-4 md:p-5 rounded-xl border-2 transition-all ${
                          selectedOption === index
                            ? 'border-primary bg-primary/10 ring-2 ring-primary shadow-lg'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
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

                  {navHint && <p className="text-sm text-destructive mb-4">{navHint}</p>}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t-2 border-border">
                    <Button variant="outline" size="lg" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
                      ← Previous
                    </Button>
                    <div className="text-sm text-muted-foreground text-center">
                      {answeredCount}/{testQuestions.length} answered
                      {navLocked && (
                        <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Select an answer to use the navigator.
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 justify-end">
                      {isLast ? (
                        <Button size="lg" onClick={handleSubmitClick} className="bg-success hover:bg-success/90" disabled={testCompleted}>
                          Submit final exam
                        </Button>
                      ) : (
                        <Button size="lg" onClick={handleNext} disabled={nextBlocked || testCompleted}>
                          Next →
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>

            <Card className="p-4 md:p-5 border border-primary/15 bg-card/80">
              <h3 className="font-semibold mb-1">Question navigator</h3>
              <p className="text-xs text-muted-foreground mb-3">Jump to a question. Must answer the current one first.</p>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                {testQuestions.map((_, index) => (
                  <button
                    type="button"
                    key={index}
                    disabled={navLocked}
                    onClick={() => {
                      if (navLocked) return;
                      stashAndGoTo(index);
                    }}
                    className={`aspect-square rounded-lg font-semibold text-sm transition-all ${
                      index === currentQuestionIndex
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                        : answers.has(index)
                          ? 'bg-success/15 text-success border border-success/40'
                          : 'bg-muted hover:bg-muted/70'
                    } ${navLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Submit final examination?
            </DialogTitle>
            <DialogDescription>
              You answered {answeredCount} of {testQuestions.length}. Unanswered items count as incorrect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Keep reviewing
            </Button>
            <Button onClick={confirmSubmit} className="bg-success hover:bg-success/90">
              Yes, submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Leave final exam?
            </DialogTitle>
            <DialogDescription>
              Your attempt will be abandoned and will not be scored. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Stay
            </Button>
            <Button variant="destructive" onClick={confirmExit}>
              Yes, exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCertificate} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-4"
          >
            <div
              className={`inline-flex items-center justify-center w-20 h-20 rounded-full mx-auto ${
                finalIsPass ? 'bg-gradient-to-r from-primary to-purple-500' : 'bg-destructive/20'
              }`}
            >
              <Award className={`w-10 h-10 ${finalIsPass ? 'text-white' : 'text-destructive'}`} />
            </div>
            <h2 className="text-2xl font-bold">
              {finalIsPass ? 'Final exam complete' : 'Final exam not passed'}
            </h2>
            <p className="text-muted-foreground">
              Score {finalPercent}% · Grade <span className="font-bold text-foreground">{finalGrade}</span>
              {finalIsPass ? ' · Pass' : ` · Need ≥${FINAL_EXAM_PASS_THRESHOLD_PERCENT}% to pass`}
            </p>
            <div className="rounded-xl border bg-muted/30 p-6">
              <div className="text-5xl font-bold text-primary">{finalPercent}%</div>
              <p className="text-sm text-muted-foreground mt-2">Final score</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                size="lg"
                onClick={() => {
                  setShowCertificate(false);
                  setCurrentScreen('results');
                }}
              >
                View detailed results
              </Button>
              {!finalIsPass && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setShowCertificate(false);
                    setCurrentScreen('dashboard');
                  }}
                >
                  Retake later
                </Button>
              )}
              <Button variant="outline" size="lg" className="gap-2" disabled>
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button variant="outline" size="lg" className="gap-2" disabled>
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {testCompleted && !showCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Scoring your final exam…</p>
          </div>
        </div>
      )}
    </>
  );
}
