import { motion } from 'motion/react';
import { Card } from '@/app/components/ui/card';
import type { StageTwoProgressAnalyticsPayload } from '@/app/context/ExamContext';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

function pct(correct: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((correct / total) * 1000) / 10;
}

type Row = StageTwoProgressAnalyticsPayload['topicsCompared'][number];

function shortCode(topicCode: string): string {
  if (topicCode === '__unknown__') return '?';
  const first = topicCode.split(' ')[0];
  return first.length <= 4 ? first : topicCode.slice(0, 3);
}

type ChartRow = {
  code: string;
  fullLabel: string;
  stage1: number;
  stage2: number;
  hasStage1: boolean;
  hasStage2: boolean;
};

export function StageTwoProgressAnalyticsSection({
  data,
}: {
  data: StageTwoProgressAnalyticsPayload;
}) {
  const { topicsCompared, summary } = data;

  const chartRows: ChartRow[] = topicsCompared
    .filter((r) => r.stageTwoSlotCount > 0 || r.stageOneHasAttempt)
    .map((r) => {
      const p1 = r.stageOneHasAttempt ? pct(r.stageOneCorrectFirstTry, r.stageOneTotalQuestions) : null;
      const p2 = r.stageTwoSlotCount > 0 ? pct(r.stageTwoCorrectFirstTry, r.stageTwoSlotCount) : null;
      return {
        code: shortCode(r.topicCode),
        fullLabel: r.topicLabel,
        stage1: p1 ?? 0,
        stage2: p2 ?? 0,
        hasStage1: r.stageOneHasAttempt,
        hasStage2: r.stageTwoSlotCount > 0,
      };
    });

  const overallCompare = [
    {
      name: 'Stage 1 (weighted)',
      pct: summary.stageOneWeightedFirstTryPercent ?? 0,
      fill: summary.stageOneWeightedFirstTryPercent == null ? '#94a3b8' : '#8b5cf6',
      empty: summary.stageOneWeightedFirstTryPercent == null,
    },
    {
      name: 'Stage 2 (this run)',
      pct: summary.stageTwoFirstTryPercent,
      fill: '#14b8a6',
      empty: false,
    },
  ];

  const deltaPrepVsWeighted =
    summary.stageOneWeightedFirstTryPercent != null
      ? Math.round((summary.stageTwoFirstTryPercent - summary.stageOneWeightedFirstTryPercent) * 10) / 10
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="p-6 md:p-8 border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.06] to-background">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Progress · Stage 1 vs this preparation run
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Compare your latest Stage 1 topic tests (snapshot when this run started) with first-try accuracy on
              each subject in this Stage 2 session. Skips on practice variants are counted per topic where possible.
            </p>
          </div>
          {deltaPrepVsWeighted != null && (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-2 text-right shrink-0">
              <p className="text-[10px] uppercase text-muted-foreground">Prep vs Stage 1 weighted</p>
              <p
                className={`text-lg font-bold ${deltaPrepVsWeighted >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
              >
                {deltaPrepVsWeighted >= 0 ? '+' : ''}
                {deltaPrepVsWeighted}% pts
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Stage 1 topics done</p>
            <p className="text-2xl font-bold">{summary.stageOneTopicsAttempted}</p>
          </div>
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3">
            <p className="text-[10px] text-muted-foreground uppercase">S1 weighted first-try</p>
            <p className="text-2xl font-bold">
              {summary.stageOneWeightedFirstTryPercent != null
                ? `${summary.stageOneWeightedFirstTryPercent}%`
                : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Across completed topic tests</p>
          </div>
          <div className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-3">
            <p className="text-[10px] text-muted-foreground uppercase">This run first-try</p>
            <p className="text-2xl font-bold">{summary.stageTwoFirstTryPercent}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {summary.stageTwoCorrectFirstTry}/{summary.stageTwoTotalSlots} questions
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Skips</p>
            <p className="text-sm font-semibold">
              Stage 1 sum: <span className="text-foreground">{summary.stageOneSkipsSum}</span>
            </p>
            <p className="text-sm font-semibold">
              This run: <span className="text-foreground">{summary.stageTwoSkippedTotal}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Overall first-try % (headline)</p>
            <div className="h-[220px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overallCompare} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, _n, p) => {
                      const empty = (p?.payload as { empty?: boolean })?.empty;
                      if (empty) return ['No completed Stage 1 data yet', ''];
                      return [`${value}%`, 'First-try'];
                    }}
                  />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} name="First-try %">
                    {overallCompare.map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {summary.stageOneAvgFirstTryPercent != null && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Avg first-try % per topic (attempted only):{' '}
                <span className="font-medium text-foreground">{summary.stageOneAvgFirstTryPercent}%</span>
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Per-topic first-try % (Stage 1 last test vs Stage 2 this run)
            </p>
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ bottom: 56, left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="code"
                    tick={{ fontSize: 10 }}
                    angle={-40}
                    textAnchor="end"
                    height={54}
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={36} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload as ChartRow;
                      return (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                          <p className="font-semibold mb-1">{row.fullLabel}</p>
                          <p className="text-muted-foreground">
                            Stage 1:{' '}
                            {row.hasStage1 ? `${row.stage1}%` : 'No topic test yet'}
                          </p>
                          <p className="text-muted-foreground">
                            Stage 2:{' '}
                            {row.hasStage2 ? `${row.stage2}%` : 'Not in this mix'}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar
                    name="Stage 1 (last)"
                    dataKey="stage1"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    name="Stage 2 (run)"
                    dataKey="stage2"
                    fill="#14b8a6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Detail by topic</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="p-2 pl-3 font-medium">Topic</th>
                  <th className="p-2 font-medium">S1 first-try</th>
                  <th className="p-2 font-medium">S1 M/H wrong</th>
                  <th className="p-2 font-medium">S1 skip</th>
                  <th className="p-2 font-medium">S2 slots</th>
                  <th className="p-2 font-medium">S2 first-try</th>
                  <th className="p-2 font-medium">S2 M/H</th>
                  <th className="p-2 font-medium">S2 skip</th>
                  <th className="p-2 pr-3 font-medium">Δ % pts</th>
                </tr>
              </thead>
              <tbody>
                {topicsCompared.map((r: Row) => {
                  const p1 = pct(r.stageOneCorrectFirstTry, r.stageOneTotalQuestions);
                  const p2 = pct(r.stageTwoCorrectFirstTry, r.stageTwoSlotCount);
                  const delta =
                    p1 != null && p2 != null ? Math.round((p2 - p1) * 10) / 10 : null;
                  return (
                    <tr key={r.topicCode} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="p-2 pl-3 font-medium max-w-[200px] truncate" title={r.topicLabel}>
                        {r.topicLabel}
                      </td>
                      <td className="p-2 tabular-nums">
                        {r.stageOneHasAttempt
                          ? `${r.stageOneCorrectFirstTry}/${r.stageOneTotalQuestions}${
                              p1 != null ? ` (${p1}%)` : ''
                            }`
                          : '—'}
                      </td>
                      <td className="p-2 tabular-nums text-amber-800/90 dark:text-amber-200/90">
                        {r.stageOneHasAttempt ? `${r.stageOneMediumWrong} / ${r.stageOneHardWrong}` : '—'}
                      </td>
                      <td className="p-2 tabular-nums">{r.stageOneHasAttempt ? r.stageOneSkipped : '—'}</td>
                      <td className="p-2 tabular-nums">{r.stageTwoSlotCount}</td>
                      <td className="p-2 tabular-nums">
                        {r.stageTwoSlotCount > 0
                          ? `${r.stageTwoCorrectFirstTry}/${r.stageTwoSlotCount}${
                              p2 != null ? ` (${p2}%)` : ''
                            }`
                          : '—'}
                      </td>
                      <td className="p-2 tabular-nums text-amber-800/90 dark:text-amber-200/90">
                        {r.stageTwoSlotCount > 0 ? `${r.stageTwoMediumWrong} / ${r.stageTwoHardWrong}` : '—'}
                      </td>
                      <td className="p-2 tabular-nums">{r.stageTwoSkipped}</td>
                      <td className="p-2 pr-3 tabular-nums font-medium">
                        {delta != null ? (
                          <span className={delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {delta >= 0 ? '+' : ''}
                            {delta}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
