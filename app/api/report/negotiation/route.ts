import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { SHARE_TTL_DAYS, newShareToken } from "@/lib/share";
import type { NegotiationCase } from "@/lib/negotiation/build";
import { NEGOTIATION_KIND, type NegotiationPayload } from "@/lib/negotiation/payload";
import type { Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

/**
 * POST /api/report/negotiation
 * Body: { case, preparedBy?, note?, recipientEmail? }
 *
 * Stores the negotiation document under a share token and returns a link, and
 * emails it when a recipient is given.
 *
 * Only the document is stored — NOT the underlying report. The Financial tab
 * holds the buyer's deposit, hold period and walk-away price, and the recipient
 * here is the vendor's agent.
 */
export async function POST(req: NextRequest) {
  let body: {
    case?: NegotiationCase;
    preparedBy?: string;
    note?: string;
    recipientEmail?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body.case;
  if (!data || typeof data !== "object" || !Array.isArray(data.critical) || !Array.isArray(data.urgent)) {
    return NextResponse.json({ ok: false, error: "Missing or malformed negotiation case" }, { status: 400 });
  }

  const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
  if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return NextResponse.json({ ok: false, error: "That email address looks invalid" }, { status: 400 });
  }

  const payload: NegotiationPayload = {
    kind: NEGOTIATION_KIND,
    case: data,
    preparedBy: typeof body.preparedBy === "string" ? body.preparedBy.slice(0, 120) : undefined,
    note: typeof body.note === "string" ? body.note.slice(0, 2000) : undefined,
  };

  const token = newShareToken();
  const { authUser } = await getUser().catch(() => ({ authUser: null }));

  const supabase = createClient();
  const { error } = await supabase.from("shared_reports").insert({
    token,
    report: payload as unknown as Json,
    address: data.address || null,
    score: data.score ?? null,
    shared_by: authUser?.id ?? null,
    recipient: recipientEmail || null,
    note: payload.note ?? null,
  } as never);

  if (error) {
    const missingTable = /relation .*shared_reports.* does not exist|Could not find the table/i.test(error.message);
    return NextResponse.json(
      {
        ok: false,
        error: missingTable
          ? "Sharing isn't set up yet — run supabase/migrations/20260804_shared_reports.sql."
          : `Couldn't save the document: ${error.message}`,
      },
      { status: 500 }
    );
  }

  const url = `${originFor(req)}/report/share_${token}`;

  let emailed = false;
  let emailError: string | null = null;
  if (recipientEmail) {
    const result = await sendToAgent({ to: recipientEmail, url, payload });
    emailed = result.ok;
    emailError = result.ok ? null : result.error;
  }

  return NextResponse.json({ ok: true, token, url, emailed, emailError, expiresInDays: SHARE_TTL_DAYS });
}

function originFor(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The covering email. Kept short and factual — it exists to get the link opened,
 * and every figure in it is repeated from the document itself.
 */
async function sendToAgent(args: {
  to: string;
  url: string;
  payload: NegotiationPayload;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Email isn't configured (set RESEND_API_KEY). The link still works — copy and send it yourself.",
    };
  }

  const { case: c, preparedBy, note } = args.payload;
  const count = c.critical.length + c.urgent.length;
  const address = c.address || "the property";
  const from = preparedBy?.trim();

  const subject = `Condition findings — ${address}`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.6">
    <p style="font-size:15px">Hello,</p>
    <p style="font-size:15px">
      ${from ? esc(from) + " has" : "A prospective purchaser has"} commissioned an independent condition
      analysis of <strong>${esc(address)}</strong>.
    </p>
    ${note?.trim() ? `<p style="font-size:15px">${esc(note.trim())}</p>` : ""}
    ${
      count > 0
        ? `<p style="font-size:15px">
             It records <strong>${c.critical.length} critical</strong> and
             <strong>${c.urgent.length} urgent</strong> item${count === 1 ? "" : "s"}, with an indicative
             cost to remedy of <strong>${money(c.repairsLow)} – ${money(c.repairsHigh)}</strong>.
             The full findings, including the evidence behind each one, are here:
           </p>`
        : `<p style="font-size:15px">
             No item was graded critical or urgent. The findings are here:
           </p>`
    }
    <p style="margin:24px 0">
      <a href="${args.url}" style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
        View the findings
      </a>
    </p>
    <p style="font-size:13px;color:#666">
      This is a desktop assessment made from listing photographs, not a building report, and the costs are
      estimates for discussion rather than quotations. The document sets out its own basis and limitations
      in full.
    </p>
    <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px;margin-top:24px">
      Sent via BDR Report. This link expires in ${SHARE_TTL_DAYS} days.
    </p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "BDR Report <onboarding@resend.dev>",
        to: [args.to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Email provider rejected the send${detail ? `: ${detail.slice(0, 140)}` : ""}.` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach the email provider." };
  }
}
