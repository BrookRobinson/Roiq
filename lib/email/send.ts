import { PRODUCT_NAME } from "@/lib/brand";
// ============================================================
// Sending email, in one place.
//
// SERVER ONLY. Both things that send mail — a shared report and the agent
// document — went through their own copy of this, which meant two from-addresses
// to keep in step and two sets of error wording. One helper instead.
//
// Every caller treats email as best-effort: the share link is the real
// deliverable, so a send that fails returns a reason to show the user rather
// than failing their request.
// ============================================================

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend's shared sender. It works with no setup, but ONLY delivers to the
 * address that owns the Resend account — which is fine for testing and useless
 * for emailing an agent. A verified domain in RESEND_FROM is what makes sending
 * to anyone else work.
 */
export const DEFAULT_FROM = `${PRODUCT_NAME} <onboarding@resend.dev>`;

export const isEmailConfigured = (): boolean => !!process.env.RESEND_API_KEY;

/** True once mail is coming from a domain the account owns, not the shared sender. */
export const hasVerifiedSender = (): boolean =>
  !!process.env.RESEND_FROM && !process.env.RESEND_FROM.includes("resend.dev");

export const fromAddress = (): string => process.env.RESEND_FROM || DEFAULT_FROM;

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Email isn't set up yet (RESEND_API_KEY is missing). The link still works — copy and send it yourself.",
    };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: [args.to],
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });

    if (res.ok) {
      const json = (await res.json().catch(() => null)) as { id?: string } | null;
      return { ok: true, id: json?.id };
    }

    const body = await res.text().catch(() => "");
    return { ok: false, error: explain(res.status, body) };
  } catch {
    return { ok: false, error: "Couldn't reach the email provider. The link still works — copy and send it yourself." };
  }
}

/**
 * Resend's own error text is accurate but assumes you know its rules. The two
 * that actually bite are an unverified domain and the shared sender's
 * own-address-only restriction, so those get said plainly.
 */
function explain(status: number, body: string): string {
  const detail = body.slice(0, 200);

  if (status === 401 || status === 403) {
    return "The Resend API key was rejected — check RESEND_API_KEY in .env.local.";
  }
  if (/domain is not verified|not verified/i.test(body)) {
    return "That sending domain isn't verified in Resend yet, so the email couldn't go out. The link still works — copy and send it yourself.";
  }
  if (/you can only send testing emails to your own email/i.test(body)) {
    return "Resend's shared sender only delivers to your own account address. Verify a domain and set RESEND_FROM to email anyone else. The link still works — copy and send it yourself.";
  }
  if (status === 429) {
    return "Resend is rate-limiting sends right now. The link still works — copy and send it yourself.";
  }
  return `The email provider rejected the send${detail ? `: ${detail}` : ""}. The link still works — copy and send it yourself.`;
}
