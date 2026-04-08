import { motion } from 'motion/react';
import { Card } from '@/app/components/ui/card';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CrossTestAnalyticsPayload } from '@/app/services/crossTestAnalytics';
import type { StatusBand } from '@/app/utils/assessmentScoring';
import { BarChart3 } from 'lucide-react';

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

export function CrossTestAnalyticsSection({
  data,
  loading,
  error,
}: {
  data: CrossTestAnalyticsPayload | null;
  loading: boolean;
  error: string | null;
}) {
  const chartRows =
    data?.stages
      .filter((s) => s.hasData)
      .map((s) => ({
        name: s.shortLabel,
        firstTry: s.firstTryPercent ?? 0,
        secondary: s.secondaryPercent ?? 0,
      })) ?? [];

  const anyData = data?.stages.some((s) => s.hasData);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="p-6 md:p-8 border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.06] to-background overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Progress across stages
            </p>
            <h3 className="text-lg font-bold mt-1">Your scores at a glance</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Your latest finished score for each step, side by side. Teal = first try; purple = adjusted or final.
            </p>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground py-10 text-center">Loading chart…</p>
        )}
        {!loading && error && (
          <p className="text-sm text-destructive py-6">{error}</p>
        )}
        {!loading && !error && !anyData && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Finish any stage test once to see your comparison here.
          </p>
        )}
        {!loading && !error && anyData && (
          <>
            <div className="h-72 w-full min-w-0 mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={36} label={{ value: '%', angle: 0, position: 'insideTopLeft', offset: 4 }} />
                  <Tooltip formatter={(value: number) => [`${value}%`, '']} />
                  <Legend />
                  <Bar dataKey="firstTry" fill="#06b6d4" name="First-try %" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="secondary" fill="#8b5cf6" name="Adjusted / final %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {data!.stages.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-xl border p-3 text-sm ${
                    s.hasData ? 'border-border bg-card/80' : 'border-dashed border-muted-foreground/30 bg-muted/20 opacity-80'
                  }`}
                >
                  <p className="font-semibold text-foreground">{s.shortLabel}</p>
                  {!s.hasData ? (
                    <p className="text-xs text-muted-foreground mt-2">No completed attempt yet.</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mt-1">
                        First-try:{' '}
                        <span className="font-bold text-foreground">{s.firstTryPercent}%</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.secondaryLabel}:{' '}
                        <span className="font-semibold text-foreground">{s.secondaryPercent}%</span>
                      </p>
                      {s.statusBand && (
                        <span
                          className={`inline-flex mt-2 px-2 py-0.5 rounded text-[10px] font-bold border ${bandBadgeClass(s.statusBand)}`}
                        >
                          {s.statusBand}
                        </span>
                      )}
                      {s.note && <p className="text-[10px] text-muted-foreground mt-2 leading-snug">{s.note}</p>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </motion.div>
  );
}
