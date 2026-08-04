// Shareable report helpers.
//
// A generated report normally lives only in the sender's browser (sessionStorage
// via lib/report-store). To "send it to someone", we copy the report JSON into
// the `shared_reports` table under a random token; the recipient opens
// /report/share_<token>, which fetches it back — no login required.
//
// Storage is Supabase (the app's datastore). Run the migration once:
//   supabase/migrations/20260804_shared_reports.sql

export const SHARE_TABLE = "shared_reports";

/** Shared reports are considered valid for 60 days (enforced at read time). */
export const SHARE_TTL_DAYS = 60;

/** Prefix that marks a report id as a shared link, e.g. /report/share_<token>. */
export const SHARE_ID_PREFIX = "share_";

/** URL-safe random token (24 bytes → 32 base64url chars). */
export function newShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function isShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(token);
}
