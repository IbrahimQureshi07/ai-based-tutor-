import { supabase } from '@/app/services/supabase';

export type InterventionFlagStatus = 'open' | 'acknowledged' | 'resolved';

export type InterventionFlagRow = {
  id: string;
  user_id: string;
  kind: string;
  source_alert_id: string | null;
  payload: Record<string, unknown>;
  status: InterventionFlagStatus;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

function mapRow(r: Record<string, unknown>): InterventionFlagRow {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    kind: String(r.kind ?? ''),
    source_alert_id: r.source_alert_id == null ? null : String(r.source_alert_id),
    payload: (typeof r.payload === 'object' && r.payload !== null ? r.payload : {}) as Record<
      string,
      unknown
    >,
    status: (r.status as InterventionFlagStatus) ?? 'open',
    admin_note: r.admin_note == null ? null : String(r.admin_note),
    created_at: String(r.created_at ?? ''),
    resolved_at: r.resolved_at == null ? null : String(r.resolved_at),
    resolved_by: r.resolved_by == null ? null : String(r.resolved_by),
  };
}

export async function fetchInterventionFlagsForStaff(): Promise<InterventionFlagRow[]> {
  const { data, error } = await supabase
    .from('intervention_flags')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[interventionFlags] fetch', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function updateInterventionFlag(params: {
  id: string;
  status: 'acknowledged' | 'resolved';
  adminNote?: string | null;
}): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: params.status,
    admin_note: params.adminNote ?? null,
  };

  if (params.status === 'resolved') {
    patch.resolved_at = now;
    patch.resolved_by = uid;
  } else {
    patch.resolved_at = null;
    patch.resolved_by = null;
  }

  const { error } = await supabase.from('intervention_flags').update(patch).eq('id', params.id);

  if (error) {
    console.warn('[interventionFlags] update', error.message);
    return false;
  }
  return true;
}

export type MistakesTestAttemptSummary = {
  id: string;
  total_questions: number;
  correct_first_try: number;
  hard_wrong: number;
  medium_wrong: number;
  raw_score: number | null;
  adjusted_score: number | null;
  status_band: string | null;
  completed_at: string | null;
  unresolved_snapshot: Record<string, unknown> | null;
};

export async function fetchTeacherAlertForStaff(
  alertId: string
): Promise<{ attempt_id: string; user_id: string; created_at: string } | null> {
  const { data, error } = await supabase
    .from('mistakes_test_teacher_alerts')
    .select('attempt_id, user_id, created_at')
    .eq('id', alertId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[interventionFlags] fetch alert', error.message);
    return null;
  }
  const row = data as { attempt_id: string; user_id: string; created_at: string };
  return {
    attempt_id: String(row.attempt_id),
    user_id: String(row.user_id),
    created_at: String(row.created_at),
  };
}

/** Optional context for admin UI (RLS: staff only). */
export async function fetchMistakesTestAttemptForStaff(
  attemptId: string
): Promise<MistakesTestAttemptSummary | null> {
  const { data, error } = await supabase
    .from('mistakes_test_attempts')
    .select(
      'id, total_questions, correct_first_try, hard_wrong, medium_wrong, raw_score, adjusted_score, status_band, completed_at, unresolved_snapshot'
    )
    .eq('id', attemptId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[interventionFlags] fetch attempt', error.message);
    return null;
  }

  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    total_questions: Number(row.total_questions ?? 0),
    correct_first_try: Number(row.correct_first_try ?? 0),
    hard_wrong: Number(row.hard_wrong ?? 0),
    medium_wrong: Number(row.medium_wrong ?? 0),
    raw_score: row.raw_score == null ? null : Number(row.raw_score),
    adjusted_score: row.adjusted_score == null ? null : Number(row.adjusted_score),
    status_band: row.status_band == null ? null : String(row.status_band),
    completed_at: row.completed_at == null ? null : String(row.completed_at),
    unresolved_snapshot:
      typeof row.unresolved_snapshot === 'object' && row.unresolved_snapshot !== null
        ? (row.unresolved_snapshot as Record<string, unknown>)
        : null,
  };
}
