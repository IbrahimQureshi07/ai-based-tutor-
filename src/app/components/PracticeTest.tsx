import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import { Question } from '@/app/data/exam-data';
import { useQuestions } from '@/app/hooks/useQuestions';
import { getCurrentUserId, saveWrongQuestion, getUserWrongQuestions } from '@/app/services/userWrongQuestions';
import { generateSimilarQuestion, generateQuestion } from '@/app/services/aiService';
import { savePracticeState, clearPracticeState } from '@/app/services/practiceStateStorage';
import {
  ArrowLeft,
  Lightbulb,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MessageCircle,
  ChevronRight
} from 'lucide-react';

interface PracticeTestProps {
  /** When set (e.g. from Assessment), only this many questions are shown. */
  questionLimit?: number;
  /** Assessment = 10 questions from GPT based on user weak areas (DB), not from sheet */
  assessmentMode?: boolean;
}

export function PracticeTest({ questionLimit, assessmentMode }: PracticeTestProps = {}) {
  const {
    setCurrentScreen,
    answerQuestion,
    userProgress,
    updateProgress,
    setChatOpen,
    addChatMessage,
    addMistake,
    reviewMistakesQuestions,
    setReviewMistakesQuestions,
    startPracticeWithWeakAreas,
    setStartPracticeWithWeakAreas,
    restoredPracticeState,
    setRestoredPracticeState,
  } = useApp();
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
  const [originalWrongQuestion, setOriginalWrongQuestion] = useState<Question | null>(null);
  const [buildingWeakQueue, setBuildingWeakQueue] = useState(false);
  const [buildingAssessmentQueue, setBuildingAssessmentQueue] = useState(false);

  useEffect(() => {
    if (restoredPracticeState && questions.length > 0) {
      const ordered = restoredPracticeState.questionIds
        .map((id) => questions.find((q) => q.id === id))
        .filter((q): q is Question => q != null);
      const queue = ordered.length > 0 ? ordered : [...questions];
      setQuestionQueue(queue);
      setCurrentQuestionIndex(Math.min(restoredPracticeState.currentIndex, Math.max(0, queue.length - 1)));
      setRestoredPracticeState(null);
      return;
    }
    if (reviewMistakesQuestions && reviewMistakesQuestions.length > 0) {
      setQuestionQueue([...reviewMistakesQuestions]);
      setReviewMistakesQuestions(null);
      setCurrentQuestionIndex(0);
      return;
    }
    if (questionQueue.length > 0 && !startPracticeWithWeakAreas) return;
    if (assessmentMode && questions.length > 0 && questionQueue.length === 0) {
      setBuildingAssessmentQueue(true);
      (async () => {
        const userId = await getCurrentUserId();
        const wrongRows = userId ? await getUserWrongQuestions(userId) : [];
        const target = 10;
        const gptQuestions: Question[] = [];
        if (wrongRows.length > 0) {
          for (let i = 0; i < target; i++) {
            const row = wrongRows[i % wrongRows.length];
            const source = questions.find((q) => q.id === row.question_id);
            try {
              if (source) {
                const similar = await generateSimilarQuestion(
                  source.question,
                  source.subject || source.category,
                  source.difficulty
                );
                gptQuestions.push({
                  id: `assessment-${Date.now()}-${i}`,
                  question: similar.question,
                  options: similar.options,
                  correctAnswer: similar.correctAnswer,
                  explanation: similar.explanation,
                  whyWrong: {},
                  subject: similar.category,
                  category: similar.category,
                  difficulty: source.difficulty,
                });
              } else {
                const gen = await generateQuestion({ subject: row.category || 'General', difficulty: 'medium' });
                gptQuestions.push({
                  id: `assessment-${Date.now()}-${i}`,
                  question: gen.question,
                  options: gen.options,
                  correctAnswer: gen.correctAnswer,
                  explanation: gen.explanation,
                  whyWrong: {},
                  subject: gen.category,
                  category: gen.category,
                  difficulty: 'medium',
                });
              }
            } catch {
              const gen = await generateQuestion({ subject: 'General', difficulty: 'medium' }).catch(() => null);
              if (gen) gptQuestions.push({ id: `assessment-${Date.now()}-${i}`, ...gen, whyWrong: {}, difficulty: 'medium' });
            }
          }
        } else {
          for (let i = 0; i < target; i++) {
            try {
              const gen = await generateQuestion({ subject: 'Exam preparation', difficulty: 'medium' });
              gptQuestions.push({
                id: `assessment-${Date.now()}-${i}`,
                question: gen.question,
                options: gen.options,
                correctAnswer: gen.correctAnswer,
                explanation: gen.explanation,
                whyWrong: {},
                subject: gen.category,
                category: gen.category,
                difficulty: 'medium',
              });
            } catch {
              // skip or use fallback
            }
          }
        }
        if (gptQuestions.length > 0) {
          setQuestionQueue(gptQuestions);
          setCurrentQuestionIndex(0);
        } else {
          const list = questions.slice(0, 10);
          setQuestionQueue(list);
        }
        setBuildingAssessmentQueue(false);
      })();
      return;
    }
    if (startPracticeWithWeakAreas && questions.length > 0) {
      setBuildingWeakQueue(true);
      (async () => {
        const userId = await getCurrentUserId();
        setStartPracticeWithWeakAreas(false);
        if (!userId) {
          setQuestionQueue([...questions]);
          setBuildingWeakQueue(false);
          return;
        }
        const wrongRows = await getUserWrongQuestions(userId);
        const wrongIds = new Set(wrongRows.map((r) => r.question_id));
        let weakQuestions = questions.filter((q) => wrongIds.has(q.id));
        if (weakQuestions.length === 0) {
          setQuestionQueue([...questions]);
        } else {
          try {
            const first = weakQuestions[0];
            const similar = await generateSimilarQuestion(
              first.question,
              first.subject || first.category,
              first.difficulty
            );
            const gptQuestion: Question = {
              id: `similar-${Date.now()}`,
              question: similar.question,
              options: similar.options,
              correctAnswer: similar.correctAnswer,
              explanation: similar.explanation,
              whyWrong: {},
              subject: similar.category,
              category: similar.category,
              difficulty: first.difficulty,
            };
            weakQuestions = [...weakQuestions, gptQuestion];
          } catch {
            // keep weak only
          }
          setQuestionQueue([...weakQuestions]);
        }
        setCurrentQuestionIndex(0);
        setBuildingWeakQueue(false);
      })();
      return;
    }
    if (questions.length > 0 && questionQueue.length === 0 && !buildingWeakQueue) {
      const list = questionLimit ? questions.slice(0, questionLimit) : [...questions];
      setQuestionQueue(list);
    }
  }, [questions, questionQueue.length, reviewMistakesQuestions, startPracticeWithWeakAreas, restoredPracticeState, questionLimit, assessmentMode]);

  useEffect(() => {
    if (questionQueue.length > 0 && !assessmentMode) savePracticeState(questionQueue.map((q) => q.id), currentQuestionIndex);
  }, [questionQueue, currentQuestionIndex, assessmentMode]);

  const goToDashboard = () => {
    clearPracticeState();
    setCurrentScreen('dashboard');
  };
  const goToResults = () => {
    clearPracticeState();
    setCurrentScreen('results');
  };

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
          <Button onClick={goToDashboard}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center max-w-md p-6">
          <p className="text-muted-foreground mb-4">No questions available. Add questions in Supabase.</p>
          <Button onClick={goToDashboard}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }
  if (questionQueue.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">
            {buildingAssessmentQueue ? 'Generating your personalized assessment...' : buildingWeakQueue ? 'Loading your weak-area questions...' : 'Preparing questions...'}
          </p>
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

      const isGptQuestion = currentQuestion.id.startsWith('similar-');
      if (!isGptQuestion) {
        const wrongCount = wrongQuestionsCount.get(currentQuestion.id) || 0;
        setWrongQuestionsCount(new Map(wrongQuestionsCount).set(currentQuestion.id, wrongCount + 1));
        getCurrentUserId().then((userId) => {
          if (userId) saveWrongQuestion(userId, currentQuestion.id, currentQuestion.category || 'General');
        });
      }

      setIsRetryQuestion(true);
      addChatMessage('ai', `Don't worry! I'm generating a similar question to help you practise this concept. 💪`);
    } else {
      if (isRetryQuestion) {
        const newWrongCount = new Map(wrongQuestionsCount);
        // Remove original sheet question from retry list if it was tracked
        const src = originalWrongQuestion || currentQuestion;
        newWrongCount.delete(src.id);
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
    if (!isCorrect) {
      const sourceForGpt = originalWrongQuestion || currentQuestion;
      if (!originalWrongQuestion) {
        setOriginalWrongQuestion(currentQuestion);
      }

      setLoadingSimilar(true);
      try {
        const { generateSimilarQuestion } = await import('@/app/services/aiService');
        const similar = await generateSimilarQuestion(
          sourceForGpt.question,
          sourceForGpt.subject || sourceForGpt.category,
          sourceForGpt.difficulty
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
          difficulty: sourceForGpt.difficulty,
        };
        const newQueue = [...questionQueue];
        newQueue[currentQuestionIndex] = newQuestion;
        setQuestionQueue(newQueue);
        setSelectedOption(null);
        setShowResult(false);
        setShowHint(false);
        setIsRetryQuestion(true);
        addChatMessage('ai', '🤖 AI generated a similar question. Answer this correctly to move forward!');
      } catch {
        // GPT failed — show a different question from bank so the same question never repeats
        const sameCategory = questions.filter(
          (q) => (q.category === sourceForGpt.category || q.subject === sourceForGpt.subject) && q.id !== currentQuestion.id
        );
        if (sameCategory.length > 0) {
          const fallbackQuestion = sameCategory[Math.floor(Math.random() * sameCategory.length)];
          const newQueue = [...questionQueue];
          newQueue[currentQuestionIndex] = fallbackQuestion;
          setQuestionQueue(newQueue);
          setSelectedOption(null);
          setShowResult(false);
          setShowHint(false);
          setIsRetryQuestion(true);
          addChatMessage('ai', "Couldn't reach AI right now — here's a related question from the bank. Answer correctly to move on! 📚");
        } else {
          setSelectedOption(null);
          setShowResult(false);
          setShowHint(false);
          addChatMessage('ai', "Couldn't generate a new question. Click Try Again to retry, or ask the AI Tutor for help.");
        }
      } finally {
        setLoadingSimilar(false);
      }
      return;
    }

    // Correct answer → clear the GPT retry chain and advance to next real question
    setOriginalWrongQuestion(null);

    if (currentQuestionIndex < questionQueue.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setShowResult(false);
      setShowHint(false);
      setIsRetryQuestion(false);
    } else {
      goToResults();
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
              onClick={goToDashboard}
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