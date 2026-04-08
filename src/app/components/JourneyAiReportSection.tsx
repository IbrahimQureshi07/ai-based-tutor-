import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { getCurrentUserId } from '@/app/services/userWrongQuestions';
import {
  generateCombinedJourneyReport,
  type CombinedJourneyAiReport,
} from '@/app/services/aiService';
import {
  buildJourneyReportSnapshot,
  subjectStrengthLabel,
  type JourneyReportSnapshot,
} from '@/app/utils/buildJourneyReportSnapshot';
import {
  fetchLatestJourneyAiReport,
  saveJourneyAiReport,
} from '@/app/services/journeyAiReports';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { ClipboardCopy, Loader2, Sparkles, Target } from 'lucide-react';
import { toast } from 'sonner';

function strengthBadgeClass(s: 'strong' | 'average' | 'weak' | 'unknown'): string {
  if (s === 'strong') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30';
  if (s === 'average') return 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30';
  if (s === 'weak') return 'bg-rose-500/15 text-rose-900 dark:text-rose-200 border-rose-500/30';
  return 'bg-muted text-muted-foreground border-border';
}

function strengthWord(s: 'strong' | 'average' | 'weak' | 'unknown'): string {
  if (s === 'unknown') return '—';
  return s === 'strong' ? 'Strong' : s === 'average' ? 'Average' : 'Needs work';
}

function mockHeuristic(snapshot: JourneyReportSnapshot | null): string {
  if (!snapshot) return '';
  const { app, gates } = snapshot;
  if (app.mockTestsCompleted > 0) {
    return `You have completed ${app.mockTestsCompleted} mock test(s). Readiness ${app.examReadiness}%.`;
  }
  if (app.mockUnlockedByReadiness) {
    return 'Your latest Stage 2.5 run is non-critical, so mock can be attempted now.';
  }
  if (!gates.stageOneStarted) {
    return 'Finish at least one Stage 1 topic to unlock Stage 2 progression.';
  }
  return 'Pass Stage 2.5 without CRITICAL status to unlock mock.';
}

