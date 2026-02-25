import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import { Question } from '@/app/data/exam-data';
import { useQuestions } from '@/app/hooks/useQuestions';
import {
  ArrowLeft,
  Lightbulb,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MessageCircle,
  ChevronRight
} from 'lucide-react';

export function PracticeTest() {
  const { setCurrentScreen, answerQuestion, userProgress, updateProgress, setChatOpen, addChatMessage, addMistake } = useApp();
  const { questions, loading: questionsLoading, error: questionsError } = useQuestions();
  const [questionQueue, setQuestionQueue] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [practiceScore, setPracticeScore] = useState({ correct: 0, total: 0 });
  const [wrongQuestionsCount, setWrongQuestionsCount] = useState<Map<string, number>>(new Map());
  const [isRetryQuestion, setIsRetryQuestion] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    if (questions.length > 0 && questionQueue.length === 0) {
      setQuestionQueue([...questions]);
    }
  }, [questions, questionQueue.length]);

  const currentQuestion = questionQueue[currentQuestionIndex];
  const progress = questionQueue.length ? ((currentQuestionIndex + 1) / questionQueue.length) * 100 : 0;
  const maxHints = 5;

  if (questionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }
  if (questionsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center max-w-md p-6">
          <p className="text-destructive mb-4">{questionsError}</p>
          <Button onClick={() => setCurrentScreen('dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center max-w-md p-6">
          <p className="text-muted-foreground mb-4">No questions available. Add questions in Supabase.</p>
          <Button onClick={() => setCurrentScreen('dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }
  if (questionQueue.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Preparing questions...</p>
        </div>
      </div>
    );
  }

  const handleOptionSelect = (index: number) => {
    if (showResult) return;
    setSelectedOption(index);
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;

    const correct = selectedOption === currentQuestion.correctAnswer;
    setIsCorrect(correct);
    setShowResult(true);
    answerQuestion(currentQuestion.id, selectedOption, correct);

    if (!correct) {
      addMistake(currentQuestion, selectedOption);
      
      // Track wrong attempts
      const wrongCount = wrongQuestionsCount.get(currentQuestion.id) || 0;
      setWrongQuestionsCount(new Map(wrongQuestionsCount).set(currentQuestion.id, wrongCount + 1));
      
      // Add this question back to the queue if not already there
      // This ensures the student must answer it correctly before moving on
      setIsRetryQuestion(true);
      
      // Show encouraging message
      addChatMessage('ai', `Don't worry! I'll help you understand this better. Let's try this question again until you get it right! 💪`);
    } else {
      // If correct and it was a retry, remove from wrong count
      if (isRetryQuestion) {
        const newWrongCount = new Map(wrongQuestionsCount);
        newWrongCount.delete(currentQuestion.id);
        setWrongQuestionsCount(newWrongCount);
        setIsRetryQuestion(false);
      }
    }

    // Update assessment completion on first practice
    if (!userProgress.completedAssessment && currentQuestionIndex >= 4) {
      updateProgress({ completedAssessment: true });
    }

    // Update practice score
    setPracticeScore(prev => ({
      correct: correct ? prev.correct + 1 : prev.correct,
      total: prev.total + 1
    }));
  };

  const handleNext = async () => {
    // When answer was wrong: get a similar question from GPT and show it
    if (!isCorrect) {
      setLoadingSimilar(true);
      try {
        const { generateSimilarQuestion } = await import('@/app/services/aiService');
        const similar = await generateSimilarQuestion(
          currentQuestion.question,
          currentQuestion.subject || currentQuestion.category,
          currentQuestion.difficulty
        );
        const newQuestion: Question = {
          id: `similar-${Date.now()}`,
          question: similar.question,
          options: similar.options,
          correctAnswer: similar.correctAnswer,
          explanation: similar.explanation,
          whyWrong: {},
          subject: similar.category,
          category: similar.category,
          difficulty: currentQuestion.difficulty,
        };
        const newQueue = [...questionQueue];
        newQueue.splice(currentQuestionIndex + 1, 0, newQuestion);
        setQuestionQueue(newQueue);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedOption(null);
        setShowResult(false);
        setShowHint(false);
        setIsRetryQuestion(true);
        addChatMessage('ai', "Here's a similar question to practice. Try to get this one right! 📝");
      } catch (err) {
        // If GPT fails, just reset so they can try same question again
        setSelectedOption(null);
        setShowResult(false);
        setShowHint(false);
      } finally {
        setLoadingSimilar(false);
      }
      return;
    }

    // If correct, move to next question
    if (currentQuestionIndex < questionQueue.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setShowResult(false);
      setShowHint(false);
      setIsRetryQuestion(false);
    } else {
      // Check if there are any wrong questions that need to be retried
      const hasWrongQuestions = wrongQuestionsCount.size > 0;
      
      if (hasWrongQuestions) {
        // Add wrong questions back to queue
        const wrongQuestionIds = Array.from(wrongQuestionsCount.keys());
        const questionsToRetry = questions.filter(q => wrongQuestionIds.includes(q.id));
        
        if (questionsToRetry.length > 0) {
          setQuestionQueue([...questionQueue, ...questionsToRetry]);
          setCurrentQuestionIndex(currentQuestionIndex + 1);
          setSelectedOption(null);
          setShowResult(false);
          setShowHint(false);
          setIsRetryQuestion(true);
          addChatMessage('ai', `Great progress! Now let's review the questions you got wrong. You need to answer them correctly to complete the practice! 📚`);
          return;
        }
      }
      
      // All questions answered correctly, show results
      setCurrentScreen('results');
    }
  };

  const handleHint = () => {
    if (hintsUsed < maxHints) {
      setShowHint(true);
      setHintsUsed(hintsUsed + 1);
      updateProgress({ hintsUsed: userProgress.hintsUsed + 1 });
    }
  };

  const handleAskAI = async () => {
    setChatOpen(true);
    const userMessage = `Can you explain this question: "${currentQuestion.question}"`;
    addChatMessage('user', userMessage);
    
    // Use real AI service if available, otherwise fallback
    try {
      const { getChatbotResponse } = await import('@/app/services/aiService');
      const response = await getChatbotResponse(userMessage, {
        currentSubject: currentQuestion.subject,
        currentQuestion: currentQuestion.question,
        userProgress: {
          accuracy: userProgress.accuracy,
          weakAreas: userProgress.weakAreas,
          level: userProgress.level,
        },
      });
      addChatMessage('ai', response);
    } catch (error) {
      // Fallback to basic explanation
      addChatMessage('ai', `Great question! ${currentQuestion.explanation} The correct answer is option ${currentQuestion.correctAnswer + 1}: "${currentQuestion.options[currentQuestion.correctAnswer]}". ${selectedOption !== null && currentQuestion.whyWrong[selectedOption] ? currentQuestion.whyWrong[selectedOption] : ''}`);
    }
  };

  const handleSimilarQuestion = () => {
    // Find a question from the same category
const similarQuestions = questions.filter(q =>
      q.category === currentQuestion.category && q.id !== currentQuestion.id
    );
    if (similarQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * similarQuestions.length);
      const questionToShow = similarQuestions[randomIndex];
      const idxInQueue = questionQueue.findIndex(q => q.id === questionToShow.id);
      const newIndex = idxInQueue >= 0 ? idxInQueue : questionQueue.length;
      if (idxInQueue < 0) {
        setQuestionQueue([...questionQueue, questionToShow]);
      }
      setCurrentQuestionIndex(newIndex);
      setSelectedOption(null);
      setShowResult(false);
      setShowHint(false);
    }
  };

  const getOptionClass = (index: number) => {
    if (!showResult) {
      return selectedOption === index
        ? 'border-primary bg-primary/10 ring-2 ring-primary'
        : 'border-border hover:border-primary/50 hover:bg-muted/50';
    }

    if (index === currentQuestion.correctAnswer) {
      return 'border-success bg-success/10 ring-2 ring-success';
    }

    if (index === selectedOption && !isCorrect) {
      return 'border-destructive bg-destructive/10 ring-2 ring-destructive';
    }

    return 'border-border opacity-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-card/80 border-b border-border/50 px-4 py-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentScreen('dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
            <div className="text-sm font-medium">
              Question {currentQuestionIndex + 1} of {questionQueue.length}
              {isRetryQuestion && (
                <span className="ml-2 px-2 py-1 rounded-full bg-warning/10 text-warning text-xs">
                  Retry
                </span>
              )}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-6 md:p-8 mb-6">
                {/* Question Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {currentQuestion.category}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        currentQuestion.difficulty === 'easy' 
                          ? 'bg-success/10 text-success'
                          : currentQuestion.difficulty === 'medium'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {currentQuestion.difficulty.charAt(0).toUpperCase() + currentQuestion.difficulty.slice(1)}
                      </span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-semibold">
                      {currentQuestion.question}
                    </h2>
                    {isRetryQuestion && !showResult && (
                      <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                        <p className="text-sm text-warning flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" />
                          <span>This question was answered incorrectly. Please try again until you get it right!</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3 mb-6">
                  {currentQuestion.options.map((option, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ scale: showResult ? 1 : 1.02 }}
                      whileTap={{ scale: showResult ? 1 : 0.98 }}
                    >
                      <button
                        onClick={() => handleOptionSelect(index)}
                        disabled={showResult}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${getOptionClass(index)}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                            showResult && index === currentQuestion.correctAnswer
                              ? 'bg-success text-success-foreground'
                              : showResult && index === selectedOption && !isCorrect
                              ? 'bg-destructive text-destructive-foreground'
                              : selectedOption === index
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}>
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span className="flex-1">{option}</span>
                          {showResult && index === currentQuestion.correctAnswer && (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          )}
                          {showResult && index === selectedOption && !isCorrect && (
                            <XCircle className="w-5 h-5 text-destructive" />
                          )}
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>

                {/* Hint Section */}
                {showHint && !showResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/30"
                  >
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold mb-1 text-warning">Hint</h4>
                        <p className="text-sm text-muted-foreground">
                          Look carefully at the question keywords. The correct answer relates directly to {currentQuestion.category.toLowerCase()}.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Result Section */}
                {showResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`mb-6 p-4 rounded-xl border-2 ${
                      isCorrect
                        ? 'bg-success/10 border-success/30'
                        : 'bg-destructive/10 border-destructive/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {isCorrect ? (
                        <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                      ) : (
                        <XCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <h4 className={`font-semibold mb-2 ${isCorrect ? 'text-success' : 'text-destructive'}`}>
                          {isCorrect ? 'Correct! Well done! 🎉' : 'Incorrect'}
                        </h4>
                        <p className="text-sm mb-3">
                          <strong>Explanation:</strong> {currentQuestion.explanation}
                        </p>
                        {!isCorrect && selectedOption !== null && (
                          <p className="text-sm">
                            <strong>Why this is wrong:</strong>{' '}
                            {currentQuestion.whyWrong[selectedOption] || 'The correct answer is explained above. Review and try again!'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {isCorrect && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSimilarQuestion}
                          className="gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Similar Question
                        </Button>
                      )}
                      {!isCorrect && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAskAI}
                            className="gap-2"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Ask AI Tutor
                          </Button>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-2 w-full">
                            <span className="text-warning">⚠️</span>
                            <span>You need to answer this correctly before moving forward. Don't worry, you can try again!</span>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-2">
                    {!showResult && (
                      <Button
                        variant="outline"
                        onClick={handleHint}
                        disabled={hintsUsed >= maxHints || showHint}
                        className="gap-2"
                      >
                        <Lightbulb className="w-4 h-4" />
                        Hint ({hintsUsed}/{maxHints})
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {!showResult ? (
                      <Button
                        onClick={handleSubmit}
                        disabled={selectedOption === null}
                        className="gap-2"
                      >
                        Submit Answer
                      </Button>
                    ) : (
                      <Button
                        onClick={handleNext}
                        className="gap-2"
                        disabled={loadingSimilar}
                      >
                        {loadingSimilar ? (
                          <>
                            <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-1" />
                            Getting similar question...
                          </>
                        ) : !isCorrect ? (
                          'Try Again'
                        ) : currentQuestionIndex < questionQueue.length - 1 ? (
                          <>
                            Next Question
                            <ChevronRight className="w-4 h-4" />
                          </>
                        ) : (
                          'View Results'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* Stats Card */}
              <Card className="p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {userProgress.streak}
                    </div>
                    <div className="text-xs text-muted-foreground">Streak</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-success">
                      {userProgress.accuracy}%
                    </div>
                    <div className="text-xs text-muted-foreground">Accuracy</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-warning">
                      {userProgress.hintsUsed}
                    </div>
                    <div className="text-xs text-muted-foreground">Hints Used</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}