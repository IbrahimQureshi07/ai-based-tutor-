import { supabase } from '@/app/services/supabase';
import { fetchLatestCompletedPreparationSummary } from '@/app/services/practiceStageTwo';
import { fetchLatestStageOneRollupByTopic } from '@/app/services/practiceStageTwoAggregation';
import type { StatusBand } from '@/app/utils/assessmentScoring';

export type CrossTestStageRow = {
  id: 'stage1' | 'stage2' | 'mistakes' | 'mock' | 'final';
  shortLabel: string;
  hasData: boolean;
  /** Weighted first-try % (S1), or first-try % for S2 / 2.5 / mock attempt */
  firstTryPercent: number | null;
  /** Stage 2 & 2.5: adjusted score %; mock: slot-final %; S1: weighted raw % if available */
  secondaryPercent: number | null;
  secondaryLabel: string;
  statusBand: StatusBand | null;
  completedAt: string | null;
  note?: string;
  /** Final exam only */
  finalGrade?: string | null;
  finalPassed?: boolean | null;
};

/** Dashboard hero strip — derived from latest completed attempts + today’s activity (local calendar). */
export type DashboardHeroMetrics = {
  totalSlots: number;
  correctFirstTrySlots: number;
  accuracy: number;
  examReadiness: number;
  rank: string;
  level: number;
  todaysCompletedSlots: number;
  dayStreak: number;
};

export type CrossTestAnalyticsPayload = {
  stages: CrossTestStageRow[];
  /** Populated when pipeline data exists or today/streak queries succeed; null if nothing to show. */
  heroMetrics: DashboardHeroMetrics | null;
};

async function fetchLatestMistakesAttempt(userId: string): Promise<{
  totalQuestions: number;
  correctFirstTry: number;
  rawScore: number;
  adjustedScore: number;
  statusBand: StatusBand;
  completedAt: string | null;
} | null> {
  const { data, error } = await supabase
    .from('mistakes_test_attempts')
    .select('total_questions, correct_first_try, raw_score, adjusted_score, status_band, completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[crossTestAnalytics] mistakes attempt', error.message);
    return null;
  }
  const row = data as {
    total_questions: number;
    correct_first_try: number;
    raw_score: number | string | null;
    adjusted_score: number | string | null;
    status_band: string | null;
    completed_at: string | null;
  };
  const raw = row.raw_score == null ? 0 : Number(row.raw_score);
  const adj = row.adjusted_score == null ? 0 : Number(row.adjusted_score);
  return {
    totalQuestions: row.total_questions ?? 0,
    correctFirstTry: row.correct_first_try ?? 0,
    rawScore: Number.isFinite(raw) ? Math.round(raw * 10) / 10 : 0,
    adjustedScore: Number.isFinite(adj) ? Math.round(adj * 10) / 10 : 0,
    statusBand: ((row.status_band as StatusBand) || 'AVERAGE') as StatusBand,
    completedAt: row.completed_at,
  };
}

async function fetchLatestMockAttempt(userId: string): Promise<{
  totalQuestions: number;
  firstTryCorrect: number;
  percentFinal: number;
  hasCriticalBand: boolean;
  isPass: boolean;
  completedAt: string | null;
} | null> {
  const { data, error } = await supabase
    .from('mock_test_attempts')
    .select(
      'total_questions, first_try_correct_count, percent_final, has_critical_band, is_pass, completed_at'
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[crossTestAnalytics] mock attempt', error.message);
    return null;
  }
  const row = data as {
    total_questions: number;
    first_try_correct_count: number;
    percent_final: number | string | null;
    has_critical_band: boolean | null;
    is_pass: boolean | null;
    completed_at: string | null;
  };
  const pf = row.percent_final == null ? 0 : Number(row.percent_final);
  return {
    totalQuestions: row.total_questions ?? 0,
    firstTryCorrect: row.first_try_correct_count ?? 0,
    percentFinal: Number.isFinite(pf) ? Math.round(Number(pf) * 10) / 10 : 0,
    hasCriticalBand: !!row.has_critical_band,
    isPass: !!row.is_pass,
    completedAt: row.completed_at,
  };
}

