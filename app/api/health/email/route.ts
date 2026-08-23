import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_FROM, fromAddress, hasVerifiedSender, isEmailConfigured, sendEmail } from "@/lib/email/send";
import { PRODUCT_NAME } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/health/email        — is sending set up, and can it reach anyone?
 * POST /api/health/email {to}   — send a real test message to that address.
 *
 * Sending fails quietly by design: the share link is the deliverable, so a
 * failed email only shows a note beside a link that already works. That's right
 * for users and useless for setup, which is what this is for.
 */
export async function GET() {
  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      from: null,
      summary: "RESEND_API_KEY isn't set — nothing can send. Links still work; they just have to be copied by hand.",
    });
  }

  // Ask Resend which domains the account has verified. Without one, sends only
  // reach the account owner's own address, which is the trap worth catching
  // before someone tries to email an agent.
  let domains: { name: string; status: string }[] = [];
  let keyValid = true;
  let restricted = false;
  let detail: string | null = null;
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as { data?: { name: string; status: string }[] } | null;
      domains = (json?.data ?? []).map((d) => ({ name: d.name, status: d.status }));
    } else if (res.status === 401 || res.status === 403) {
      // A sending-only key is FORBIDDEN from listing domains, which looks exactly
      // like a bad key here. Tell the two apart, or a perfectly good key gets
      // reported as broken.
      const body = await res.text().catch(() => "");
      restricted = /restricted_api_key|restricted to only send/i.test(body);
      keyValid = restricted ? await authenticates() : false;
      if (!keyValid) detail = "Resend rejected the API key.";
    } else {
      detail = `Resend responded ${res.status}.`;
    }
  } catch (err) {
    detail = (err as Error).message;
  }

  const verified = domains.filter((d) => d.status === "verified");
  const usingShared = !hasVerifiedSender();

  // With a sending-only key the domain list can't be read from here, so the
  // honest answer is "send one and see" rather than a guess dressed as a status.
  const summary = !keyValid
    ? "The Resend API key was rejected — check RESEND_API_KEY."
    : restricted && usingShared
      ? `The key works. It's a sending-only key, so domains can't be listed from here — and RESEND_FROM is unset, so mail goes out as ${DEFAULT_FROM}, which Resend only delivers to your own account address. Verify a domain and set RESEND_FROM to email anyone else.`
      : restricted
        ? `Sending as ${fromAddress()}. The key is sending-only, so domain verification can't be confirmed from here — POST to this endpoint to prove it end to end.`
        : verified.length === 0
          ? "The key works, but no domain is verified in Resend yet. Sends will only reach your own account address."
          : usingShared
            ? `${verified.map((d) => d.name).join(", ")} is verified, but RESEND_FROM still points at the shared sender (${DEFAULT_FROM}). Set RESEND_FROM to an address on your domain.`
            : `Ready — sending as ${fromAddress()}.`;

  return NextResponse.json({
    ok: keyValid && !usingShared,
    configured: true,
    keyValid,
    sendingOnlyKey: restricted,
    from: fromAddress(),
    usingSharedSender: usingShared,
    domains,
    summary,
    detail,
  });
}

/**
 * Auth probe that sends nothing: with the key accepted an empty body fails
 * validation (422); a rejected key never gets that far.
 */
async function authenticates(): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    return res.status !== 401 && res.status !== 403;
  } catch {
    return false;
  }
}

/** POST { to } — actually send one, so setup is proven rather than assumed. */
export async function POST(req: NextRequest) {
  let to = "";
  try {
    to = String(((await req.json()) as { to?: string })?.to ?? "").trim();
  } catch {
    /* handled below */
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ ok: false, error: "Provide a valid `to` address." }, { status: 400 });
  }

  const result = await sendEmail({
    to,
    subject: `${PRODUCT_NAME} — email test`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.6">
      <p style="font-size:15px">Email sending is working.</p>
      <p style="font-size:13px;color:#666">Sent from <strong>${fromAddress()}</strong>. If you received this at an address other than your own Resend account, a verified domain is live and report links can go to anyone.</p>
    </div>`,
  });

  return NextResponse.json(result.ok ? { ok: true, id: result.id, from: fromAddress() } : { ok: false, error: result.error });
}
