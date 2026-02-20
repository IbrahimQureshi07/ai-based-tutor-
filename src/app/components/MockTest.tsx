import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import { mockQuestions } from '@/app/data/exam-data';
import { Clock, Flag, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';

export function MockTest() {
  const { setCurrentScreen, answerQuestion, updateProgress, userProgress, addChatMessage, setChatOpen } = useApp();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [testStarted, setTestStarted] = useState(false);

  const currentQuestion = mockQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / mockQuestions.length) * 100;

  // Show AI warning before starting
  useEffect(() => {
    if (!testStarted) {
      addChatMessage('ai', '⚠️ This test simulates real exam conditions. You\'ll have a timer, no hints are allowed, and questions are more challenging. Take your time and stay focused. Good luck!');
      setChatOpen(true);
      setTestStarted(true);
    }
  }, []);

  useEffect(() => {
    if (testCompleted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [testCompleted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft > 600) return 'text-success';
    if (timeLeft > 300) return 'text-warning';
    return 'text-destructive';
  };

  const handleOptionSelect = (index: number) => {
    setSelectedOption(index);
    const newAnswers = new Map(answers);
    newAnswers.set(currentQuestionIndex, index);
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < mockQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(answers.get(currentQuestionIndex + 1) ?? null);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedOption(answers.get(currentQuestionIndex - 1) ?? null);
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

  const handleAutoSubmit = () => {
    submitTest();
  };

  const submitTest = () => {
    setTestCompleted(true);
    
    // Calculate results
    let correct = 0;
    mockQuestions.forEach((question, index) => {
      const userAnswer = answers.get(index);
      if (userAnswer !== undefined) {
        const isCorrect = userAnswer === question.correctAnswer;
        if (isCorrect) correct++;
        answerQuestion(question.id, userAnswer, isCorrect);
      }
    });

    // Update mock tests completed
    updateProgress({
      mockTestsCompleted: userProgress.mockTestsCompleted + 1
    });

    // Navigate to results after a short delay
    setTimeout(() => {
      setCurrentScreen('results');
    }, 2000);
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
    setCurrentScreen('dashboard');
  };

  const answeredCount = answers.size;
  const unansweredCount = mockQuestions.length - answeredCount;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Fullscreen Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="font-semibold">Mock Test</h2>
              <div className="hidden md:flex items-center gap-2">
                <div className="px-3 py-1 rounded-lg bg-muted text-sm">
                  Question {currentQuestionIndex + 1}/{mockQuestions.length}
                </div>
                <div className="px-3 py-1 rounded-lg bg-muted text-sm">
                  Answered: {answeredCount}
                </div>
                {flaggedQuestions.size > 0 && (
                  <div className="px-3 py-1 rounded-lg bg-warning/10 text-warning text-sm flex items-center gap-1">
                    <Flag className="w-3 h-3" />
                    {flaggedQuestions.size} Flagged
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-muted font-mono text-lg ${getTimerColor()}`}>
                <Clock className="w-5 h-5" />
                {formatTime(timeLeft)}
              </div>
              <Button
                variant="outline"
                onClick={handleExit}
                className="gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Exit
              </Button>
            </div>
          </div>
          <Progress value={progress} className="h-1 mt-3" />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-6 md:p-8 mb-6">
                {/* Question Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {currentQuestion.category}
                      </span>
                      {flaggedQuestions.has(currentQuestionIndex) && (
                        <span className="px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold flex items-center gap-1">
                          <Flag className="w-3 h-3" />
                          Flagged
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl md:text-2xl font-semibold">
                      {currentQuestion.question}
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFlag}
                    className={flaggedQuestions.has(currentQuestionIndex) ? 'text-warning' : ''}
                  >
                    <Flag className="w-5 h-5" />
                  </Button>
                </div>

                {/* Options */}
                <div className="space-y-3 mb-6">
                  {currentQuestion.options.map((option, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <button
                        onClick={() => handleOptionSelect(index)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          selectedOption === index
                            ? 'border-primary bg-primary/10 ring-2 ring-primary'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                            selectedOption === index
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}>
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span className="flex-1">{option}</span>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>

                  <div className="flex gap-2">
                    {currentQuestionIndex === mockQuestions.length - 1 ? (
                      <Button
                        onClick={handleSubmit}
                        className="bg-success hover:bg-success/90"
                      >
                        Submit Test
                      </Button>
                    ) : (
                      <Button onClick={handleNext}>
                        Next
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* Question Navigator */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Question Navigator</h3>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                  {mockQuestions.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentQuestionIndex(index);
                        setSelectedOption(answers.get(index) ?? null);
                      }}
                      className={`aspect-square rounded-lg font-semibold text-sm transition-all ${
                        index === currentQuestionIndex
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                          : answers.has(index)
                          ? 'bg-success/20 text-success border border-success'
                          : flaggedQuestions.has(index)
                          ? 'bg-warning/20 text-warning border border-warning'
                          : 'bg-muted hover:bg-muted/70'
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-success/20 border border-success" />
                    <span className="text-muted-foreground">Answered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-warning/20 border border-warning" />
                    <span className="text-muted-foreground">Flagged</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-muted" />
                    <span className="text-muted-foreground">Not Visited</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Mock Test?</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit? You have answered {answeredCount} out of {mockQuestions.length} questions.
              {unansweredCount > 0 && ` ${unansweredCount} questions remain unanswered.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Review Answers
            </Button>
            <Button onClick={confirmSubmit}>
              Yes, Submit Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Exit Mock Test?
            </DialogTitle>
            <DialogDescription>
              Your progress will be lost if you exit now. Are you sure you want to leave?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Continue Test
            </Button>
            <Button variant="destructive" onClick={confirmExit}>
              Yes, Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Completed Animation */}
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
                rotate: [0, 360]
              }}
              transition={{ duration: 1 }}
              className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="w-12 h-12 text-success" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Test Submitted!</h2>
            <p className="text-muted-foreground">Calculating your results...</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}