async function fetchLatestFinalExamAttempt(userId: string): Promise<{
  totalQuestions: number;
  correctCount: number;
  percentFinal: number;
  grade: string;
  isPass: boolean;
  completedAt: string | null;
} | null> {
  const { data, error } = await supabase
    .from('final_exam_attempts')
    .select('total_questions, correct_count, percent_final, grade, is_pass, completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[crossTestAnalytics] final exam attempt', error.message);
    return null;
  }
  const row = data as {
    total_questions: number | null;
    correct_count: number | null;
    percent_final: number | string | null;
    grade: string | null;
    is_pass: boolean | null;
    completed_at: string | null;
  };
  const pf = row.percent_final == null ? 0 : Number(row.percent_final);
  return {
    totalQuestions: row.total_questions ?? 0,
    correctCount: row.correct_count ?? 0,
    percentFinal: Number.isFinite(pf) ? Math.round(Number(pf) * 10) / 10 : 0,
    grade: row.grade ?? '—',
    isPass: !!row.is_pass,
    completedAt: row.completed_at,
  };
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localDayStartEnd(): { startISO: string; endISO: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/** Mirrors `ExamContext` rank thresholds (uses unrounded readiness). */
function rankFromPipelineReadiness(readiness: number): string {
  if (readiness >= 90) return 'Expert';
  if (readiness >= 70) return 'Advanced';
  if (readiness >= 50) return 'Intermediate';
  if (readiness >= 30) return 'Learner';
  return 'Beginner';
}

function computeDayStreak(activity: Set<string>): number {
  if (activity.size === 0) return 0;
  const check = new Date();
  check.setHours(0, 0, 0, 0);
  if (!activity.has(toLocalYmd(check))) {
    check.setDate(check.getDate() - 1);
  }
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const ymd = toLocalYmd(check);
    if (activity.has(ymd)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

const PIPELINE_ATTEMPT_TABLES = [
  'assessment_topic_attempts',
  'practice_preparation_attempts',
  'mistakes_test_attempts',
  'mock_test_attempts',
  'final_exam_attempts',
] as const;

async function sumCompletedSlotsInRange(
  userId: string,
  startISO: string,
  endISO: string
): Promise<number> {
  const results = await Promise.all(
    PIPELINE_ATTEMPT_TABLES.map((table) =>
      supabase
        .from(table)
        .select('total_questions')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', startISO)
        .lt('completed_at', endISO)
    )
  );
  let sum = 0;
  for (const { data, error } of results) {
    if (error) {
      console.warn('[crossTestAnalytics] sum slots in range', error.message);
      continue;
    }
    for (const row of data ?? []) {
      const n = Number((row as { total_questions: number | null }).total_questions);
      sum += Number.isFinite(n) ? n : 0;
    }
  }
  return sum;
}

async function collectPipelineActivityLocalDates(userId: string, sinceISO: string): Promise<Set<string>> {
  const results = await Promise.all(
    PIPELINE_ATTEMPT_TABLES.map((table) =>
      supabase
        .from(table)
        .select('completed_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', sinceISO)
        .limit(800)
    )
  );
  const dates = new Set<string>();
  for (const { data, error } of results) {
    if (error) {
      console.warn('[crossTestAnalytics] activity dates', error.message);
      continue;
    }
    for (const row of data ?? []) {
      const ca = (row as { completed_at: string | null }).completed_at;
      if (!ca) continue;
      dates.add(toLocalYmd(new Date(ca)));
    }
  }
  return dates;
}

function buildHeroMetrics(params: {
  sumS1Slots: number;
  sumS1CorrectFirstTry: number;
  s2: Awaited<ReturnType<typeof fetchLatestCompletedPreparationSummary>>;
  m25: Awaited<ReturnType<typeof fetchLatestMistakesAttempt>>;
  mock: Awaited<ReturnType<typeof fetchLatestMockAttempt>>;
  fin: Awaited<ReturnType<typeof fetchLatestFinalExamAttempt>>;
  todaysCompletedSlots: number;
  dayStreak: number;
}): DashboardHeroMetrics | null {
  const { sumS1Slots, sumS1CorrectFirstTry, s2, m25, mock, fin, todaysCompletedSlots, dayStreak } = params;

  let totalSlots = sumS1Slots;
  let correctFirstTrySlots = sumS1CorrectFirstTry;

  const T2 = s2?.totalQuestions ?? 0;
  if (s2 && T2 > 0) {
    totalSlots += T2;
    correctFirstTrySlots += s2.correctFirstTry;
  }
  const T25 = m25?.totalQuestions ?? 0;
  if (m25 && T25 > 0) {
    totalSlots += T25;
    correctFirstTrySlots += m25.correctFirstTry;
  }
  const Tm = mock?.totalQuestions ?? 0;
  if (mock && Tm > 0) {
    totalSlots += Tm;
    correctFirstTrySlots += mock.firstTryCorrect;
  }
  const Tf = fin?.totalQuestions ?? 0;
  if (fin && Tf > 0) {
    totalSlots += Tf;
    correctFirstTrySlots += Math.min(Tf, Math.max(0, fin.correctCount));
  }

  if (totalSlots <= 0 && todaysCompletedSlots <= 0 && dayStreak <= 0) {
    return null;
  }

  const accuracy =
    totalSlots > 0 ? Math.min(100, Math.round((correctFirstTrySlots / totalSlots) * 100)) : 0;
  const readinessRaw =
    totalSlots >= 5 ? accuracy : (totalSlots / 5) * accuracy;
  const examReadiness = Math.min(100, Math.round(readinessRaw));
  const rank = rankFromPipelineReadiness(readinessRaw);
  const level = totalSlots > 0 ? Math.floor(totalSlots / 10) + 1 : 1;

  return {
    totalSlots,
    correctFirstTrySlots,
    accuracy,
    examReadiness,
    rank,
    level,
    todaysCompletedSlots,
    dayStreak,
  };
}

/**
 * Phase 8 — one row per pipeline stage from latest **completed** attempts in Supabase.
 */
export async function fetchCrossTestAnalytics(userId: string): Promise<CrossTestAnalyticsPayload> {
  const [s1Map, s2, m25, mock, fin] = await Promise.all([
    fetchLatestStageOneRollupByTopic(userId),
    fetchLatestCompletedPreparationSummary(userId),
    fetchLatestMistakesAttempt(userId),
    fetchLatestMockAttempt(userId),
    fetchLatestFinalExamAttempt(userId),
  ]);

  let sumCf = 0;
  let sumT = 0;
  let sumRaw = 0;
  let nTopics = 0;
  for (const [, v] of s1Map) {
    if (v.hasAttempt) {
      sumCf += v.correctFirstTry;
      sumT += v.totalQuestions;
      sumRaw += v.rawScore;
      nTopics += 1;
    }
  }
  const s1FirstTry = sumT > 0 ? Math.round((sumCf / sumT) * 1000) / 10 : null;
  const s1RawAvg = nTopics > 0 ? Math.round((sumRaw / nTopics) * 10) / 10 : null;

  const T2 = s2?.totalQuestions ?? 0;
  const s2Ft = T2 > 0 && s2 ? Math.round(((s2.correctFirstTry / T2) * 1000) / 10) : null;

  const T25 = m25?.totalQuestions ?? 0;
  const m25Ft =
    T25 > 0 && m25 ? Math.round(((m25.correctFirstTry / T25) * 1000) / 10) : null;

  const Tm = mock?.totalQuestions ?? 0;
  const mockFt = Tm > 0 && mock ? Math.round(((mock.firstTryCorrect / Tm) * 1000) / 10) : null;

  const stages: CrossTestStageRow[] = [
    {
      id: 'stage1',
      shortLabel: 'Stage 1',
      hasData: s1FirstTry != null,
      firstTryPercent: s1FirstTry,
      secondaryPercent: s1RawAvg,
      secondaryLabel: 'Avg raw % (topics)',
      statusBand: null,
      completedAt: null,
      note: 'Weighted by questions across topics with a completed assessment.',
    },
    {
      id: 'stage2',
      shortLabel: 'Stage 2',
      hasData: !!s2 && T2 > 0,
      firstTryPercent: s2Ft,
      secondaryPercent: s2 ? s2.adjustedScore : null,
      secondaryLabel: 'Adjusted %',
      statusBand: s2?.statusBand ?? null,
      completedAt: s2?.completedAt ?? null,
    },
    {
      id: 'mistakes',
      shortLabel: 'Stage 2.5',
      hasData: !!m25 && T25 > 0,
      firstTryPercent: m25Ft,
      secondaryPercent: m25 ? m25.adjustedScore : null,
      secondaryLabel: 'Adjusted %',
      statusBand: m25?.statusBand ?? null,
      completedAt: m25?.completedAt ?? null,
    },
    {
      id: 'mock',
      shortLabel: 'Mock',
      hasData: !!mock && Tm > 0,
      firstTryPercent: mockFt,
      secondaryPercent: mock ? mock.percentFinal : null,
      secondaryLabel: 'Final % (slots)',
      statusBand: null,
      completedAt: mock?.completedAt ?? null,
      note: mock
        ? mock.isPass
          ? 'Passed mock rules.'
          : mock.hasCriticalBand
            ? 'Failed: CRITICAL topic or below threshold.'
            : 'Failed: below pass threshold.'
        : undefined,
    },
    {
      id: 'final',
      shortLabel: 'Final',
      hasData: !!fin && (fin.totalQuestions ?? 0) > 0,
      firstTryPercent: fin ? fin.percentFinal : null,
      secondaryPercent: null,
      secondaryLabel: '—',
      statusBand: null,
      completedAt: fin?.completedAt ?? null,
      finalGrade: fin?.grade ?? null,
      finalPassed: fin != null ? fin.isPass : null,
      note: fin
        ? fin.isPass
          ? `Passed final exam · Grade ${fin.grade}`
          : `Not passed · Grade ${fin.grade}`
        : undefined,
    },
  ];

  const { startISO, endISO } = localDayStartEnd();
  const sinceStreak = new Date();
  sinceStreak.setDate(sinceStreak.getDate() - 120);
  sinceStreak.setHours(0, 0, 0, 0);

  const [todaysCompletedSlots, activityDates] = await Promise.all([
    sumCompletedSlotsInRange(userId, startISO, endISO),
    collectPipelineActivityLocalDates(userId, sinceStreak.toISOString()),
  ]);
  const dayStreak = computeDayStreak(activityDates);

  const heroMetrics = buildHeroMetrics({
    sumS1Slots: sumT,
    sumS1CorrectFirstTry: sumCf,
    s2,
    m25,
    mock,
    fin,
    todaysCompletedSlots,
    dayStreak,
  });

  return { stages, heroMetrics };
}
