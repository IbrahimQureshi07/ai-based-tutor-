/**
 * UI-only gate for admin-only tools (e.g. batch level backfill, teacher interventions).
 * Set VITE_ADMIN_EMAILS to a comma-separated list (e.g. "a@x.com,b@y.com").
 * If unset, defaults to the project owner email below.
 *
 * For Supabase RLS on `intervention_flags`, the same addresses must exist in
 * `public.app_staff_emails` (see Backend/sql/intervention_flags.sql).
 */
const DEFAULT_ADMIN_EMAILS = ['mudassir@gmail.com', 'ibrahimqureshi45185823@gmail.com'];

function loadAdminSet(): Set<string> {
  const raw = import.meta.env.VITE_ADMIN_EMAILS as string | undefined;
  const list =
    raw && raw.trim().length > 0
      ? raw
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [...DEFAULT_ADMIN_EMAILS];
  return new Set(list);
}

const ADMIN_EMAILS = loadAdminSet();

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}