export function JourneyAiReportSection() {
  const { lastSessionResults, userProgress } = useApp();
  const [userId, setUserId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<JourneyReportSnapshot | null>(null);
  const [snapLoading, setSnapLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<CombinedJourneyAiReport | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  /** ISO timestamp of latest saved row (DB) for the AI block */
  const [savedReportAt, setSavedReportAt] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const uid = await getCurrentUserId();
      setUserId(uid);
      if (!uid) {
        setSnapLoading(false);
        return;
      }
      setSnapLoading(true);
      setAiReport(null);
      setSavedReportAt(null);
      try {
        const [s, latest] = await Promise.all([
          buildJourneyReportSnapshot(uid, lastSessionResults, userProgress),
          fetchLatestJourneyAiReport(uid),
        ]);
        setSnapshot(s);
        if (latest?.ai_report_json) {
          setAiReport(latest.ai_report_json);
          setSavedReportAt(latest.created_at);
        }
      } catch (e) {
        console.warn('[JourneyAiReportSection] snapshot', e);
        setSnapshot(null);
      } finally {
        setSnapLoading(false);
      }
    })();
  }, [lastSessionResults, userProgress]);

  const runAi = useCallback(async () => {
    if (!snapshot || !userId) {
      toast.error('No journey data yet.');
      return;
    }
    setAiError(null);
    setAiLoading(true);
    try {
      const r = await generateCombinedJourneyReport(snapshot);
      setAiReport(r);
      const createdAt = await saveJourneyAiReport({
        userId,
        snapshot,
        aiReport: r,
      });
      if (createdAt) {
        setSavedReportAt(createdAt);
        toast.success('Coach report ready and saved');
      } else {
        toast.success('Coach report ready (save to cloud failed — check journey_ai_reports table)');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI report failed';
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  }, [snapshot, userId]);

  const copySnapshot = async () => {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      toast.success('Snapshot JSON copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 }}
    >
      <Card className="p-6 md:p-8 border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/[0.07] via-background to-violet-500/[0.05] overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-fuchsia-500/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-fuchsia-600 dark:text-fuchsia-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-400">
                Full journey · Stages 1 → 2 → 2.5
              </p>
              <h2 className="text-xl font-bold mt-1">Coach report &amp; mock readiness</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Topic strength uses your latest Stage 1 first-try % per subject (75%+ strong, 50–74% average, below 50%
                needs work). Stage 2 columns use your most recent completed prep run. Generate AI for a written plan,
                follow-ups, and mock guidance—reports save to your account and load again when you open Results.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={() => void copySnapshot()} disabled={!snapshot}>
              <ClipboardCopy className="w-3.5 h-3.5 mr-1.5" />
              Copy data JSON
            </Button>
            <Button type="button" size="sm" onClick={() => void runAi()} disabled={!snapshot || aiLoading || snapLoading}>
              {aiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Generate AI coach report
                </>
              )}
            </Button>
          </div>
        </div>

        {snapLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your journey from the database…
          </p>
        ) : !snapshot ? (
          <p className="text-sm text-muted-foreground">Could not load journey data.</p>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-muted/30 p-4 mb-6 flex flex-wrap items-start gap-3">
              <Target className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Mock &amp; readiness</p>
                <p className="text-sm mt-1">{mockHeuristic(snapshot)}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Gates: Stage 1 started · {snapshot.gates.stageOneStarted ? 'yes' : 'no'} · Stage 2 prep ·{' '}
                  {snapshot.gates.stageTwoPrepUnlocked ? 'unlocked' : 'locked'} · Mistakes test ·{' '}
                  {snapshot.gates.mistakesTestUnlocked ? 'unlocked' : 'locked'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-x-auto mb-6">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Topic</th>
                    <th className="px-3 py-2 font-semibold">Stage 1 first-try</th>
                    <th className="px-3 py-2 font-semibold">Strength</th>
                    <th className="px-3 py-2 font-semibold">M/H wrongs (S1)</th>
                    <th className="px-3 py-2 font-semibold">Latest S2 (slots)</th>
                    <th className="px-3 py-2 font-semibold">S2 first-try</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.stage1ByTopic.map((row) => {
                    const s2 = snapshot.stage2ByTopic.find((t) => t.topicCode === row.topicCode);
                    const st = subjectStrengthLabel(row.firstTryPercent, row.hasAttempt);
                    return (
                      <tr key={row.topicCode} className="border-b border-border/70 last:border-0">
                        <td className="px-3 py-2.5 font-medium">{row.topicLabel}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {row.hasAttempt && row.firstTryPercent != null ? `${row.firstTryPercent}%` : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${strengthBadgeClass(st)}`}
                          >
                            {strengthWord(st)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {row.hasAttempt ? `${row.mediumWrong} / ${row.hardWrong}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {s2 && s2.slots > 0 ? s2.slots : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {s2 && s2.slots > 0 && s2.firstTryPercent != null ? `${s2.firstTryPercent}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {snapshot.stage1Summary.topicsAttempted > 0 && (
              <p className="text-xs text-muted-foreground mb-4">
                Stage 1 weighted first-try (latest per topic):{' '}
                <span className="font-semibold text-foreground">
                  {snapshot.stage1Summary.weightedFirstTryPercent != null
                    ? `${snapshot.stage1Summary.weightedFirstTryPercent}%`
                    : '—'}
                </span>{' '}
                · topics with data: {snapshot.stage1Summary.topicsAttempted}
              </p>
            )}

            {snapshot.unresolvedQuestionIds.length > 0 && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 mb-6 text-sm">
                <p className="font-semibold text-rose-800 dark:text-rose-200">Unresolved (this session)</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                  {snapshot.unresolvedQuestionIds.slice(0, 12).join(', ')}
                  {snapshot.unresolvedQuestionIds.length > 12
                    ? ` … +${snapshot.unresolvedQuestionIds.length - 12} more`
                    : ''}
                </p>
              </div>
            )}

            {aiError && (
              <p className="text-sm text-destructive mb-4" role="alert">
                {aiError}
              </p>
            )}

            {aiReport && (
              <div className="space-y-5 border-t border-border pt-6">
                {savedReportAt && (
                  <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                    Saved report · {new Date(savedReportAt).toLocaleString()} · Table above reflects live data; AI text is
                    from this save until you generate again.
                  </p>
                )}
                <div>
                  <h3 className="text-lg font-bold">{aiReport.headline}</h3>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">Trajectory: {aiReport.trajectory.replace('_', ' ')}</p>
                </div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-w-prose">
                  {aiReport.narrative}
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold uppercase text-primary">Mock readiness (AI)</p>
                  <p className="text-sm font-semibold mt-1 capitalize">{aiReport.mock_readiness.verdict.replace('_', ' ')}</p>
                  <p className="text-sm text-muted-foreground mt-2">{aiReport.mock_readiness.rationale}</p>
                </div>
                {aiReport.subject_insights.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Subject insights</p>
                    <ul className="space-y-2">
                      {aiReport.subject_insights.map((x, idx) => (
                        <li key={`${x.topic_code}-${idx}`} className="text-sm rounded-lg border border-border/60 p-3">
                          <span className="font-semibold">{x.label || x.topic_code}</span>{' '}
                          <span className="text-xs text-muted-foreground">({x.strength})</span>
                          <p className="text-muted-foreground mt-1">{x.tip}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiReport.priorities.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Priorities</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {aiReport.priorities.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiReport.next_steps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Next steps</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {aiReport.next_steps.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Card>
    </motion.div>
  );
}
