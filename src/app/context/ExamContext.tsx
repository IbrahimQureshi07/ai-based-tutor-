import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserProgress, initialUserProgress, Question } from '@/app/data/exam-data';
import { supabase } from '@/app/services/supabase';
import {
  loadPracticeState,
  loadAssessmentState,
  clearPracticeState,
  clearAssessmentState,
} from '@/app/services/practiceStateStorage';
import type { TutorActiveMcq } from '@/app/utils/tutorOfficialContext';
import type { MistakesTestCombinedAnalyticsPayload } from '@/app/utils/buildMistakesTestCombinedAnalytics';

interface AppContextType {
  userProgress: UserProgress;
  updateProgress: (updates: Partial<UserProgress>) => void;
  currentScreen: string;
  setCurrentScreen: (screen: string) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  userName: string;
  setUserName: (name: string) => void;
  answeredQuestions: Map<string, { userAnswer: number; correct: boolean }>;
  answerQuestion: (questionId: string, userAnswer: number, correct: boolean) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  chatMessages: Array<{ role: 'user' | 'ai'; content: string; timestamp: Date }>;
  addChatMessage: (role: 'user' | 'ai', content: string) => void;
  mistakesList: Array<{ question: Question; userAnswer: number; count: number }>;
  addMistake: (question: Question, userAnswer: number) => void;
  /** Last test session stats for Results page (dynamic charts) */
  lastSessionResults: {
    total: number;
    correct: number;
    incorrect: number;
    byDifficulty: Record<string, { correct: number; total: number }>;
    byCategory: Record<string, { correct: number; total: number }>;
    /** Bank question IDs missed on first try (legacy practice test; optional on other flows) */
    weakBankQuestionIds?: string[];
    /** Stage 1 topic assessment (35 Q) — when set, Results shows full topic report */
    stageOneAssessment?: {
      topicCode: string;
      topicLabel: string;
      totalQuestions: number;
      correctFirstTry: number;
      mediumWrong: number;
      hardWrong: number;
      skipped: number;
      rawScore: number;
      adjustedScore: number;
      statusBand: 'STRONG' | 'AVERAGE' | 'WEAK' | 'CRITICAL';
      easyCorrect: number;
      easyTotal: number;
      mediumCorrect: number;
      mediumTotal: number;
      hardCorrect: number;
      hardTotal: number;
      narrative: string;
    };
    /** Stage 2 cross-topic preparation (variable length, up to 110) */
    stageTwoAssessment?: {
      topicCode: string;
      topicLabel: string;
      totalQuestions: number;
      correctFirstTry: number;
      mediumWrong: number;
      hardWrong: number;
      skipped: number;
      rawScore: number;
      adjustedScore: number;
      statusBand: 'STRONG' | 'AVERAGE' | 'WEAK' | 'CRITICAL';
      easyCorrect: number;
      easyTotal: number;
      mediumCorrect: number;
      mediumTotal: number;
      hardCorrect: number;
      hardTotal: number;
      narrative: string;
    };
    /** Stage 2 only: per-topic Stage 1 snapshot vs this Stage 2 run (before/after analytics) */
    stageTwoProgressAnalytics?: {
      topicsCompared: Array<{
        topicCode: string;
        topicLabel: string;
        stageOneHasAttempt: boolean;
        stageOneCorrectFirstTry: number;
        stageOneMediumWrong: number;
        stageOneHardWrong: number;
        stageOneSkipped: number;
        stageOneTotalQuestions: number;
        stageOneRawScore: number;
        stageTwoSlotCount: number;
        stageTwoCorrectFirstTry: number;
        stageTwoMediumWrong: number;
        stageTwoHardWrong: number;
        stageTwoSkipped: number;
      }>;
      summary: {
        stageOneTopicsAttempted: number;
        /** Sum of first-try correct ÷ sum of question totals (topics with a completed Stage 1) */
        stageOneWeightedFirstTryPercent: number | null;
        /** Arithmetic mean of per-topic first-try % (attempted topics only) */
        stageOneAvgFirstTryPercent: number | null;
        stageOneSkipsSum: number;
        stageTwoTotalSlots: number;
        stageTwoCorrectFirstTry: number;
        stageTwoFirstTryPercent: number;
        stageTwoSkippedTotal: number;
      };
    };
    /** Stage 2.5 — Mistakes test (past mistakes + weighted fresh) */
    mistakesTestAssessment?: {
      topicCode: string;
      topicLabel: string;
      totalQuestions: number;
      correctFirstTry: number;
      mediumWrong: number;
      hardWrong: number;
      skipped: number;
      rawScore: number;
      adjustedScore: number;
      statusBand: 'STRONG' | 'AVERAGE' | 'WEAK' | 'CRITICAL';
      easyCorrect: number;
      easyTotal: number;
      mediumCorrect: number;
      mediumTotal: number;
      hardCorrect: number;
      hardTotal: number;
      narrative: string;
      unresolvedQuestionIds: string[];
      teacherAlertSent: boolean;
    };
    /**
     * Populated when finishing Stage 2.5: S1 rollups + latest S2 attempt (DB) + this mistakes run,
     * for a single combined Results overview.
     */
    mistakesTestCombinedAnalytics?: MistakesTestCombinedAnalyticsPayload;
    /** Full mock (queue-built): slot-final %, retry stats, per-topic CRITICAL gate (≥90% still fails if any topic CRITICAL). */
    mockTestAssessment?: {
      totalSlots: number;
      correctSlotsFinal: number;
      skippedSlots: number;
      percentFinal: number;
      /** First-try correct ÷ total slots × 100 */
      firstTryPercent: number;
      passThresholdPercent: number;
      firstTryCorrectCount: number;
      retryUsedCount: number;
      retryCorrectCount: number;
      retryWrongCount: number;
      hasCriticalBand: boolean;
      isPass: boolean;
      /** When not passed: score vs CRITICAL topic rule */
      failReason: null | 'below_threshold' | 'critical_topic' | 'both';
      narrative: string;
    };
    /** Final exam (110 Q or admin 15): no retry; grade A+ / A / B / Fail; pass ≥ threshold. */
    finalExamAssessment?: {
      totalSlots: number;
      correctCount: number;
      wrongCount: number;
      unansweredCount: number;
      percentFinal: number;
      grade: 'A+' | 'A' | 'B' | 'Fail';
      isPass: boolean;
      passThresholdPercent: number;
      /** Per catalog subject (SUBJECTS): Good ≥75% · Average 50–74% · Weak &lt;50% */
      subjectRows: Array<{
        label: string;
        correct: number;
        total: number;
        percent: number;
        band: 'strong' | 'average' | 'weak';
      }>;
    };
  } | null;
  setLastSessionResults: (v: AppContextType['lastSessionResults']) => void;
  /** Which test flow opened the subject picker. */
  subjectSelectFor: 'mock' | 'assessment';
  setSubjectSelectFor: (v: 'mock' | 'assessment') => void;
  /** Chosen topic for Mock Test (all questions for that subject). */
  selectedMockSubject: string | null;
  setSelectedMockSubject: (v: string | null) => void;
  /** Stage 1 assessment topic (`SUBJECTS[].key`). */
  selectedAssessmentTopic: string | null;
  setSelectedAssessmentTopic: (v: string | null) => void;
  /** MCQ currently on screen (practice/mock) — AI tutor must match this key. */
  activeTutorMcq: TutorActiveMcq | null;
  setActiveTutorMcq: (v: TutorActiveMcq | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [userProgress, setUserProgress] = useState<UserProgress>(initialUserProgress);
  const [currentScreen, setCurrentScreen] = useState('auth');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const [answeredQuestions, setAnsweredQuestions] = useState<Map<string, { userAnswer: number; correct: boolean }>>(new Map());
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; content: string; timestamp: Date }>>([]);
  const [mistakesList, setMistakesList] = useState<Array<{ question: Question; userAnswer: number; count: number }>>([]);
  const [lastSessionResults, setLastSessionResults] = useState<AppContextType['lastSessionResults']>(null);
  const [subjectSelectFor, setSubjectSelectFor] = useState<'mock' | 'assessment'>('assessment');
  const [selectedMockSubject, setSelectedMockSubject] = useState<string | null>(null);
  const [selectedAssessmentTopic, setSelectedAssessmentTopic] = useState<string | null>(null);

