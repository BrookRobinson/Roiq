import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadReportForPro } from "@/lib/reports/store";
import { pinFinanceFrom } from "@/lib/map/pin-finance";
import { readAllPages } from "@/lib/supabase/paged";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Same rule as the nightly job: open locally, CRON_SECRET in production. */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") ?? req.headers.get("x-cron-secret") ?? "";
  return header === `Bearer ${secret}` || header === secret;
}

/**
 * POST /api/map/backfill-finance — give pins made before 20260929_map_finance
 * their finance record, from the report they came from.
 *
 * The report is stored whole, so nothing is re-analysed and nothing is spent:
 * the record is built from the saved analysis exactly as it would have been on
 * the day. A pin whose report can't be read is left as it is — its investor
 * view keeps saying the report needs a re-run, which is true.
 *
 * Run once after the migration. Safe to re-run: it only touches pins with no
 * finance yet.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "no_service_role" }, { status: 500 });

  let rows: { source_key: string | null; address: string | null; full_report_ref: string | null }[];
  try {
    rows = await readAllPages(() =>
      supabase
        .from("map_listings")
        .select("source_key, address, full_report_ref")
        .not("quick_quality_score", "is", null)
        .not("full_report_ref", "is", null)
        .is("finance", null)
    );
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json(
      {
        error: /finance/i.test(message) ? "migration_not_run" : "db_error",
        message: /finance/i.test(message) ? "Run supabase/migrations/20260929_map_finance.sql first." : message,
      },
      { status: 500 }
    );
  }

  const results: { pin: string; address: string | null; outcome: string }[] = [];
  for (const r of rows) {
    if (!r.source_key) continue;
    const report = r.full_report_ref ? await loadReportForPro(r.full_report_ref) : null;
    if (!report) {
      results.push({ pin: r.source_key, address: r.address, outcome: "report not found — left for a re-run" });
      continue;
    }
    const finance = pinFinanceFrom(report);
    if (!finance) {
      results.push({ pin: r.source_key, address: r.address, outcome: "nothing to let (bare land or no price)" });
      continue;
    }
    const { error } = await supabase.from("map_listings").update({ finance } as never).eq("source_key", r.source_key);
    results.push({ pin: r.source_key, address: r.address, outcome: error ? `failed: ${error.message}` : "added" });
  }

  return NextResponse.json({ ok: true, checked: rows.length, added: results.filter((x) => x.outcome === "added").length, results });
}
