import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { supabase } from '@/app/services/supabase';
import { isAdminEmail } from '@/app/utils/adminEmails';
import {
  fetchInterventionFlagsForStaff,
  fetchMistakesTestAttemptForStaff,
  fetchTeacherAlertForStaff,
  updateInterventionFlag,
  type InterventionFlagRow,
  type MistakesTestAttemptSummary,
} from '@/app/services/interventionFlags';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { ArrowLeft, ClipboardCopy, LifeBuoy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type FilterTab = 'open' | 'all' | 'resolved';

function statusBadge(status: InterventionFlagRow['status']) {
  if (status === 'open') return 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30';
  if (status === 'acknowledged')
    return 'bg-sky-500/15 text-sky-900 dark:text-sky-200 border-sky-500/30';
  return 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-500/30';
}

export function TeacherInterventionsAdmin() {
  const { setCurrentScreen } = useApp();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InterventionFlagRow[]>([]);
  const [filter, setFilter] = useState<FilterTab>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [attemptCache, setAttemptCache] = useState<Record<string, MistakesTestAttemptSummary | null>>({});

  const syncAccess = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setAllowed(isAdminEmail(session?.user?.email));
  }, []);

  useEffect(() => {
    void syncAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void syncAccess();
    });
    return () => subscription.unsubscribe();
  }, [syncAccess]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchInterventionFlagsForStaff();
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
    else if (allowed === false) setLoading(false);
  }, [allowed, load]);

  useEffect(() => {
    if (allowed === false) {
      toast.error('This screen is only for staff accounts.');
      setCurrentScreen('dashboard');
    }
  }, [allowed, setCurrentScreen]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'open') return rows.filter((r) => r.status === 'open' || r.status === 'acknowledged');
    return rows.filter((r) => r.status === 'resolved');
  }, [rows, filter]);

  const loadAttemptForFlag = async (f: InterventionFlagRow) => {
    if (!f.source_alert_id) return;
    if (attemptCache[f.id] !== undefined) return;
    const alert = await fetchTeacherAlertForStaff(f.source_alert_id);
    if (!alert) {
      setAttemptCache((c) => ({ ...c, [f.id]: null }));
      return;
    }
    const att = await fetchMistakesTestAttemptForStaff(alert.attempt_id);
    setAttemptCache((c) => ({ ...c, [f.id]: att }));
  };

  const copyHandoff = async (f: InterventionFlagRow) => {
    const lines = [
      `Intervention ${f.id}`,
      `Learner user_id: ${f.user_id}`,
      `Kind: ${f.kind}`,
      `Status: ${f.status}`,
      `Created: ${f.created_at}`,
      `Payload: ${JSON.stringify(f.payload, null, 2)}`,
    ];
    if (f.source_alert_id) {
      const alert = await fetchTeacherAlertForStaff(f.source_alert_id);
      if (alert) {
        lines.push(`Attempt: ${alert.attempt_id}`);
        const att = await fetchMistakesTestAttemptForStaff(alert.attempt_id);
        if (att) {
          lines.push(
            `Attempt summary: ${att.correct_first_try}/${att.total_questions} first-try, hard_wrong ${att.hard_wrong}, band ${att.status_band ?? '—'}`
          );
          if (att.unresolved_snapshot) {
            lines.push(`Unresolved snapshot: ${JSON.stringify(att.unresolved_snapshot)}`);
          }
        }
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Copied handoff summary');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const onAck = async (f: InterventionFlagRow) => {
    setBusyId(f.id);
    const ok = await updateInterventionFlag({
      id: f.id,
      status: 'acknowledged',
      adminNote: notes[f.id]?.trim() || null,
    });
    setBusyId(null);
    if (ok) {
      toast.success('Marked acknowledged');
      void load();
    } else toast.error('Update failed — check staff RLS / app_staff_emails');
  };

  const onResolve = async (f: InterventionFlagRow) => {
    setBusyId(f.id);
    const ok = await updateInterventionFlag({
      id: f.id,
      status: 'resolved',
      adminNote: notes[f.id]?.trim() || null,
    });
    setBusyId(null);
    if (ok) {
      toast.success('Marked resolved');
      void load();
    } else toast.error('Update failed — check staff RLS / app_staff_emails');
  };

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Checking access…</p>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentScreen('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 md:p-8 border-orange-500/25 bg-gradient-to-br from-orange-500/[0.06] to-background">
            <div className="flex items-start gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
                <LifeBuoy className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Teacher interventions</h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Queue synced from Stage 2.5 teacher alerts (<code className="text-xs bg-muted px-1 rounded">intervention_flags</code>
                  ). Staff emails must be listed in Supabase <code className="text-xs bg-muted px-1 rounded">app_staff_emails</code> and match the signed-in account. Email automation is not wired here — use Copy handoff for now.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              {(['open', 'all', 'resolved'] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={filter === t ? 'default' : 'outline'}
                  onClick={() => setFilter(t)}
                >
                  {t === 'open' ? 'Open & ack' : t === 'all' ? 'All' : 'Resolved'}
                </Button>
              ))}
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading queue…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rows for this filter.</p>
            ) : (
              <ul className="space-y-4">
                {filtered.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-xl border border-border bg-card/80 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${statusBadge(f.status)}`}
                        >
                          {f.status}
                        </span>
                        <p className="text-xs text-muted-foreground mt-2 font-mono break-all">{f.id}</p>
                        <p className="text-sm mt-1">
                          Learner <span className="font-mono text-xs">{f.user_id}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void copyHandoff(f)}
                        >
                          <ClipboardCopy className="w-3.5 h-3.5 mr-1.5" />
                          Copy handoff
                        </Button>
                        {f.status !== 'resolved' && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busyId === f.id}
                              onClick={() => void onAck(f)}
                            >
                              Acknowledge
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={busyId === f.id}
                              onClick={() => void onResolve(f)}
                            >
                              Resolve
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <pre className="text-[11px] bg-muted/50 rounded-lg p-3 overflow-x-auto border border-border/50">
                      {JSON.stringify(f.payload, null, 2)}
                    </pre>

                    {f.source_alert_id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => void loadAttemptForFlag(f)}
                      >
                        Load attempt context
                      </Button>
                    )}

                    {attemptCache[f.id] != null && (
                      <div className="text-xs rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
                        <p>
                          <span className="text-muted-foreground">Attempt:</span>{' '}
                          {attemptCache[f.id]!.id} · {attemptCache[f.id]!.correct_first_try}/
                          {attemptCache[f.id]!.total_questions} first-try · band{' '}
                          {attemptCache[f.id]!.status_band ?? '—'}
                        </p>
                        {attemptCache[f.id]!.unresolved_snapshot && (
                          <pre className="text-[10px] mt-2 overflow-x-auto">
                            {JSON.stringify(attemptCache[f.id]!.unresolved_snapshot, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                    {attemptCache[f.id] === null && f.source_alert_id && (
                      <p className="text-xs text-muted-foreground">Could not load attempt (RLS or missing row).</p>
                    )}

                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Admin note</label>
                      <textarea
                        className="mt-1 w-full min-h-[64px] text-sm rounded-md border border-input bg-background px-3 py-2"
                        placeholder="Optional note (saved with ack / resolve)"
                        value={notes[f.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [f.id]: e.target.value }))}
                      />
                    </div>

                    {f.admin_note && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Saved note:</span> {f.admin_note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
