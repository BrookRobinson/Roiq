import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { SHARE_TTL_DAYS, newShareToken, isShareToken } from "@/lib/share";
import type { StoredReport } from "@/lib/report-store";
import type { Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

/**
 * POST /api/report/share
 * Body: { report: StoredReport, recipientEmail?: string, note?: string }
 * Stores a snapshot of the report under a fresh token and returns a shareable
 * link. If a recipient email is supplied and Resend is configured, also emails
 * the link. Returns { ok, token, url, emailed }.
 */
export async function POST(req: NextRequest) {
  let body: { report?: StoredReport; recipientEmail?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const report = body.report;
  if (!report || typeof report !== "object" || !report.listing || !report.scores) {
    return NextResponse.json({ ok: false, error: "Missing or malformed report" }, { status: 400 });
  }

  const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
  if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return NextResponse.json({ ok: false, error: "That email address looks invalid" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;

  const token = newShareToken();
  const { authUser } = await getUser();

  const supabase = createClient();
  // `as never` on the payload: the generated Supabase insert type resolves to
  // `never` for these tables (same quirk handled in app/api/map/score-run).
  const { error } = await supabase.from("shared_reports").insert({
    token,
    report: report as unknown as Json,
    address: report.listing.address ?? null,
    score: report.scores.buyer?.total ?? null,
    shared_by: authUser?.id ?? null,
    recipient: recipientEmail || null,
    note,
  } as never);

  if (error) {
    // Most likely cause: the shared_reports table/migration hasn't been run yet.
    const missingTable = /relation .*shared_reports.* does not exist|Could not find the table/i.test(error.message);
    return NextResponse.json(
      {
        ok: false,
        error: missingTable
          ? "Sharing isn't set up yet — run the shared_reports migration in Supabase (supabase/migrations/20260804_shared_reports.sql)."
          : `Couldn't save the shared report: ${error.message}`,
      },
      { status: 500 }
    );
  }

  const origin = originFor(req);
  const url = `${origin}/report/share_${token}`;

  // Best-effort email; the link is the real deliverable, so an email failure
  // never fails the whole request.
  let emailed = false;
  let emailError: string | null = null;
  if (recipientEmail) {
    const result = await sendShareEmail({ to: recipientEmail, url, report, note });
    emailed = result.ok;
    emailError = result.ok ? null : result.error;
  }

  return NextResponse.json({ ok: true, token, url, emailed, emailError });
}

/**
 * GET /api/report/share?token=<token>
 * Returns the stored report for a shared link (public).
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!isShareToken(token)) {
    return NextResponse.json({ ok: false, error: "Invalid share token" }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("shared_reports")
    .select("report, created_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "Couldn't load this shared report" }, { status: 500 });
  }
  const row = data as { report: Json; created_at: string } | null;
  if (!row) {
    return NextResponse.json({ ok: false, error: "This shared report doesn't exist or has been removed" }, { status: 404 });
  }

  // Expire old shares at read time (kept simple — no cron needed).
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > SHARE_TTL_DAYS * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: false, error: "This shared link has expired" }, { status: 410 });
  }

  // Best-effort view counter (ignore failures — RLS may block anon updates).
  (supabase.rpc as (fn: string, args: unknown) => PromiseLike<unknown>)(
    "increment_share_view",
    { p_token: token }
  ).then(() => {}, () => {});

  return NextResponse.json({ ok: true, report: row.report });
}

function originFor(req: NextRequest): string {
  // Prefer the configured public URL; fall back to the request's own origin so
  // links are correct in preview/prod without extra config.
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function sendShareEmail(args: {
  to: string;
  url: string;
  report: StoredReport;
  note: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Email isn't configured (set RESEND_API_KEY). The link still works — copy and send it yourself." };
  }

  const address = args.report.listing.address ?? "a property";
  const score = args.report.scores.buyer?.total;
  const from = process.env.SHARE_EMAIL_FROM || "RoiQ <onboarding@resend.dev>";

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
      <h2 style="margin:0 0 4px">A RoiQ property report has been shared with you</h2>
      <p style="color:#475569;margin:0 0 20px">${escapeHtml(address)}${
        typeof score === "number" ? ` — RoiQ score ${score}/1000` : ""
      }</p>
      ${
        args.note
          ? `<blockquote style="border-left:3px solid #14b8a6;margin:0 0 20px;padding:6px 0 6px 14px;color:#334155">${escapeHtml(
              args.note
            )}</blockquote>`
          : ""
      }
      <a href="${args.url}" style="display:inline-block;background:#14b8a6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">View the full report →</a>
      <p style="color:#94a3b8;font-size:12px;margin:24px 0 0">Or paste this link into your browser:<br>${args.url}</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: `RoiQ report shared with you — ${address}`,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `Email provider rejected the send (${res.status}). ${detail.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown email error" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