  const [activeTutorMcq, setActiveTutorMcq] = useState<TutorActiveMcq | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Restore Supabase session on load and listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name = session.user.user_metadata?.full_name || session.user.email || '';
        setUserName(name);
        setIsAuthenticated(true);
        const assessmentSaved = loadAssessmentState();
        const practiceSaved = loadPracticeState();
        if (assessmentSaved && assessmentSaved.questions.length > 0) {
          clearAssessmentState();
        }
        if (
          practiceSaved &&
          (practiceSaved.questions.length > 0 ||
            (practiceSaved.questionIds && practiceSaved.questionIds.length > 0))
        ) {
          clearPracticeState();
        }
        setCurrentScreen('dashboard');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const name = session.user.user_metadata?.full_name || session.user.email || '';
        setUserName(name);
        setIsAuthenticated(true);
        // Token refresh (e.g. returning to the tab) must not reset navigation — otherwise
        // Results and other screens jump to dashboard when practice storage was cleared.
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          return;
        }
        const assessmentSaved = loadAssessmentState();
        const practiceSaved = loadPracticeState();
        if (assessmentSaved && assessmentSaved.questions.length > 0) {
          clearAssessmentState();
        }
        if (
          practiceSaved &&
          (practiceSaved.questions.length > 0 ||
            (practiceSaved.questionIds && practiceSaved.questionIds.length > 0))
        ) {
          clearPracticeState();
        }
        setCurrentScreen('dashboard');
      } else {
        setUserName('');
        setIsAuthenticated(false);
        setCurrentScreen('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateProgress = (updates: Partial<UserProgress>) => {
    setUserProgress(prev => {
      const newProgress = { ...prev, ...updates };
      
      // Exam readiness: after 5+ questions, readiness = accuracy (used for rank/progress visuals)
      const questionsCompleted = newProgress.totalQuestions;
      const accuracy = newProgress.accuracy;
      const readiness = questionsCompleted >= 5
        ? accuracy
        : (questionsCompleted / 5) * accuracy;
      newProgress.examReadiness = Math.min(100, Math.round(readiness));

      // Update rank based on readiness
      if (readiness >= 90) newProgress.rank = 'Expert';
      else if (readiness >= 70) newProgress.rank = 'Advanced';
      else if (readiness >= 50) newProgress.rank = 'Intermediate';
      else if (readiness >= 30) newProgress.rank = 'Learner';
      else newProgress.rank = 'Beginner';

      return newProgress;
    });
  };

  const answerQuestion = (questionId: string, userAnswer: number, correct: boolean) => {
    setAnsweredQuestions(prev => new Map(prev).set(questionId, { userAnswer, correct }));
    
    // Update progress
    const totalQuestions = userProgress.totalQuestions + 1;
    const correctAnswers = userProgress.correctAnswers + (correct ? 1 : 0);
    const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
    const streak = correct ? userProgress.streak + 1 : 0;
    const todaysCompleted = userProgress.todaysCompleted + 1;

    updateProgress({
      totalQuestions,
      correctAnswers,
      accuracy,
      streak,
      todaysCompleted,
      level: Math.floor(totalQuestions / 10) + 1
    });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const addChatMessage = (role: 'user' | 'ai', content: string) => {
    setChatMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  };

  const addMistake = (question: Question, userAnswer: number) => {
    setMistakesList(prev => {
      const existing = prev.find(m => m.question.id === question.id);
      if (existing) {
        return prev.map(m => 
          m.question.id === question.id 
            ? { ...m, count: m.count + 1 }
            : m
        );
      }
      return [...prev, { question, userAnswer, count: 1 }];
    });
  };

  return (
    <AppContext.Provider
      value={{
        userProgress,
        updateProgress,
        currentScreen,
        setCurrentScreen,
        isAuthenticated,
        setIsAuthenticated,
        userName,
        setUserName,
        answeredQuestions,
        answerQuestion,
        theme,
        toggleTheme,
        chatOpen,
        setChatOpen,
        chatMessages,
        addChatMessage,
        mistakesList,
        addMistake,
        lastSessionResults,
        setLastSessionResults,
        subjectSelectFor,
        setSubjectSelectFor,
        selectedMockSubject,
        setSelectedMockSubject,
        selectedAssessmentTopic,
        setSelectedAssessmentTopic,
        activeTutorMcq,
        setActiveTutorMcq,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export type StageTwoProgressAnalyticsPayload = NonNullable<
  NonNullable<AppContextType['lastSessionResults']>['stageTwoProgressAnalytics']
>;

export type { MistakesTestCombinedAnalyticsPayload };

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
