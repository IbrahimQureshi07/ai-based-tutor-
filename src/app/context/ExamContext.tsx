import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserProgress, initialUserProgress, Question } from '@/app/data/exam-data';
import { supabase } from '@/app/services/supabase';
import { loadPracticeState, loadAssessmentState } from '@/app/services/practiceStateStorage';
import type { TutorActiveMcq } from '@/app/utils/tutorOfficialContext';

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
  /** Current-test mistakes only: used for "Review Mistakes" → practice only these questions */
  reviewMistakesQuestions: Question[] | null;
  setReviewMistakesQuestions: (q: Question[] | null) => void;
  /** When true, PracticeTest builds queue from DB wrong questions + GPT (AI Assessment flow) */
  startPracticeWithWeakAreas: boolean;
  setStartPracticeWithWeakAreas: (v: boolean) => void;
  /** Restored from sessionStorage so user can continue test after reload/tab switch (full questions = GPT survives) */
  restoredPracticeState: { questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation: string; whyWrong: Record<number, string>; subject: string; category: string; difficulty: string }>; questionIds?: string[]; currentIndex: number } | null;
  setRestoredPracticeState: (v: { questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation: string; whyWrong: Record<number, string>; subject: string; category: string; difficulty: string }>; questionIds?: string[]; currentIndex: number } | null) => void;
  /** Restored assessment (full questions) so tab switch doesn't lose assessment test */
  restoredAssessmentState: { questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation: string; whyWrong: Record<number, string>; subject: string; category: string; difficulty: string }>; currentIndex: number } | null;
  setRestoredAssessmentState: (v: { questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation: string; whyWrong: Record<number, string>; subject: string; category: string; difficulty: string }>; currentIndex: number } | null) => void;
  /** Last test session stats for Results page (dynamic charts) */
  lastSessionResults: {
    total: number;
    correct: number;
    incorrect: number;
    byDifficulty: Record<string, { correct: number; total: number }>;
    byCategory: Record<string, { correct: number; total: number }>;
    /** Bank question IDs missed on first try (practice) — same list drives weak-area practice from Results */
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
  } | null;
  setLastSessionResults: (v: AppContextType['lastSessionResults']) => void;
  /**
   * Set when opening weak practice from Results (weak bank IDs from that session).
   * null = opened from Dashboard / use historical DB wrongs.
   */
  pendingWeakPracticeBankIds: string[] | null;
  setPendingWeakPracticeBankIds: (v: string[] | null) => void;
  /** Which test flow opened the subject picker. */
  subjectSelectFor: 'practice' | 'mock' | 'assessment';
  setSubjectSelectFor: (v: 'practice' | 'mock' | 'assessment') => void;
  /** Chosen topic for Practice Test (first 25 from sheet for that subject). */
  selectedPracticeSubject: string | null;
  setSelectedPracticeSubject: (v: string | null) => void;
  /** Chosen topic for Mock Test (all questions for that subject). */
  selectedMockSubject: string | null;
  setSelectedMockSubject: (v: string | null) => void;
  /** Stage 1 assessment topic (`SUBJECTS[].key`). */
  selectedAssessmentTopic: string | null;
  setSelectedAssessmentTopic: (v: string | null) => void;
  /** Subjects whose practice test has been fully completed this session. */
  completedPracticeSubjects: string[];
  markPracticeSubjectDone: (subject: string) => void;
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
  const [reviewMistakesQuestions, setReviewMistakesQuestions] = useState<Question[] | null>(null);
  const [startPracticeWithWeakAreas, setStartPracticeWithWeakAreas] = useState(false);
  const [restoredPracticeState, setRestoredPracticeState] = useState<{ questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation: string; whyWrong: Record<number, string>; subject: string; category: string; difficulty: string }>; questionIds?: string[]; currentIndex: number } | null>(null);
  const [restoredAssessmentState, setRestoredAssessmentState] = useState<{ questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation: string; whyWrong: Record<number, string>; subject: string; category: string; difficulty: string }>; currentIndex: number } | null>(null);
  const [lastSessionResults, setLastSessionResults] = useState<AppContextType['lastSessionResults']>(null);
  const [pendingWeakPracticeBankIds, setPendingWeakPracticeBankIds] = useState<string[] | null>(null);
  const [subjectSelectFor, setSubjectSelectFor] = useState<'practice' | 'mock' | 'assessment'>('practice');
  const [selectedPracticeSubject, setSelectedPracticeSubject] = useState<string | null>(null);
  const [selectedMockSubject, setSelectedMockSubject] = useState<string | null>(null);
  const [selectedAssessmentTopic, setSelectedAssessmentTopic] = useState<string | null>(null);
  const [completedPracticeSubjects, setCompletedPracticeSubjects] = useState<string[]>([]);

  const markPracticeSubjectDone = (subject: string) => {
    setCompletedPracticeSubjects((prev) =>
      prev.includes(subject) ? prev : [...prev, subject]
    );
  };

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
          setRestoredAssessmentState({ questions: assessmentSaved.questions, currentIndex: assessmentSaved.currentIndex });
          setCurrentScreen('practice');
        } else if (practiceSaved && (practiceSaved.questions.length > 0 || (practiceSaved.questionIds && practiceSaved.questionIds.length > 0))) {
          setRestoredPracticeState({
            questions: practiceSaved.questions || [],
            questionIds: practiceSaved.questionIds,
            currentIndex: practiceSaved.currentIndex,
          });
          setCurrentScreen('practice');
        } else {
          setCurrentScreen('dashboard');
        }
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
          setRestoredAssessmentState({ questions: assessmentSaved.questions, currentIndex: assessmentSaved.currentIndex });
          setCurrentScreen('practice');
        } else if (practiceSaved && (practiceSaved.questions.length > 0 || (practiceSaved.questionIds && practiceSaved.questionIds.length > 0))) {
          setRestoredPracticeState({
            questions: practiceSaved.questions || [],
            questionIds: practiceSaved.questionIds,
            currentIndex: practiceSaved.currentIndex,
          });
          setCurrentScreen('practice');
        } else {
          setCurrentScreen('dashboard');
        }
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
      
      // Exam readiness: after 5+ questions, readiness = accuracy (so 80% accuracy unlocks Mock Test)
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
        reviewMistakesQuestions,
        setReviewMistakesQuestions,
        startPracticeWithWeakAreas,
        setStartPracticeWithWeakAreas,
        restoredPracticeState,
        setRestoredPracticeState,
        restoredAssessmentState,
        setRestoredAssessmentState,
        lastSessionResults,
        setLastSessionResults,
        pendingWeakPracticeBankIds,
        setPendingWeakPracticeBankIds,
        subjectSelectFor,
        setSubjectSelectFor,
        selectedPracticeSubject,
        setSelectedPracticeSubject,
        selectedMockSubject,
        setSelectedMockSubject,
        selectedAssessmentTopic,
        setSelectedAssessmentTopic,
        completedPracticeSubjects,
        markPracticeSubjectDone,
        activeTutorMcq,
        setActiveTutorMcq,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
