import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/db — is the database actually there, and does it have the
 * schema this app expects?
 *
 * Written for the restore: point .env.local at a new Supabase project, run
 * supabase/setup.sql, hit this, and it tells you table by table what landed
 * rather than leaving you to find out through a feature quietly falling back to
 * seed data. Every DB call in this app is wrapped in a try/catch fallback, which
 * is what keeps the app usable while the database is down — and also what makes
 * a broken database invisible without something like this.
 */

/** Tables the app reads or writes, and what breaks without each. */
const TABLES: { name: string; used_by: string }[] = [
  { name: "users", used_by: "auth profile + map variables" },
  { name: "reports", used_by: "saved reports + the viewing checklist" },
  { name: "listing_photos", used_by: "report photos" },
  { name: "market_data", used_by: "cached suburb market figures" },
  { name: "map_listings", used_by: "the property map" },
  { name: "watchlist", used_by: "map save/bookmark" },
  { name: "alerts", used_by: "saved-search alerts" },
  { name: "report_gaps", used_by: "report gap banner + agent letter" },
  { name: "report_upload_tokens", used_by: "/upload/[token] document links" },
  { name: "shared_reports", used_by: "Send report → /report/share_<token>" },
];

const TIMEOUT_MS = 8_000;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const host = url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  if (!url || !hasKey) {
    return NextResponse.json({
      ok: false,
      reachable: false,
      host: host || null,
      error: "not_configured",
      message: "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing from .env.local.",
    });
  }

  // Check the host answers at all before probing ten tables — a dead project
  // (the subdomain stops resolving entirely) would otherwise mean ten timeouts.
  let reachable = false;
  let reachError: string | null = null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      signal: ctl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    reachable = res.ok;
    if (!res.ok) reachError = `HTTP ${res.status}`;
  } catch (err) {
    reachError = (err as Error).message;
  }

  if (!reachable) {
    return NextResponse.json({
      ok: false,
      reachable: false,
      host,
      error: "unreachable",
      message:
        `Can't reach ${host}. If the hostname doesn't resolve at all the project no longer exists ` +
        `(a PAUSED project still resolves and answers). Create a new project, then update ` +
        `NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and restart the dev server.`,
      detail: reachError,
    });
  }

  // Reachable — now find out whether the schema is there. `head: true` with an
  // exact count is a cheap existence probe that also reports current row counts.
  const supabase = createClient();
  const tables = await Promise.all(
    TABLES.map(async (t) => {
      try {
        const { count, error } = await supabase
          .from(t.name as never)
          .select("*", { count: "exact", head: true });
        if (error) {
          // 42P01 = undefined_table → the migration hasn't been run.
          const missing = error.code === "42P01" || /does not exist/i.test(error.message);
          return { ...t, exists: !missing, rows: null, error: error.message, code: error.code ?? null };
        }
        return { ...t, exists: true, rows: count ?? 0, error: null, code: null };
      } catch (err) {
        return { ...t, exists: false, rows: null, error: (err as Error).message, code: null };
      }
    })
  );

  const missing = tables.filter((t) => !t.exists).map((t) => t.name);
  const blocked = tables.filter((t) => t.exists && t.error).map((t) => t.name);

  // The map's writes go through the service role (the anon key deliberately
  // can't write there), and the upsert needs the source_key column. Both are
  // easy to miss on a restore and both fail silently, so check them explicitly.
  const mapListings = tables.find((t) => t.name === "map_listings");
  const { error: keyError } = mapListings?.exists
    ? await supabase.from("map_listings").select("source_key").limit(1)
    : { error: null };

  // The viewing checklist syncs into reports.viewing. A missing column doesn't
  // throw anywhere — the sync just answers `synced: false` forever and the
  // answers stay on one device, which is the exact silent failure this endpoint
  // exists to catch.
  const reportsTable = tables.find((t) => t.name === "reports");
  const { error: viewingError } = reportsTable?.exists
    ? await supabase.from("reports").select("viewing").limit(1)
    : { error: null };
  const viewingColumn = reportsTable?.exists ? !viewingError : false;

  const writes = {
    service_role_key: hasAdminClient(),
    source_key_column: mapListings?.exists ? !keyError : false,
    viewing_column: viewingColumn,
    ok: hasAdminClient() && !!mapListings?.exists && !keyError && viewingColumn,
    note: !hasAdminClient()
      ? "SUPABASE_SERVICE_ROLE_KEY is not set — the map can read but nothing can be written to it."
      : keyError
        ? "map_listings.source_key is missing — run the 20260821_map_listing_writes migration."
        : !viewingColumn
          ? "reports.viewing is missing — run the 20260824_viewing migration, or viewing checklists stay on one device."
          : "Map writes and viewing sync are configured.",
  };

  return NextResponse.json({
    ok: missing.length === 0 && writes.ok,
    reachable: true,
    host,
    summary:
      missing.length > 0
        ? `${missing.length} of ${tables.length} tables missing. Run supabase/setup.sql in the SQL editor.`
        : writes.ok
          ? `Schema complete — all ${tables.length} tables present, writes configured.`
          : `All ${tables.length} tables present, but something can't be written. ${writes.note}`,
    writes,
    missing,
    // RLS blocking an anonymous read is expected on user-owned tables; it means
    // the table is THERE and protected, not broken.
    readable_but_errored: blocked,
    tables,
  });
}
