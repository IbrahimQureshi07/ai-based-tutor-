import { motion } from 'motion/react';
import { Card } from '@/app/components/ui/card';
import type { MistakesTestCombinedAnalyticsPayload } from '@/app/utils/buildMistakesTestCombinedAnalytics';
import type { StatusBand } from '@/app/utils/assessmentScoring';
import { Layers } from 'lucide-react';

function bandBadgeClass(b: StatusBand): string {
  switch (b) {
    case 'STRONG':
      return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30';
    case 'AVERAGE':
      return 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/25';
    case 'WEAK':
      return 'bg-orange-500/15 text-orange-900 dark:text-orange-200 border-orange-500/25';
    case 'CRITICAL':
      return 'bg-rose-500/15 text-rose-900 dark:text-rose-200 border-rose-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function bandShort(b: StatusBand): string {
  if (b === 'STRONG') return 'Strong';
  if (b === 'AVERAGE') return 'Avg';
  if (b === 'WEAK') return 'Weak';
  return 'Crit';
}

function fmtPct(p: number | null): string {
  if (p == null) return '—';
  return `${p}%`;
}

export function ThreeStageCombinedAnalyticsSection({
  data,
}: {
  data: MistakesTestCombinedAnalyticsPayload;
}) {
  const { summary, topicsCompared } = data;
  const visibleRows = topicsCompared.filter(
    (r) =>
      r.stageOneHasAttempt || r.stageTwoSlotCount > 0 || r.stage25SlotCount > 0
  );

  const s2 = summary.stageTwo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 }}
    >
      <Card className="p-6 md:p-8 border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.07] to-background overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Full journey · Stages 1, 2 &amp; 2.5
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Snapshot of your latest Stage 1 topic assessments, your most recent Stage 2 preparation run, and this
              mistakes test. Per-topic columns use first-try accuracy; Stage 2.5 includes an adjusted band (same rules
              as other stages).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Stage 1</p>
            <p className="text-lg font-bold mt-1">Topic assessments</p>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-300 mt-2">
              {summary.stageOneWeightedFirstTryPercent != null
                ? `${summary.stageOneWeightedFirstTryPercent}%`
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Weighted first-try (latest per topic)</p>
            <p className="text-xs text-muted-foreground mt-2">
              Topics with a completed test: <span className="font-semibold text-foreground">{summary.stageOneTopicsAttempted}</span>
            </p>
          </div>

          <div className="rounded-xl border border-teal-500/25 bg-teal-500/[0.06] p-4">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Stage 2</p>
            <p className="text-lg font-bold mt-1">Latest prep run</p>
            {s2.hasData ? (
              <>
                <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 mt-2">{s2.firstTryPercent}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  First-try · raw {s2.rawScore}% · adj {s2.adjustedScore}% ·{' '}
                  <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${bandBadgeClass(s2.statusBand)}`}>
                    {s2.statusBand}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {s2.correctFirstTry}/{s2.totalQuestions} correct first try
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-3">No completed preparation attempt found.</p>
            )}
          </div>

          <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Stage 2.5</p>
            <p className="text-lg font-bold mt-1">This mistakes test</p>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-2">
              {summary.stageTwoFive.firstTryPercent}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              First-try · raw {summary.stageTwoFive.rawScore}% · adj {summary.stageTwoFive.adjustedScore}% ·{' '}
              <span
                className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${bandBadgeClass(summary.stageTwoFive.statusBand)}`}
              >
                {summary.stageTwoFive.statusBand}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {summary.stageTwoFive.correctFirstTry}/{summary.stageTwoFive.totalQuestions} correct first try
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Topic</th>
                <th className="px-3 py-2 font-semibold">S1 first-try</th>
                <th className="px-3 py-2 font-semibold">S2 (latest)</th>
                <th className="px-3 py-2 font-semibold">2.5 first-try</th>
                <th className="px-3 py-2 font-semibold">2.5 band</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No topic-level data for this run.
                  </td>
                </tr>
              ) : (
                visibleRows.map((r) => (
                  <tr key={r.topicCode} className="border-b border-border/80 last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium">{r.topicLabel}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.stageOneHasAttempt ? (
                        <>
                          {fmtPct(r.stageOneFirstTryPercent)}
                          <span className="text-[10px] block text-muted-foreground/80">
                            {r.stageOneCorrectFirstTry}/{r.stageOneTotalQuestions}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.stageTwoSlotCount > 0 ? (
                        <>
                          {fmtPct(r.stageTwoFirstTryPercent)}
                          <span className="text-[10px] block text-muted-foreground/80">
                            {r.stageTwoCorrectFirstTry}/{r.stageTwoSlotCount} slots
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.stage25SlotCount > 0 ? (
                        <>
                          {fmtPct(r.stage25FirstTryPercent)}
                          <span className="text-[10px] block text-muted-foreground/80">
                            {r.stage25CorrectFirstTry}/{r.stage25SlotCount} · M{r.stage25MediumWrong} H
                            {r.stage25HardWrong}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.stage25SlotCount > 0 ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${bandBadgeClass(r.stage25StatusBand)}`}
                        >
                          {bandShort(r.stage25StatusBand)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}
