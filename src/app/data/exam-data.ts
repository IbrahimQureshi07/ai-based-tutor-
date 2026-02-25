/**
 * EXAM DATA & TYPES
 * 
 * This file contains all the mock data for the AI-powered exam preparation platform.
 * 
 * FEATURES IMPLEMENTED:
 * - 10 diverse questions across multiple subjects and difficulty levels
 * - Detailed explanations for correct answers
 * - Specific feedback for why each wrong answer is incorrect
 * - Category-based organization for performance tracking
 * - AI suggestion system based on performance levels
 * 
 * USAGE:
 * - Questions are used across Practice, Mock, and Final exams
 * - User progress tracks accuracy, streak, readiness, and more
 * - AI suggestions adapt based on exam readiness percentage
 */

export interface Question {
  id: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  whyWrong: { [key: number]: string };
  category: string;
}

export interface UserProgress {
  level: number;
  accuracy: number;
  streak: number;
  examReadiness: number;
  hintsUsed: number;
  totalQuestions: number;
  correctAnswers: number;
  weakAreas: string[];
  completedAssessment: boolean;
  mockTestsCompleted: number;
  finalExamUnlocked: boolean;
  rank: string;
  todaysTarget: number;
  todaysCompleted: number;
}

/** Questions are loaded from Supabase via useQuestions() hook - see src/app/hooks/useQuestions.ts */

export const initialUserProgress: UserProgress = {
  level: 1,
  accuracy: 0,
  streak: 0,
  examReadiness: 0,
  hintsUsed: 0,
  totalQuestions: 0,
  correctAnswers: 0,
  weakAreas: [],
  completedAssessment: false,
  mockTestsCompleted: 0,
  finalExamUnlocked: false,
  rank: 'Beginner',
  todaysTarget: 10,
  todaysCompleted: 0
};

export const aiSuggestions = {
  low: [
    "Start with basics. Let's strengthen your foundation first! 💪",
    "Practice makes perfect. Focus on understanding concepts deeply.",
    "Take it slow. Quality over quantity matters here."
  ],
  medium: [
    "You're making progress! Try tackling harder questions now.",
    "Great momentum! Time to challenge yourself with advanced topics.",
    "You're doing well. Let's aim for 90% accuracy!"
  ],
  high: [
    "Excellent work! You're almost exam-ready. Keep it up! 🎉",
    "Outstanding progress! Focus on time management now.",
    "You're crushing it! Ready for the mock test?"
  ]
};