import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/auth";
import { sendEmail } from "@/lib/email/send";
import { newShareToken } from "@/lib/share";
import { isSampleReportId } from "@/lib/scoring/sample-reports";
import { PRODUCT_NAME } from "@/lib/brand";
import { CONSENT_TEXT, DEFAULT_LEAD_FEE_CENTS, inspectorForRegion, isEmail } from "@/lib/inspections/referral";
import type { StoredReport } from "@/lib/report-store";
import type { Json } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A second request for the same report from the same buyer inside this window is the same lead. */
const DUPLICATE_WINDOW_DAYS = 7;

/**
 * POST /api/inspection-request
 * { report, name, email, phone?, message?, consent: true }
 *
 * "Get this report verified in person." Records the request, gives the partner
 * inspector for the property's region a link to the report, emails them the
 * buyer's details, and records the lead fee they owe. Nobody covering that
 * region yet? It is still recorded, and Tectara is emailed to pass it on.
 *
 * The request is SAVED FIRST, then emailed: an email that fails must never
 * lose somebody's request. A fee is owed only once the inspector has actually
 * been sent the lead.
 */
export async function POST(req: NextRequest) {
  let body: { report?: StoredReport; name?: unknown; email?: unknown; phone?: unknown; message?: unknown; consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const report = body.report;
  if (!report || typeof report !== "object" || !report.listing?.address) {
    return NextResponse.json({ ok: false, error: "Missing report" }, { status: 400 });
  }
  // A sample or demo report is a house that doesn't exist; no inspector can visit it.
  if (report.id?.startsWith("rpt_") || isSampleReportId(report.id ?? "")) {
    return NextResponse.json({ ok: false, error: "This is a sample report — run one on a real listing to book an inspection." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!name) return NextResponse.json({ ok: false, error: "Add your name." }, { status: 400 });
  if (!isEmail(email)) return NextResponse.json({ ok: false, error: "That email address looks invalid." }, { status: 400 });
  // No consent, nothing leaves: this is the buyer's say-so to share their details.
  if (body.consent !== true) {
    return NextResponse.json({ ok: false, error: "Tick the box to agree to your details being shared with the inspector." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Inspection requests aren't set up yet — SUPABASE_SERVICE_ROLE_KEY is missing." },
      { status: 503 }
    );
  }

  const listing = report.listing;
  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: dupe } = await admin
    .from("inspection_requests")
    .select("id, inspector_id")
    .eq("report_id", report.id)
    .eq("buyer_email", email)
    .gte("created_at", since)
    .maybeSingle();
  if (dupe) {
    // Same buyer, same report, same week: already with an inspector. A second
    // send would bill the inspector twice for one job.
    return NextResponse.json({ ok: true, already: true, assigned: !!dupe.inspector_id });
  }

  const { data: inspectors, error: inspectorsError } = await admin
    .from("inspectors")
    .select("id, name, company, email, regions, fee_per_lead_cents, active, created_at")
    .eq("active", true);
  if (inspectorsError) {
    const missing = /does not exist|Could not find the table/i.test(inspectorsError.message);
    return NextResponse.json(
      {
        ok: false,
        error: missing
          ? "Inspection requests aren't set up yet — run supabase/migrations/20260929_inspection_requests.sql."
          : `Couldn't look up inspectors: ${inspectorsError.message}`,
      },
      { status: 500 }
    );
  }
  const inspector = inspectorForRegion(inspectors ?? [], listing.region);

  // A link the inspector can open without an account — the same snapshot the
  // Send report button makes.
  const origin = (process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") || req.nextUrl.origin).replace(/\/+$/, "");
  const token = newShareToken();
  const { error: shareError } = await admin.from("shared_reports").insert({
    token,
    report: report as unknown as Json,
    address: listing.address ?? null,
    recipient: "inspector",
    note: "Inspection request",
  } as never);
  const reportUrl = shareError ? null : `${origin}/report/share_${token}`;


  const { authUser } = await getUser().catch(() => ({ authUser: null }));
  const { data: row, error: insertError } = await admin
    .from("inspection_requests")
    .insert({
      report_id: report.id ?? null,
      report_url: reportUrl,
      user_id: authUser?.id ?? null,
      buyer_name: name,
      buyer_email: email,
      buyer_phone: phone || null,
      buyer_message: message || null,
      consent_at: new Date().toISOString(),
      consent_text: CONSENT_TEXT,
      address: listing.address ?? null,
      suburb: listing.suburb ?? null,
      city: listing.city ?? null,
      region: listing.region ?? null,
      listing_url: listing.url ?? null,
      inspector_id: inspector?.id ?? null,
      status: "new",
    })
    .select("id")
    .single();
  if (insertError || !row) {
    return NextResponse.json({ ok: false, error: `Couldn't save the request: ${insertError?.message ?? "unknown error"}` }, { status: 500 });
  }

  const lead = { name, email, phone, message, address: listing.address ?? "", suburb: listing.suburb, city: listing.city, region: listing.region, listingUrl: listing.url, reportUrl };
  const feeCents = inspector?.fee_per_lead_cents ?? DEFAULT_LEAD_FEE_CENTS;

  let sent = false;
  if (inspector) {
    const r = await sendEmail({
      to: inspector.email,
      subject: `New inspection request: ${lead.address}`,
      html: inspectorEmail(lead, inspector.name, feeCents),
      replyTo: email,
    });
    sent = r.ok;
  }

  // A copy to Tectara, always — it's how an unassigned request gets passed on,
  // and how a failed send gets noticed.
  const leadsTo = process.env.INSPECTION_LEADS_TO?.trim();
  if (leadsTo) {
    await sendEmail({
      to: leadsTo,
      subject: `${inspector ? (sent ? "Sent" : "SEND FAILED") : "UNASSIGNED"} — inspection request: ${lead.address}`,
      html: adminEmail(lead, inspector ? `${inspector.name}${inspector.company ? ` (${inspector.company})` : ""}` : null, sent, feeCents),
      replyTo: email,
    }).catch(() => null);
  }

  await admin
    .from("inspection_requests")
    .update({
      status: !inspector ? "unassigned" : sent ? "sent" : "email_failed",
      // Owed only once the lead actually reached them.
      fee_cents: inspector && sent ? feeCents : 0,
      fee_status: inspector && sent ? "owed" : "none",
    })
    .eq("id", row.id);

  return NextResponse.json({
    ok: true,
    assigned: !!inspector && sent,
    inspectorName: inspector && sent ? inspector.company || inspector.name : null,
  });
}

// ── Emails ──────────────────────────────────────────────────────────────────

interface Lead {
  name: string;
  email: string;
  phone: string;
  message: string;
  address: string;
  suburb: string | null;
  city: string | null;
  region: string | null;
  listingUrl: string | null;
  reportUrl: string | null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (cents: number) => `$${(cents / 100).toLocaleString("en-NZ", { minimumFractionDigits: 0 })}`;

function leadTable(l: Lead): string {
  const row = (k: string, v: string | null | undefined, link = false) =>
    v ? `<tr><td style="padding:4px 12px 4px 0;color:#667">${k}</td><td style="padding:4px 0">${link ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v)}</td></tr>` : "";
  return `<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
${row("Property", [l.address, l.suburb, l.city].filter(Boolean).join(", "))}
${row("Buyer", l.name)}
${row("Email", l.email)}
${row("Phone", l.phone)}
${row("Message", l.message)}
${row("Listing", l.listingUrl, true)}
${row(`${PRODUCT_NAME} report`, l.reportUrl, true)}
</table>`;
}

function inspectorEmail(l: Lead, inspectorName: string, feeCents: number): string {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2a28">
<p>Hi ${esc(inspectorName)},</p>
<p>A buyer has asked for a pre-purchase building inspection through ${PRODUCT_NAME}. They've agreed to their details being shared with you — please contact them directly. Replying to this email goes to the buyer.</p>
${leadTable(l)}
<p>The ${PRODUCT_NAME} report shows what the listing photos found, item by item, and what they couldn't show — useful for knowing where to look.</p>
<p style="color:#667;font-size:12px">This lead is billed at ${money(feeCents)} under your ${PRODUCT_NAME} partner agreement.</p>
</div>`;
}

function adminEmail(l: Lead, inspector: string | null, sent: boolean, feeCents: number): string {
  const status = !inspector
    ? "<b>No partner inspector covers this region yet.</b> Pass it on by hand, or add an inspector for this region."
    : sent
      ? `Sent to <b>${esc(inspector)}</b>. Fee owed: ${money(feeCents)}.`
      : `<b>The email to ${esc(inspector)} failed.</b> Nothing has been billed — send it on by hand.`;
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2a28">
<p>${status}</p>
<p>Region: ${esc(l.region ?? "not known")}</p>
${leadTable(l)}
</div>`;
}
