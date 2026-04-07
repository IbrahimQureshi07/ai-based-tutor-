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
  ChevronRight,
  Lock,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useEffect, useState } from 'react';
import { SUBJECTS, type SubjectMeta } from '@/app/data/subjects';
import { StageTwoProgressAnalyticsSection } from '@/app/components/StageTwoProgressAnalyticsSection';
import { ThreeStageCombinedAnalyticsSection } from '@/app/components/ThreeStageCombinedAnalyticsSection';
import { JourneyAiReportSection } from '@/app/components/JourneyAiReportSection';
import { LEVEL_SLUGS, LEVEL_BAND_LABELS, type LevelBandSlug } from '@/app/constants/levelBands';

function TopicPracticeCard({
  s,
  delayIndex,
  done,
  onPick,
}: {
  s: SubjectMeta;
  delayIndex: number;
  done: boolean;
  onPick: () => void;
}) {
  const anim = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.05 * delayIndex },
  };

  const inner = (
    <>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconBgClass}`}>
          <s.Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="font-semibold text-xs leading-snug truncate">{s.label}</p>
            {done ? (
              <span className="flex items-center gap-1 flex-shrink-0 text-muted-foreground" title="Completed for this session">
                <Lock className="w-3.5 h-3.5" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Locked</span>
              </span>
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.desc}</p>
        </div>
      </div>
    </>
  );

  if (done) {
    return (
      <motion.div
        {...anim}
        className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 relative border-success/30 bg-muted/30 opacity-80 cursor-not-allowed`}
        aria-disabled
        title="Completed — choose another topic to continue"
      >
        {inner}
      </motion.div>
    );
  }

  return (
    <motion.button
      {...anim}
      type="button"
      onClick={onPick}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 group relative bg-card hover:shadow-md ${s.accentClass}`}
    >
      {inner}
    </motion.button>
  );
}

export function Results() {
  const {
    userProgress,
    setCurrentScreen,
    addChatMessage,
    setChatOpen,
    lastSessionResults,
    setStartPracticeWithWeakAreas,
    setPendingWeakPracticeBankIds,
    setSubjectSelectFor,
    setSelectedPracticeSubject,
    completedPracticeSubjects,
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

  function levelBandChartLabel(key: string): string {
    if (key in LEVEL_BAND_LABELS) return LEVEL_BAND_LABELS[key as LevelBandSlug];
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Level-band breakdown (three bands); legacy session keys normalize to easy | medium | hard
  const barData = lastSessionResults?.byDifficulty
    ? [
        ...LEVEL_SLUGS.filter((d) => lastSessionResults.byDifficulty[d]?.total).map((d) => ({
          difficulty: LEVEL_BAND_LABELS[d],
          correct: lastSessionResults.byDifficulty[d].correct,
          total: lastSessionResults.byDifficulty[d].total,
        })),
        ...Object.keys(lastSessionResults.byDifficulty)
          .filter((k) => !(LEVEL_SLUGS as readonly string[]).includes(k) && lastSessionResults.byDifficulty[k]?.total)
          .map((k) => ({
            difficulty: levelBandChartLabel(k),
            correct: lastSessionResults.byDifficulty[k].correct,
            total: lastSessionResults.byDifficulty[k].total,
          })),
      ]
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
        {lastSessionResults?.mistakesTestCombinedAnalytics && (
          <ThreeStageCombinedAnalyticsSection data={lastSessionResults.mistakesTestCombinedAnalytics} />
        )}

        <JourneyAiReportSection />

        {lastSessionResults?.stageOneAssessment && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <Card className="p-6 md:p-8 border-violet-500/30 bg-gradient-to-br from-violet-500/[0.07] to-background">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    Stage 1 · Topic assessment
                  </p>
                  <h2 className="text-xl font-bold mt-1">{lastSessionResults.stageOneAssessment.topicLabel}</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-prose">
                    {lastSessionResults.stageOneAssessment.narrative}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-lg font-bold">
                    {lastSessionResults.stageOneAssessment.statusBand === 'STRONG' && '✅ STRONG'}
                    {lastSessionResults.stageOneAssessment.statusBand === 'AVERAGE' && '⚠️ AVERAGE'}
                    {lastSessionResults.stageOneAssessment.statusBand === 'WEAK' && '❌ WEAK'}
                    {lastSessionResults.stageOneAssessment.statusBand === 'CRITICAL' && '🚨 CRITICAL'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Raw score</p>
                  <p className="text-2xl font-bold">{lastSessionResults.stageOneAssessment.rawScore}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    First-try correct ÷ {lastSessionResults.stageOneAssessment.totalQuestions}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Adjusted score</p>
                  <p className="text-2xl font-bold text-primary">{lastSessionResults.stageOneAssessment.adjustedScore}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">+0.5 per medium wrong</p>
                </div>
                <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20">
                  <p className="text-xs text-amber-800 dark:text-amber-200">Medium wrong 🟡</p>
                  <p className="text-2xl font-bold">{lastSessionResults.stageOneAssessment.mediumWrong}</p>
                </div>
                <div className="rounded-xl bg-rose-500/10 p-3 border border-rose-500/20">
                  <p className="text-xs text-rose-800 dark:text-rose-200">Hard wrong 🔴</p>
                  <p className="text-2xl font-bold">{lastSessionResults.stageOneAssessment.hardWrong}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-muted-foreground">Correct first try</span>
                  <span className="font-semibold">{lastSessionResults.stageOneAssessment.correctFirstTry}</span>
                </div>
                <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-muted-foreground">Skipped (practice Q)</span>
                  <span className="font-semibold">{lastSessionResults.stageOneAssessment.skipped}</span>
                </div>
                <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{lastSessionResults.stageOneAssessment.totalQuestions}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">First-try accuracy by tier</p>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-emerald-500/10 py-2">
                    <div className="font-semibold">
                      {lastSessionResults.stageOneAssessment.easyCorrect}/{lastSessionResults.stageOneAssessment.easyTotal}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Easy</div>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 py-2">
                    <div className="font-semibold">
                      {lastSessionResults.stageOneAssessment.mediumCorrect}/{lastSessionResults.stageOneAssessment.mediumTotal}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Medium</div>
                  </div>
                  <div className="rounded-lg bg-rose-500/10 py-2">
                    <div className="font-semibold">
                      {lastSessionResults.stageOneAssessment.hardCorrect}/{lastSessionResults.stageOneAssessment.hardTotal}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Hard</div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {lastSessionResults?.stageTwoAssessment && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <Card className="p-6 md:p-8 border-teal-500/30 bg-gradient-to-br from-teal-500/[0.07] to-background">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                    Stage 2 · Cross-topic preparation
                  </p>
                  <h2 className="text-xl font-bold mt-1">{lastSessionResults.stageTwoAssessment.topicLabel}</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-prose">
                    {lastSessionResults.stageTwoAssessment.narrative}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-lg font-bold">
                    {lastSessionResults.stageTwoAssessment.statusBand === 'STRONG' && '✅ STRONG'}
                    {lastSessionResults.stageTwoAssessment.statusBand === 'AVERAGE' && '⚠️ AVERAGE'}
                    {lastSessionResults.stageTwoAssessment.statusBand === 'WEAK' && '❌ WEAK'}
                    {lastSessionResults.stageTwoAssessment.statusBand === 'CRITICAL' && '🚨 CRITICAL'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Raw score</p>
                  <p className="text-2xl font-bold">{lastSessionResults.stageTwoAssessment.rawScore}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    First-try correct ÷ {lastSessionResults.stageTwoAssessment.totalQuestions}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Adjusted score</p>
                  <p className="text-2xl font-bold text-primary">{lastSessionResults.stageTwoAssessment.adjustedScore}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">+0.5 per medium wrong</p>
                </div>
                <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20">
                  <p className="text-xs text-amber-800 dark:text-amber-200">Medium wrong 🟡</p>
                  <p className="text-2xl font-bold">{lastSessionResults.stageTwoAssessment.mediumWrong}</p>
                </div>
                <div className="rounded-xl bg-rose-500/10 p-3 border border-rose-500/20">
                  <p className="text-xs text-rose-800 dark:text-rose-200">Hard wrong 🔴</p>
                  <p className="text-2xl font-bold">{lastSessionResults.stageTwoAssessment.hardWrong}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-muted-foreground">Correct first try</span>
                  <span className="font-semibold">{lastSessionResults.stageTwoAssessment.correctFirstTry}</span>
                </div>
                <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-muted-foreground">Skipped (practice Q)</span>
                  <span className="font-semibold">{lastSessionResults.stageTwoAssessment.skipped}</span>
                </div>
                <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{lastSessionResults.stageTwoAssessment.totalQuestions}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">First-try accuracy by tier</p>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-emerald-500/10 py-2">
                    <div className="font-semibold">
                      {lastSessionResults.stageTwoAssessment.easyCorrect}/{lastSessionResults.stageTwoAssessment.easyTotal}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Easy</div>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 py-2">
                    <div className="font-semibold">
                      {lastSessionResults.stageTwoAssessment.mediumCorrect}/{lastSessionResults.stageTwoAssessment.mediumTotal}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Medium</div>
                  </div>
                  <div className="rounded-lg bg-rose-500/10 py-2">
                    <div className="font-semibold">
                      {lastSessionResults.stageTwoAssessment.hardCorrect}/{lastSessionResults.stageTwoAssessment.hardTotal}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Hard</div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {lastSessionResults?.stageTwoProgressAnalytics && (
          <StageTwoProgressAnalyticsSection data={lastSessionResults.stageTwoProgressAnalytics} />
        )}

        {lastSessionResults?.mistakesTestAssessment && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <Card className="p-6 md:p-8 border-rose-500/30 bg-gradient-to-br from-rose-500/[0.07] to-background">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                    Stage 2.5 · Mistakes test
                  </p>
                  <h2 className="text-xl font-bold mt-1">{lastSessionResults.mistakesTestAssessment.topicLabel}</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-prose">
                    {lastSessionResults.mistakesTestAssessment.narrative}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-lg font-bold">
                    {lastSessionResults.mistakesTestAssessment.statusBand === 'STRONG' && '✅ STRONG'}
                    {lastSessionResults.mistakesTestAssessment.statusBand === 'AVERAGE' && '⚠️ AVERAGE'}
                    {lastSessionResults.mistakesTestAssessment.statusBand === 'WEAK' && '❌ WEAK'}
                    {lastSessionResults.mistakesTestAssessment.statusBand === 'CRITICAL' && '🚨 CRITICAL'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Raw score</p>
                  <p className="text-2xl font-bold">{lastSessionResults.mistakesTestAssessment.rawScore}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    First-try ÷ {lastSessionResults.mistakesTestAssessment.totalQuestions}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Adjusted</p>
                  <p className="text-2xl font-bold text-primary">
                    {lastSessionResults.mistakesTestAssessment.adjustedScore}%
                  </p>
                </div>
                <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20">
                  <p className="text-xs text-amber-800 dark:text-amber-200">Medium wrong</p>
                  <p className="text-2xl font-bold">{lastSessionResults.mistakesTestAssessment.mediumWrong}</p>
                </div>
                <div className="rounded-xl bg-rose-500/10 p-3 border border-rose-500/20">
                  <p className="text-xs text-rose-800 dark:text-rose-200">Hard wrong</p>
                  <p className="text-2xl font-bold">{lastSessionResults.mistakesTestAssessment.hardWrong}</p>
                </div>
              </div>

              {(lastSessionResults.mistakesTestAssessment.unresolvedQuestionIds.length > 0 ||
                lastSessionResults.mistakesTestAssessment.teacherAlertSent) && (
                <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
                  <p className="font-semibold text-rose-800 dark:text-rose-200 mb-1">Unresolved / teacher handoff</p>
                  <p className="text-muted-foreground">
                    {lastSessionResults.mistakesTestAssessment.unresolvedQuestionIds.length > 0
                      ? `${lastSessionResults.mistakesTestAssessment.unresolvedQuestionIds.length} bank item(s) still marked hard wrong (needs follow-up).`
                      : 'No unresolved hard-wrong bank items this run.'}
                  </p>
                  {lastSessionResults.mistakesTestAssessment.teacherAlertSent && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Staff see this in the teacher interventions queue (<code className="text-[10px] bg-muted px-1 rounded">intervention_flags</code>
                      ) after the SQL migration is applied.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center text-sm border-t border-border pt-6">
                <div className="rounded-lg bg-emerald-500/10 py-2">
                  <div className="font-semibold">
                    {lastSessionResults.mistakesTestAssessment.easyCorrect}/{lastSessionResults.mistakesTestAssessment.easyTotal}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Easy</div>
                </div>
                <div className="rounded-lg bg-amber-500/10 py-2">
                  <div className="font-semibold">
                    {lastSessionResults.mistakesTestAssessment.mediumCorrect}/{lastSessionResults.mistakesTestAssessment.mediumTotal}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Medium</div>
                </div>
                <div className="rounded-lg bg-rose-500/10 py-2">
                  <div className="font-semibold">
                    {lastSessionResults.mistakesTestAssessment.hardCorrect}/{lastSessionResults.mistakesTestAssessment.hardTotal}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Hard</div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

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
                setPendingWeakPracticeBankIds(
                  lastSessionResults?.weakBankQuestionIds !== undefined
                    ? lastSessionResults.weakBankQuestionIds
                    : null
                );
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

        {/* Next Topics to Practice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <Card className="p-6">
            <h3 className="font-semibold mb-1 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Practice by Topic
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {completedPracticeSubjects.length === 0
                ? 'Pick a topic to start subject-wise practice.'
                : completedPracticeSubjects.length >= SUBJECTS.length
                ? 'All topics completed this session. Completed cards stay locked here.'
                : `${SUBJECTS.length - completedPracticeSubjects.length} topic${SUBJECTS.length - completedPracticeSubjects.length > 1 ? 's' : ''} remaining — keep going!`}
            </p>

            {/* Section A */}
            <div className="mb-5">
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3 px-1">
                Section A — National Topics
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {SUBJECTS.filter((s) => s.section === 'A').map((s, i) => {
                  const done = completedPracticeSubjects.includes(s.key);
                  return (
                    <TopicPracticeCard
                      key={s.key}
                      s={s}
                      delayIndex={i}
                      done={done}
                      onPick={() => {
                        setSelectedPracticeSubject(s.key);
                        setCurrentScreen('practice');
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Section B */}
            <div>
              <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-3 px-1">
                Section B — State Topics
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {SUBJECTS.filter((s) => s.section === 'B').map((s, i) => {
                  const done = completedPracticeSubjects.includes(s.key);
                  return (
                    <TopicPracticeCard
                      key={s.key}
                      s={s}
                      delayIndex={i + 6}
                      done={done}
                      onPick={() => {
                        setSelectedPracticeSubject(s.key);
                        setCurrentScreen('practice');
                      }}
                    />
                  );
                })}
              </div>
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