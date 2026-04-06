import { motion } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { supabase } from '@/app/services/supabase';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import {
  Trophy,
  Target,
  TrendingUp,
  Lock,
  Unlock,
  Flame,
  Brain,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Moon,
  Sun,
  LogOut,
  Zap,
  Focus
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip';
import { aiSuggestions } from '@/app/data/exam-data';
import { useState, useEffect } from 'react';
import { useQuestions } from '@/app/hooks/useQuestions';
import { backfillMissingQuestionLevels } from '@/app/services/questionLevels';
import { isAdminEmail } from '@/app/utils/adminEmails';

export function Dashboard() {
  const {
    userProgress,
    setCurrentScreen,
    userName,
    theme,
    toggleTheme,
    setUserName,
    mistakesList,
    setReviewMistakesQuestions,
    setStartPracticeWithWeakAreas,
    setPendingWeakPracticeBankIds,
    setSubjectSelectFor,
    setSelectedPracticeSubject,
  } = useApp();
  const [focusMode, setFocusMode] = useState(false);
  const [showMockUnlock, setShowMockUnlock] = useState(false);
  const [showFinalUnlock, setShowFinalUnlock] = useState(false);
  const { questions: bankQuestions, loading: bankQuestionsLoading } = useQuestions();
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [showLevelBackfillAdmin, setShowLevelBackfillAdmin] = useState(false);

  const mockTestUnlocked = userProgress.examReadiness >= 80;
  const finalExamUnlocked = userProgress.mockTestsCompleted >= 1 && userProgress.examReadiness >= 90;

  useEffect(() => {
    const syncAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setShowLevelBackfillAdmin(isAdminEmail(session?.user?.email));
    };
    void syncAdmin();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setShowLevelBackfillAdmin(isAdminEmail(session?.user?.email));
    });
    return () => subscription.unsubscribe();
  }, []);

  // Check for unlock animations
  useEffect(() => {
    if (mockTestUnlocked && !showMockUnlock) {
      setShowMockUnlock(true);
    }
  }, [mockTestUnlocked]);

  useEffect(() => {
    if (finalExamUnlocked && !showFinalUnlock) {
      setShowFinalUnlock(true);
    }
  }, [finalExamUnlocked]);

  const getReadinessColor = () => {
    if (userProgress.examReadiness >= 80) return 'text-success';
    if (userProgress.examReadiness >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getReadinessZone = () => {
    if (userProgress.examReadiness >= 80) return 'Ready 🎯';
    if (userProgress.examReadiness >= 50) return 'Almost There 💪';
    return 'Keep Going 🚀';
  };

  const getAISuggestion = () => {
    const level = userProgress.examReadiness >= 80 ? 'high' : 
                  userProgress.examReadiness >= 50 ? 'medium' : 'low';
    const suggestions = aiSuggestions[level];
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  };

  const CircularProgress = ({ value, size = 120, strokeWidth = 8, color = '#2563EB' }: any) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;

    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/30"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-card/80 border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Welcome back, {userName}!</h2>
                <p className="text-sm text-muted-foreground">Ready to learn today?</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
               variant="ghost"
                 onClick={toggleTheme}
                className="rounded-full"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUserName('');
                }}
                className="rounded-full"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overall Progress Ring */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 bg-gradient-to-br from-card to-primary/5 border-primary/20">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <CircularProgress value={userProgress.accuracy || 0} size={140} color="#2563EB" />
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-bold">{userProgress.accuracy}%</span>
                    <span className="text-xs text-muted-foreground">Accuracy</span>
                  </div>
                </div>
                <div className="mt-4 text-center space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="w-4 h-4 text-primary" />
                    <span className="font-semibold">Level {userProgress.level}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-sm">{userProgress.streak} Day Streak</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* AI Confidence Meter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="p-6 bg-gradient-to-br from-card to-purple-500/5 border-purple-500/20">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold">AI Confidence</h3>
              </div>
              <div className="space-y-4">
                <div className="text-center">
                  <div className={`text-5xl font-bold mb-2 ${getReadinessColor()}`}>
                    {userProgress.examReadiness}%
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">Exam Readiness</div>
                  <div className="inline-block px-3 py-1 rounded-full bg-muted text-sm font-medium">
                    {getReadinessZone()}
                  </div>
                </div>
                <Progress 
                  value={userProgress.examReadiness} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="text-destructive">Beginner</span>
                  <span className="text-warning">Intermediate</span>
                  <span className="text-success">Expert</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="p-6 bg-gradient-to-br from-card to-success/5 border-success/20">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-success" />
                <h3 className="font-semibold">Today's Progress</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Target</span>
                    <span className="font-semibold">
                      {userProgress.todaysCompleted}/{userProgress.todaysTarget}
                    </span>
                  </div>
                  <Progress 
                    value={(userProgress.todaysCompleted / userProgress.todaysTarget) * 100} 
                    className="h-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-2xl font-bold">{userProgress.totalQuestions}</div>
                    <div className="text-xs text-muted-foreground">Total Questions</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{userProgress.rank}</div>
                    <div className="text-xs text-muted-foreground">Current Rank</div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* AI Recommendation Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/30">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Personalized Assessment</h3>
                <p className="text-muted-foreground mb-4">
                  {!userProgress.completedAssessment
                    ? 'Start Stage 1 from any topic (A1–B6), or after your first completion open weak-area practice here.'
                    : 'Based on your mistakes we can give you targeted practice. Continue where you left off.'}
                </p>
                <Button
                  onClick={() => {
                    if (!userProgress.completedAssessment) {
                      setSubjectSelectFor('assessment');
                      setCurrentScreen('subjectSelect');
                    } else {
                      setSelectedPracticeSubject(null);
                      setPendingWeakPracticeBankIds(null);
                      setStartPracticeWithWeakAreas(true);
                      setCurrentScreen('practice');
                    }
                  }}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {!userProgress.completedAssessment ? 'Choose Stage 1 topic' : 'Continue Practice'}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {showLevelBackfillAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.32 }}
          >
            <Card className="p-4 border-dashed border-muted-foreground/25 bg-muted/20">
              <h3 className="text-sm font-semibold mb-1">Question level tags (batch)</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Tag bank rows missing from <code className="text-[10px] bg-muted px-1 rounded">question_levels</code> using
                GPT (25 per batch, max 500). Uses your OpenAI key; run when you add many new questions.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={backfillBusy || bankQuestionsLoading || bankQuestions.length === 0}
                onClick={() => {
                  setBackfillMsg(null);
                  setBackfillBusy(true);
                  void (async () => {
                    try {
                      const r = await backfillMissingQuestionLevels(bankQuestions, {
                        batchSize: 25,
                        maxTotal: 500,
                      });
                      setBackfillMsg(`Done: ${r.done} tagged${r.failed ? `, ${r.failed} failed` : ''}.`);
                    } catch (e) {
                      setBackfillMsg(e instanceof Error ? e.message : 'Backfill failed');
                    } finally {
                      setBackfillBusy(false);
                    }
                  })();
                }}
              >
                {backfillBusy ? 'Running batch…' : 'Backfill missing levels'}
              </Button>
              {backfillMsg && <p className="text-xs text-muted-foreground mt-2">{backfillMsg}</p>}
            </Card>
          </motion.div>
        )}

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Initial Assessment */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card 
                    className={`p-6 cursor-pointer transition-all hover:shadow-xl ${
                      userProgress.completedAssessment 
                        ? 'bg-success/10 border-success/30' 
                        : 'bg-card hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setSubjectSelectFor('assessment');
                      setCurrentScreen('subjectSelect');
                    }}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Target className="w-6 h-6 text-primary" />
                        </div>
                        {userProgress.completedAssessment && (
                          <CheckCircle2 className="w-6 h-6 text-success" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Stage 1 Assessment</h3>
                        <p className="text-sm text-muted-foreground">
                          {userProgress.completedAssessment
                            ? 'Topics A1–B6 · 35 questions each'
                            : 'Topic-by-topic · 35 questions (12E / 13M / 10H)'}
                        </p>
                      </div>
                      <Button className="w-full" variant="outline">
                        {userProgress.completedAssessment ? 'Retake or next topic' : 'Start assessment'}
                      </Button>
                    </div>
                  </Card>
                </TooltipTrigger>
                {userProgress.completedAssessment && (
                  <TooltipContent>Assessment completed ✓</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </motion.div>

          {/* Practice Test */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card 
              className="p-6 cursor-pointer transition-all hover:shadow-xl bg-card hover:border-primary/50"
              onClick={() => {
                setSubjectSelectFor('practice');
                setCurrentScreen('subjectSelect');
              }}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <Unlock className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Practice Test</h3>
                  <p className="text-sm text-muted-foreground">
                    Build your skills with hints
                  </p>
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90">
                  Start Practice
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Mock Test */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card 
                    className={`p-6 transition-all ${
                      mockTestUnlocked
                        ? 'cursor-pointer hover:shadow-xl bg-card hover:border-primary/50'
                        : 'opacity-60 cursor-not-allowed backdrop-blur-sm'
                    }`}
                    onClick={() => {
                      if (mockTestUnlocked) {
                        setSubjectSelectFor('mock');
                        setCurrentScreen('subjectSelect');
                      }
                    }}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                          <AlertCircle className="w-6 h-6 text-warning" />
                        </div>
                        {mockTestUnlocked ? (
                          <Unlock className="w-6 h-6 text-success" />
                        ) : (
                          <Lock className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Mock Test</h3>
                        <p className="text-sm text-muted-foreground">
                          {mockTestUnlocked 
                            ? 'Exam-like conditions' 
                            : 'Requires 80% readiness'}
                        </p>
                      </div>
                      <Button 
                        className="w-full" 
                        variant={mockTestUnlocked ? "default" : "outline"}
                        disabled={!mockTestUnlocked}
                      >
                        {mockTestUnlocked ? 'Start Mock Test' : 'Locked'}
                      </Button>
                    </div>
                  </Card>
                </TooltipTrigger>
                {!mockTestUnlocked && (
                  <TooltipContent>
                    Unlock at 80% exam readiness
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </motion.div>

          {/* Final Exam */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card 
                    className={`p-6 transition-all ${
                      finalExamUnlocked
                        ? 'cursor-pointer hover:shadow-xl bg-gradient-to-br from-primary/10 to-purple-500/10 hover:border-primary/50'
                        : 'opacity-60 cursor-not-allowed backdrop-blur-sm'
                    }`}
                    onClick={() => finalExamUnlocked && setCurrentScreen('final')}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                          <Trophy className="w-6 h-6 text-primary" />
                        </div>
                        {finalExamUnlocked ? (
                          <Unlock className="w-6 h-6 text-success" />
                        ) : (
                          <div className="flex gap-1">
                            <Lock className="w-5 h-5 text-muted-foreground" />
                            <Lock className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Final Exam</h3>
                        <p className="text-sm text-muted-foreground">
                          {finalExamUnlocked 
                            ? 'Get your certificate!' 
                            : '1 mock test + 90% ready'}
                        </p>
                      </div>
                      <Button 
                        className="w-full" 
                        variant={finalExamUnlocked ? "default" : "outline"}
                        disabled={!finalExamUnlocked}
                      >
                        {finalExamUnlocked ? 'Take Final Exam' : 'Locked'}
                      </Button>
                    </div>
                  </Card>
                </TooltipTrigger>
                {!finalExamUnlocked && (
                  <TooltipContent>
                    Complete 1 mock test and reach 90% readiness
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        </div>

        {/* Mistakes to Fix Card */}
        {mistakesList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <Card className="p-6 border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">AI Detected Repeated Mistakes</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    You've made mistakes on {mistakesList.length} questions. Let's review them!
                  </p>
                  <div className="space-y-2 mb-4">
                    {mistakesList.slice(0, 3).map((mistake, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center text-xs font-semibold">
                          {mistake.count}
                        </div>
                        <span className="text-muted-foreground">{mistake.question.category}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setSelectedPracticeSubject(null);
                      setReviewMistakesQuestions(mistakesList.map((m) => m.question));
                      setCurrentScreen('practice');
                    }}
                  >
                    Review Mistakes
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}