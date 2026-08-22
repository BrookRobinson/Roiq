// ============================================================
// One inbox, one identity.
//
// The free report is counted per person, and the only thing that reliably
// separates two people is their inbox — a shared laptop can't tell a partner
// from a second account. But an inbox has many spellings: Gmail ignores dots
// entirely, and almost every provider treats "+anything" as a tag on the same
// mailbox. you+1@gmail.com, y.o.u@gmail.com and you@googlemail.com are all one
// person's inbox, and all confirm to the same place.
//
// Pure and dependency-free so it can be tested directly. Both failure modes are
// silent: merge two real people and one of them is refused something they never
// used; miss an alias and the free tier is an open tab.
// ============================================================

/** Gmail's own aliases for the same service. */
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Providers that treat "+tag" as a tag on the same mailbox. This is nearly
 * universal, but it is only applied to domains we're sure about — stripping a
 * "+" from a provider that treats it as an ordinary character would merge two
 * unrelated people, which is the worse mistake.
 */
const PLUS_TAG_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com",
  "yahoo.com", "yahoo.co.nz", "ymail.com",
  "proton.me", "protonmail.com", "pm.me",
  "fastmail.com", "fastmail.fm",
  // New Zealand ISPs
  "xtra.co.nz", "slingshot.co.nz", "orcon.net.nz", "vodafone.co.nz", "spark.co.nz",
]);

/**
 * The mailbox an address actually lands in, as a comparable key.
 *
 * Returns null for anything that isn't a plausible address, and callers treat
 * null as "can't group this one" rather than grouping it with other nulls.
 */
export function emailKey(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  if (!domain.includes(".") || local.length === 0) return null;

  if (GMAIL_DOMAINS.has(domain)) domain = "gmail.com";

  if (PLUS_TAG_DOMAINS.has(domain)) {
    const plus = local.indexOf("+");
    if (plus >= 0) local = local.slice(0, plus);
  }

  // Dots are ignored by Gmail and ONLY by Gmail. Stripping them elsewhere would
  // merge john.smith@xtra.co.nz with johnsmith@xtra.co.nz — different people.
  if (domain === "gmail.com") local = local.replace(/\./g, "");

  // A local part that was nothing but a tag ("+foo@gmail.com") isn't an inbox.
  if (local.length === 0) return null;

  return `${local}@${domain}`;
}
