import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import { useQuestions } from '@/app/hooks/useQuestions';
import { Trophy, Clock, AlertTriangle, Award, Download, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';

export function FinalExam() {
  const { setCurrentScreen, answerQuestion, updateProgress, userProgress, addChatMessage, setChatOpen } = useApp();
  const { questions, loading: questionsLoading, error: questionsError } = useQuestions();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [timeLeft, setTimeLeft] = useState(45 * 60); // 45 minutes
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [testStarted, setTestStarted] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

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

  // Show AI warning before starting
  useEffect(() => {
    if (!testStarted) {
      addChatMessage('ai', '🎓 This is your Final Exam. No hints, no AI assistance during the test. Answer carefully and manage your time wisely. You\'ve got this!');
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
    if (timeLeft > 900) return 'text-success';
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
    if (currentQuestionIndex < questions.length - 1) {
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

  const handleAutoSubmit = () => {
    submitTest();
  };

  const submitTest = () => {
    setTestCompleted(true);
    
    // Calculate results
    let correct = 0;
    questions.forEach((question, index) => {
      const userAnswer = answers.get(index);
      if (userAnswer !== undefined) {
        const isCorrect = userAnswer === question.correctAnswer;
        if (isCorrect) correct++;
        answerQuestion(question.id, userAnswer, isCorrect);
      }
    });

    const score = Math.round((correct / questions.length) * 100);
    setFinalScore(score);

    // Update final exam status
    updateProgress({
      finalExamUnlocked: true
    });

    // Show certificate after animation
    setTimeout(() => {
      setShowCertificate(true);
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

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-purple-500/5 flex flex-col">
        {/* Strict Header */}
        <header className="sticky top-0 z-50 bg-card border-b-2 border-primary px-4 py-3">
          <div className="container mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Trophy className="w-6 h-6 text-primary" />
                <div>
                  <h2 className="font-bold text-lg">FINAL EXAMINATION</h2>
                  <p className="text-xs text-muted-foreground">Question {currentQuestionIndex + 1}/{questions.length}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-muted font-mono text-xl font-bold ${getTimerColor()}`}>
                  <Clock className="w-5 h-5" />
                  {formatTime(timeLeft)}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleExit}
                  className="gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Exit
                </Button>
              </div>
            </div>
            <Progress value={progress} className="h-2 mt-3" />
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
                <Card className="p-8 border-2 border-primary/20 shadow-xl">
                  {/* Question */}
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                        Q{currentQuestionIndex + 1}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-muted text-xs font-semibold">
                        {currentQuestion.category}
                      </span>
                    </div>
                    <h2 className="text-2xl font-semibold leading-relaxed">
                      {currentQuestion.question}
                    </h2>
                  </div>

                  {/* Options */}
                  <div className="space-y-4 mb-8">
                    {currentQuestion.options.map((option, index) => (
                      <motion.button
                        key={index}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleOptionSelect(index)}
                        className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                          selectedOption === index
                            ? 'border-primary bg-primary/10 ring-2 ring-primary shadow-lg'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                            selectedOption === index
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}>
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span className="flex-1 text-lg">{option}</span>
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between gap-4 pt-6 border-t-2 border-border">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handlePrevious}
                      disabled={currentQuestionIndex === 0}
                    >
                      ← Previous
                    </Button>

                    <div className="text-sm text-muted-foreground">
                      {answeredCount}/{questions.length} Answered
                    </div>

                    <div className="flex gap-2">
                      {currentQuestionIndex === questions.length - 1 ? (
                        <Button
                          size="lg"
                          onClick={handleSubmit}
                          className="bg-success hover:bg-success/90 text-lg px-8"
                        >
                          Submit Final Exam
                        </Button>
                      ) : (
                        <Button size="lg" onClick={handleNext}>
                          Next →
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Submit Final Examination?
            </DialogTitle>
            <DialogDescription>
              This is your final exam. Once submitted, you cannot make changes. 
              You have answered {answeredCount} out of {questions.length} questions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Review Answers
            </Button>
            <Button onClick={confirmSubmit} className="bg-success hover:bg-success/90">
              Yes, Submit Final Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Exit Final Examination?
            </DialogTitle>
            <DialogDescription>
              This is a serious exam. Your progress will be permanently lost if you exit now.
              Are you absolutely sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Stay in Exam
            </Button>
            <Button variant="destructive" onClick={confirmExit}>
              Yes, I Want to Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate Modal */}
      <Dialog open={showCertificate} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="text-center"
          >
            <motion.div
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1]
              }}
              transition={{ duration: 1 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-primary to-purple-500 mb-6"
            >
              <Award className="w-12 h-12 text-white" />
            </motion.div>

            <h2 className="text-3xl font-bold mb-2">Congratulations! 🎉</h2>
            <p className="text-xl text-muted-foreground mb-6">
              You've successfully completed the final exam!
            </p>

            <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl p-8 mb-6 border-2 border-primary/20">
              <div className="text-6xl font-bold text-primary mb-2">{finalScore}%</div>
              <div className="text-lg text-muted-foreground mb-4">Final Score</div>
              
              <div className="max-w-md mx-auto border-2 border-primary/30 rounded-xl p-6 bg-card">
                <h3 className="text-xl font-bold mb-2">Certificate of Achievement</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This certifies that <span className="font-semibold text-foreground">{userProgress.rank} Level Candidate</span> has
                  successfully completed the State Level Examination Preparation Course
                  with a score of {finalScore}%.
                </p>
                <div className="text-xs text-muted-foreground">
                  {new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => {
                  setShowCertificate(false);
                  setCurrentScreen('results');
                }}
                size="lg"
              >
                View Detailed Results
              </Button>
              <Button variant="outline" size="lg" className="gap-2">
                <Download className="w-4 h-4" />
                Download Certificate
              </Button>
              <Button variant="outline" size="lg" className="gap-2">
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}