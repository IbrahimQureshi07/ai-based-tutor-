import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/app/context/AppContext';
import { Question } from '@/app/context/AppContext';
import { getRandomQuestions, generateAIHint } from '@/app/data/questions';
import {
  ArrowLeft,
  Lightbulb,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MessageCircle,
  Trophy,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { Card } from '@/app/components/ui/card';
import { AIChatbot } from './AIChatbot';
import { toast } from 'sonner';

export const Practice: React.FC = () => {
  const { state, updateProgress, resetHintsForSession } = useApp();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState('');
  const [score, setScore] = useState(0);
  const [hintsUsedInSession, setHintsUsedInSession] = useState(0);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiChatQuestion, setAiChatQuestion] = useState('');

  const MAX_HINTS = 5;

  useEffect(() => {
    const newQuestions = getRandomQuestions(10);
    setQuestions(newQuestions);
    resetHintsForSession();
  }, []);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleHint = () => {
    if (hintsUsedInSession >= MAX_HINTS) {
      toast.error('You have used all available hints for this session');
      return;
    }
    if (currentQuestion) {
      const generatedHint = generateAIHint(currentQuestion);
      setHint(generatedHint);
      setShowHint(true);
      setHintsUsedInSession((prev) => prev + 1);
      toast.info('Hint revealed');
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (isAnswered) return;
    setSelectedAnswer(answerIndex);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;
    
    setIsAnswered(true);
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    if (isCorrect) {
      setScore((prev) => prev + 1);
      toast.success('Correct! Well done!', {
        icon: <CheckCircle2 className="w-5 h-5" />,
      });
    } else {
      toast.error('Incorrect. Review the explanation.', {
        icon: <XCircle className="w-5 h-5" />,
      });
      
      // Track mistakes
      const mistakesCount = { ...state.progress.mistakesCount };
      mistakesCount[currentQuestion.topic] = (mistakesCount[currentQuestion.topic] || 0) + 1;
      updateProgress({ mistakesCount });
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setShowHint(false);
      setHint('');
    } else {
      // Complete practice session
      const accuracy = (score / questions.length) * 100;
      const newTotalQuestions = state.progress.totalQuestions + questions.length;
      const newCompletedPractice = state.progress.completedPractice + 1;
      const currentAccuracy = state.progress.accuracy;
      const newAccuracy = Math.round(
        (currentAccuracy * state.progress.completedPractice + accuracy) / newCompletedPractice
      );

      updateProgress({
        accuracy: newAccuracy,
        totalQuestions: newTotalQuestions,
        completedPractice: newCompletedPractice,
        hintsUsed: state.progress.hintsUsed + hintsUsedInSession,
        aiConfidence: Math.min(95, newAccuracy + Math.floor(Math.random() * 10)),
        streak: state.progress.streak + (accuracy >= 70 ? 1 : 0),
      });

      navigate('/results', {
        state: {
          score,
          total: questions.length,
          accuracy,
        },
      });
    }
  };

  const handleSimilarQuestion = () => {
    toast.info('Loading similar question...');
    // In a real app, this would fetch a similar question based on topic
    setTimeout(() => {
      const similarQuestions = getRandomQuestions(1, currentQuestion.difficulty);
      if (similarQuestions.length > 0) {
        questions[currentIndex] = similarQuestions[0];
        setQuestions([...questions]);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setShowHint(false);
      }
    }, 500);
  };

  const handleAskAI = () => {
    setAiChatQuestion(
      `I got this question wrong: "${currentQuestion.text}". Can you help me understand why the correct answer is "${currentQuestion.options[currentQuestion.correctAnswer]}"?`
    );
    setShowAIChat(true);
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">Score: </span>
              <span className="font-bold">{score}/{questions.length}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">Hints: </span>
              <span className="font-bold">{hintsUsedInSession}/{MAX_HINTS}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-2">
          <div className="flex justify-between text-sm mb-1">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </motion.div>

      {/* Question Card */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="max-w-4xl mx-auto"
      >
        <Card className="p-6 md:p-8 backdrop-blur-xl bg-white/70 dark:bg-gray-800/70 border-white/20 mb-6">
          {/* Question Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-semibold">
                {currentQuestion.topic}
              </span>
              <span className={`ml-2 px-3 py-1 rounded-full text-sm font-semibold ${
                currentQuestion.difficulty === 'easy'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : currentQuestion.difficulty === 'medium'
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {currentQuestion.difficulty}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHint}
              disabled={isAnswered || showHint || hintsUsedInSession >= MAX_HINTS}
            >
              <Lightbulb className="w-4 h-4 mr-2" />
              Hint
            </Button>
          </div>

          {/* Question Text */}
          <h2 className="text-2xl font-bold mb-6">{currentQuestion.text}</h2>

          {/* Hint */}
          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
              >
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">AI Hint</p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">{hint}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = index === currentQuestion.correctAnswer;
              const showCorrect = isAnswered && isCorrect;
              const showWrong = isAnswered && isSelected && !isCorrect;

              return (
                <motion.button
                  key={index}
                  whileHover={!isAnswered ? { scale: 1.01 } : {}}
                  whileTap={!isAnswered ? { scale: 0.99 } : {}}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={isAnswered}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    showCorrect
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600'
                      : showWrong
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-600'
                      : isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-primary'
                      : 'bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-primary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                          showCorrect
                            ? 'bg-green-500 text-white'
                            : showWrong
                            ? 'bg-red-500 text-white'
                            : isSelected
                            ? 'bg-primary text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="font-medium">{option}</span>
                    </div>
                    {showCorrect && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                    {showWrong && <XCircle className="w-6 h-6 text-red-500" />}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Explanation */}
          <AnimatePresence>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6"
              >
                <Card className={`p-4 ${
                  selectedAnswer === currentQuestion.correctAnswer
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <h3 className="font-semibold mb-2">
                    {selectedAnswer === currentQuestion.correctAnswer ? 'Correct!' : 'Incorrect'}
                  </h3>
                  <p className="text-sm mb-4">{currentQuestion.explanation}</p>
                  
                  {selectedAnswer !== currentQuestion.correctAnswer && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button size="sm" variant="outline" onClick={handleSimilarQuestion}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Similar Question
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleAskAI}>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Ask AI Tutor
                      </Button>
                    </div>
                  )}

                  {selectedAnswer === currentQuestion.correctAnswer && currentIndex === questions.length - 1 && (
                    <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-600" />
                        <span className="font-semibold">Practice session complete!</span>
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            {!isAnswered ? (
              <Button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null}
                size="lg"
              >
                Submit Answer
              </Button>
            ) : (
              <Button onClick={handleNext} size="lg">
                {currentIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
              </Button>
            )}
          </div>
        </Card>
      </motion.div>

      {/* AI Chatbot */}
      {(showAIChat || state.progress.completedPractice > 0) && (
        <AIChatbot initialQuestion={aiChatQuestion} />
      )}
    </div>
  );
};
