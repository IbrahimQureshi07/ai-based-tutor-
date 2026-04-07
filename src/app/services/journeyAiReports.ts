import { supabase } from '@/app/services/supabase';
import type { CombinedJourneyAiReport } from '@/app/services/aiService';
import type { JourneyReportSnapshot } from '@/app/utils/buildJourneyReportSnapshot';

export type JourneyAiReportRow = {
  id: string;
  user_id: string;
  snapshot_json: JourneyReportSnapshot;
  ai_report_json: CombinedJourneyAiReport;
  created_at: string;
};

/** Insert a new saved report row; returns created_at ISO string or null on failure. */
export async function saveJourneyAiReport(params: {
  userId: string;
  snapshot: JourneyReportSnapshot;
  aiReport: CombinedJourneyAiReport;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('journey_ai_reports')
    .insert({
      user_id: params.userId,
      snapshot_json: params.snapshot as unknown as Record<string, unknown>,
      ai_report_json: params.aiReport as unknown as Record<string, unknown>,
    })
    .select('created_at')
    .single();

  if (error) {
    console.warn('[journeyAiReports] save', error.message);
    return null;
  }
  const row = data as { created_at: string } | null;
  return row?.created_at ?? null;
}

export async function fetchLatestJourneyAiReport(userId: string): Promise<JourneyAiReportRow | null> {
  const { data, error } = await supabase
    .from('journey_ai_reports')
    .select('id, user_id, snapshot_json, ai_report_json, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[journeyAiReports] fetchLatest', error.message);
    return null;
  }

  const row = data as {
    id: string;
    user_id: string;
    snapshot_json: unknown;
    ai_report_json: unknown;
    created_at: string;
  };

  return {
    id: row.id,
    user_id: row.user_id,
    snapshot_json: row.snapshot_json as JourneyReportSnapshot,
    ai_report_json: row.ai_report_json as CombinedJourneyAiReport,
    created_at: row.created_at,
  };
}
