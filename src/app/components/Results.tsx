import { motion } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import { 
  Trophy, 
  TrendingUp, 
  Target, 
  Award, 
  ArrowRight,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Share2,
  Unlock
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useEffect, useState } from 'react';

export function Results() {
  const {
    userProgress,
    setCurrentScreen,
    addChatMessage,
    setChatOpen,
    lastSessionResults,
    setStartPracticeWithWeakAreas,
    setSubjectSelectFor,
    setSelectedPracticeSubject,
  } = useApp();
  const [hasCheckedUnlock, setHasCheckedUnlock] = useState(false);

  // Use last test session for all numbers and charts; fallback to userProgress when no session data
  const total = lastSessionResults?.total ?? userProgress.totalQuestions;
  const correct = lastSessionResults?.correct ?? userProgress.correctAnswers;
  const incorrect = lastSessionResults?.incorrect ?? (userProgress.totalQuestions - userProgress.correctAnswers);
  const sessionAccuracy = total > 0 ? Math.round((correct / total) * 100) : userProgress.accuracy;

  // Check for auto-unlock on mount
  useEffect(() => {
    if (hasCheckedUnlock) return;
    
    const mockTestUnlocked = userProgress.examReadiness >= 80;
    const finalExamUnlocked = userProgress.mockTestsCompleted >= 1 && userProgress.examReadiness >= 90;
    
    if (mockTestUnlocked && userProgress.examReadiness >= 80 && userProgress.totalQuestions > 5) {
      setTimeout(() => {
        addChatMessage('ai', '🎉 Great job! You\'ve reached 80% readiness. Mock Test is now unlocked!');
        setChatOpen(true);
      }, 1000);
    }
    
    if (finalExamUnlocked && userProgress.mockTestsCompleted >= 1) {
      setTimeout(() => {
        addChatMessage('ai', '🏆 Outstanding! You\'re ready for the Final Exam. Stay focused and confident.');
        setChatOpen(true);
      }, 1000);
    }
    
    setHasCheckedUnlock(true);
  }, [userProgress.examReadiness, userProgress.mockTestsCompleted, hasCheckedUnlock]);

  const pieData = [
    { name: 'Correct', value: correct, color: '#10B981' },
    { name: 'Incorrect', value: incorrect, color: '#EF4444' }
  ];

  // Difficulty breakdown from last session (Easy, Medium, Hard order)
  const barData = lastSessionResults?.byDifficulty
    ? ['easy', 'medium', 'hard']
        .filter((d) => lastSessionResults.byDifficulty[d]?.total)
        .map((d) => ({
          difficulty: d.charAt(0).toUpperCase() + d.slice(1),
          correct: lastSessionResults.byDifficulty[d].correct,
          total: lastSessionResults.byDifficulty[d].total,
        }))
    : [];

  // Subject-wise radar from last session categories
  const radarData = lastSessionResults?.byCategory
    ? Object.entries(lastSessionResults.byCategory).map(([subject, { correct: c, total: t }]) => ({
        subject: subject.length > 12 ? subject.slice(0, 12) + '…' : subject,
        score: t > 0 ? Math.round((c / t) * 100) : 0,
      }))
    : [];

  // Weak areas = categories where accuracy < 100%, sorted by accuracy ascending (worst first)
  const weakAreas = lastSessionResults?.byCategory
    ? Object.entries(lastSessionResults.byCategory)
        .map(([subject, { correct: c, total: t }]) => ({
          subject,
          accuracy: t > 0 ? Math.round((c / t) * 100) : 0,
          status: t > 0 && c < t ? 'needs-work' : 'improving',
        }))
        .filter((a) => a.accuracy < 100)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 6)
    : [];

  const getPerformanceMessage = () => {
    const acc = total > 0 ? sessionAccuracy : userProgress.accuracy;
    if (acc >= 90) return { title: 'Outstanding! 🎉', message: 'You\'re performing at an expert level!', color: 'text-success' };
    if (acc >= 75) return { title: 'Great Job! 👏', message: 'You\'re on the right track to success!', color: 'text-primary' };
    if (acc >= 60) return { title: 'Good Progress 💪', message: 'Keep practicing to improve further!', color: 'text-warning' };
    return { title: 'Keep Going! 🚀', message: 'Every expert was once a beginner!', color: 'text-muted-foreground' };
  };

  const performance = getPerformanceMessage();

  const getNextUnlock = () => {
    if (userProgress.examReadiness >= 90 && userProgress.mockTestsCompleted >= 1) {
      return { title: 'Final Exam', message: 'You can now take the final exam!' };
    }
    if (userProgress.examReadiness >= 80) {
      return { title: 'Mock Test', message: 'You can now take mock tests!' };
    }
    return { title: 'Mock Test', message: `Reach ${80 - userProgress.examReadiness}% more readiness to unlock` };
  };

  const nextUnlock = getNextUnlock();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 text-white py-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm mb-6"
            >
              <Trophy className="w-12 h-12" />
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {performance.title}
            </h1>
            <p className="text-xl text-white/90 mb-6">{performance.message}</p>
            <div className="flex items-center justify-center gap-8">
              <div>
                <div className="text-5xl font-bold">{total > 0 ? sessionAccuracy : userProgress.accuracy}%</div>
                <div className="text-white/80">Accuracy</div>
              </div>
              <div className="w-px h-16 bg-white/30" />
              <div>
                <div className="text-5xl font-bold">{total}</div>
                <div className="text-white/80">Questions</div>
              </div>
              <div className="w-px h-16 bg-white/30" />
              <div>
                <div className="text-5xl font-bold">{userProgress.level}</div>
                <div className="text-white/80">Level</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Score Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-6 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Score Breakdown
              </h3>
              <div className="flex items-center justify-center mb-6">
                {total > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Complete a test to see score breakdown.</div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span>Correct Answers</span>
                  </div>
                  <span className="font-semibold">{correct}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span>Incorrect Answers</span>
                  </div>
                  <span className="font-semibold">{incorrect}</span>
                </div>
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total Questions</span>
                    <span>{total}</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Difficulty Analysis */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Difficulty Analysis
              </h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="difficulty" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="correct" fill="#10B981" name="Correct" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="total" fill="#e5e7eb" name="Total" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-sm py-8 text-center">Complete a test to see difficulty breakdown.</p>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Subject Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <h3 className="font-semibold mb-6 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Subject-wise Performance
            </h3>
            {radarData.length > 0 ? (
              <>
                {radarData.length >= 2 && (
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" />
                      <Radar name="Your Score" dataKey="score" stroke="#2563EB" fill="#2563EB" fillOpacity={0.6} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
                <div className={radarData.length >= 2 ? 'mt-4 pt-4 border-t border-border' : ''}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">By subject / category</p>
                  <div className="flex flex-wrap gap-3">
                    {radarData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60">
                        <span className="font-medium">{d.subject}</span>
                        <span className="text-primary font-semibold">{d.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">Complete a test to see subject-wise performance.</p>
            )}
          </Card>
        </motion.div>

        {/* Weak Areas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-6 border-destructive/30 bg-destructive/5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Areas for Improvement
            </h3>
            <div className="space-y-4 mb-6">
              {weakAreas.length > 0 ? (
                weakAreas.map((area, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{area.subject}</span>
                      <span className="text-sm text-muted-foreground">{area.accuracy}%</span>
                    </div>
                    <Progress value={area.accuracy} className="h-2" />
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm py-4">No weak areas in this test — or complete a test to see topics to improve.</p>
              )}
            </div>
            <Button
              onClick={() => {
                setSelectedPracticeSubject(null);
                setStartPracticeWithWeakAreas(true);
                setCurrentScreen('practice');
              }}
              variant="destructive"
              className="w-full"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Practice Weak Areas
            </Button>
          </Card>
        </motion.div>

        {/* Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/30">
            <h3 className="font-semibold mb-4">Next Unlock: {nextUnlock.title}</h3>
            <p className="text-muted-foreground mb-6">{nextUnlock.message}</p>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setCurrentScreen('dashboard')}
                className="gap-2"
              >
                Back to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => {
                  setSubjectSelectFor('practice');
                  setCurrentScreen('subjectSelect');
                }}
                variant="outline"
                className="gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Continue Practice
              </Button>
              <Button
                variant="outline"
                className="gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share Results
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Progress Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-6 text-center">
              <div className="text-4xl font-bold text-primary mb-2">{userProgress.streak}</div>
              <div className="text-sm text-muted-foreground">Day Streak 🔥</div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="p-6 text-center">
              <div className="text-4xl font-bold text-success mb-2">{userProgress.examReadiness}%</div>
              <div className="text-sm text-muted-foreground">Exam Readiness</div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card className="p-6 text-center">
              <div className="text-4xl font-bold text-warning mb-2">{userProgress.rank}</div>
              <div className="text-sm text-muted-foreground">Current Rank</div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}