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

export const mockQuestions: Question[] = [
  {
    id: 'q1',
    subject: 'General Knowledge',
    difficulty: 'easy',
    question: 'What is the capital of India?',
    options: ['Mumbai', 'Delhi', 'Kolkata', 'Chennai'],
    correctAnswer: 1,
    explanation: 'New Delhi is the capital of India. It became the capital in 1911, replacing Kolkata.',
    whyWrong: {
      0: 'Mumbai is the financial capital but not the political capital.',
      2: 'Kolkata was the capital during British rule until 1911.',
      3: 'Chennai is a major city in South India but not the capital.'
    },
    category: 'Geography'
  },
  {
    id: 'q2',
    subject: 'History',
    difficulty: 'medium',
    question: 'In which year did India gain independence?',
    options: ['1942', '1945', '1947', '1950'],
    correctAnswer: 2,
    explanation: 'India gained independence from British rule on August 15, 1947.',
    whyWrong: {
      0: '1942 was the year of the Quit India Movement.',
      1: '1945 was when World War II ended.',
      3: '1950 was when India became a Republic and the Constitution came into effect.'
    },
    category: 'Indian History'
  },
  {
    id: 'q3',
    subject: 'Mathematics',
    difficulty: 'medium',
    question: 'What is the value of π (pi) approximately?',
    options: ['2.14', '3.14', '4.14', '5.14'],
    correctAnswer: 1,
    explanation: 'The value of π (pi) is approximately 3.14159, commonly rounded to 3.14.',
    whyWrong: {
      0: '2.14 is too low and not the correct approximation.',
      2: '4.14 is too high.',
      3: '5.14 is significantly higher than the actual value.'
    },
    category: 'Basic Mathematics'
  },
  {
    id: 'q4',
    subject: 'Science',
    difficulty: 'hard',
    question: 'What is the atomic number of Carbon?',
    options: ['4', '6', '8', '12'],
    correctAnswer: 1,
    explanation: 'Carbon has an atomic number of 6, meaning it has 6 protons in its nucleus.',
    whyWrong: {
      0: '4 is the atomic number of Beryllium.',
      2: '8 is the atomic number of Oxygen.',
      3: '12 is the atomic mass of the most common carbon isotope, not its atomic number.'
    },
    category: 'Chemistry'
  },
  {
    id: 'q5',
    subject: 'Current Affairs',
    difficulty: 'easy',
    question: 'Who is the current Prime Minister of India (as of 2026)?',
    options: ['Manmohan Singh', 'Narendra Modi', 'Rahul Gandhi', 'Amit Shah'],
    correctAnswer: 1,
    explanation: 'Narendra Modi is serving as the Prime Minister of India.',
    whyWrong: {
      0: 'Manmohan Singh was PM from 2004-2014.',
      2: 'Rahul Gandhi is a political leader but not the PM.',
      3: 'Amit Shah is the Home Minister, not the Prime Minister.'
    },
    category: 'Politics'
  },
  {
    id: 'q6',
    subject: 'English',
    difficulty: 'medium',
    question: 'What is the past tense of "run"?',
    options: ['Runned', 'Ran', 'Running', 'Runs'],
    correctAnswer: 1,
    explanation: '"Ran" is the correct past tense of the verb "run".',
    whyWrong: {
      0: '"Runned" is not a valid word in English.',
      2: '"Running" is the present participle, not past tense.',
      3: '"Runs" is the present tense third person singular.'
    },
    category: 'Grammar'
  },
  {
    id: 'q7',
    subject: 'Reasoning',
    difficulty: 'hard',
    question: 'If A = 1, B = 2, C = 3, what is the value of CAB?',
    options: ['123', '312', '321', '132'],
    correctAnswer: 1,
    explanation: 'CAB = 3, 1, 2 = 312.',
    whyWrong: {
      0: '123 would be ABC, not CAB.',
      2: '321 would be CBA.',
      3: '132 would be ACB.'
    },
    category: 'Logical Reasoning'
  },
  {
    id: 'q8',
    subject: 'Geography',
    difficulty: 'easy',
    question: 'Which is the largest state in India by area?',
    options: ['Uttar Pradesh', 'Maharashtra', 'Rajasthan', 'Madhya Pradesh'],
    correctAnswer: 2,
    explanation: 'Rajasthan is the largest state in India by area, covering 342,239 sq km.',
    whyWrong: {
      0: 'Uttar Pradesh is the largest by population, not area.',
      1: 'Maharashtra is the third largest state.',
      3: 'Madhya Pradesh is the second largest state.'
    },
    category: 'Indian Geography'
  },
  {
    id: 'q9',
    subject: 'Science',
    difficulty: 'medium',
    question: 'What is the speed of light in vacuum?',
    options: ['3 × 10⁸ m/s', '3 × 10⁶ m/s', '3 × 10⁵ m/s', '3 × 10⁷ m/s'],
    correctAnswer: 0,
    explanation: 'The speed of light in vacuum is approximately 3 × 10⁸ meters per second or 300,000 km/s.',
    whyWrong: {
      1: 'This is 100 times slower than the actual speed.',
      2: 'This is 1000 times slower than the actual speed.',
      3: 'This is 10 times slower than the actual speed.'
    },
    category: 'Physics'
  },
  {
    id: 'q10',
    subject: 'History',
    difficulty: 'hard',
    question: 'Who wrote the Indian National Anthem?',
    options: ['Bankim Chandra Chatterjee', 'Rabindranath Tagore', 'Sarojini Naidu', 'Mahatma Gandhi'],
    correctAnswer: 1,
    explanation: 'Rabindranath Tagore wrote "Jana Gana Mana", which was adopted as India\'s National Anthem.',
    whyWrong: {
      0: 'Bankim Chandra Chatterjee wrote "Vande Mataram", the national song.',
      2: 'Sarojini Naidu was a poet but did not write the national anthem.',
      3: 'Mahatma Gandhi was a freedom fighter, not the author of the anthem.'
    },
    category: 'Indian History'
  }
];

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