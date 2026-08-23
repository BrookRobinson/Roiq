// ============================================================
// What this product is called.
//
// One place, because the name is not settled. It appears in the navbar, in
// page titles, in emails, and — the one that matters most — on the PDF that
// goes to a vendor's real estate agent. Scattered through 44 files, changing
// it meant a careful audit; here it means editing two lines.
//
// Pure and import-safe from anywhere: no env reads at module scope beyond the
// app URL, which Next inlines at build time.
//
// What deliberately does NOT live here: `roiqScore`, `bdr_owner`, the Supabase
// project, the GitHub repo. Those are identifiers, not copy — no customer
// reads them, and renaming them is churn with a migration attached.
// ============================================================

/** The product's name, as a customer reads it. */
export const PRODUCT_NAME = "Tectara";

/** For tight spaces — a mobile navbar, a PDF header. */
export const PRODUCT_SHORT_NAME = "Tectara";

/** Sits under the wordmark and in the page title. */
export const TAGLINE = "Know before you buy.";

/**
 * The bare domain, for print — a PDF footer or an email signature, where a
 * full URL reads badly.
 *
 * Derived from NEXT_PUBLIC_APP_URL so it can never disagree with the address
 * the app actually serves links from. The fallback is only reached in local
 * development, where a real domain would be a lie anyway.
 */
export function displayDomain(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) return "roiq.co.nz";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    // localhost in a document sent to an estate agent helps nobody.
    return host === "localhost" || host === "127.0.0.1" ? "roiq.co.nz" : host;
  } catch {
    return "roiq.co.nz";
  }
}

/**
 * An absolute link, for anything leaving the app — an email, a PDF, a share
 * link. A relative path is useless the moment it's read somewhere else.
 */
export function absoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** "Tectara — Know before you buy." */
export const titleWithTagline = (): string => `${PRODUCT_NAME} — ${TAGLINE}`;

/** "Tectara · roiq.co.nz" — the footer line on printed documents. */
export const printFooter = (): string => `${PRODUCT_NAME} · ${displayDomain()}`;
