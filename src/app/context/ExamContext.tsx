import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserProgress, initialUserProgress, Question } from '@/app/data/exam-data';
import { supabase } from '@/app/services/supabase';

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
        setCurrentScreen('dashboard');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const name = session.user.user_metadata?.full_name || session.user.email || '';
        setUserName(name);
        setIsAuthenticated(true);
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
      
      // Update exam readiness based on accuracy and progress
      const questionsCompleted = newProgress.totalQuestions;
      const accuracy = newProgress.accuracy;
      const readiness = Math.min(100, Math.floor((questionsCompleted / 50) * accuracy));
      newProgress.examReadiness = readiness;

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
        addMistake
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
