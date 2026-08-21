// ============================================================
// Who owns a report, while auth is still mocked.
//
// SERVER ONLY. There is no signed-in user to attribute a report to, so each
// browser gets an opaque owner key in an httpOnly cookie. It carries no personal
// information and isn't guessable, and it means reports survive a tab closing —
// which sessionStorage never did — without inventing a half-authentication
// system that would then have to be unpicked.
//
// When real auth lands this becomes a migration rather than a rewrite: a
// signed-in user claims their rows by matching owner_key and setting user_id.
// ============================================================

import { cookies } from "next/headers";

export const OWNER_COOKIE = "bdr_owner";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** 24 random bytes, base64url — same shape as a share token. */
function mintOwnerKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const isOwnerKey = (v: string | undefined | null): v is string =>
  !!v && /^[A-Za-z0-9_-]{16,64}$/.test(v);

/** The caller's owner key, or null when they've never saved a report. */
export function readOwnerKey(): string | null {
  const v = cookies().get(OWNER_COOKIE)?.value;
  return isOwnerKey(v) ? v : null;
}

/**
 * The caller's owner key, minting and setting one if they don't have it yet.
 * Route handlers only — a Server Component can't set cookies.
 */
export function ensureOwnerKey(): string {
  const existing = readOwnerKey();
  if (existing) return existing;

  const key = mintOwnerKey();
  cookies().set(OWNER_COOKIE, key, {
    httpOnly: true, // the browser never needs to read it; keeps it out of any XSS
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
    secure: process.env.NODE_ENV === "production",
  });
  return key;
}
