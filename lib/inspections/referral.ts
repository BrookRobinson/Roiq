// ============================================================
// "Get this report verified in person" — the rules, in one place.
//
// A buyer asks for an in-person building inspection from a report. The
// request goes to the partner inspector who covers the property's region; the
// buyer pays the inspector as normal, and the inspector owes Tectara a fixed
// fee for the lead.
//
// Pure — safe to import from the dialog and the route alike.
// ============================================================

import { PRODUCT_NAME } from "@/lib/brand";

/** What a partner pays per lead unless their own row says otherwise (NZ$60). */
export const DEFAULT_LEAD_FEE_CENTS = 6000;

/**
 * The consent the buyer ticks. Stored verbatim with the request: under the NZ
 * Privacy Act, passing someone's contact details to a third party needs their
 * say-so, and a record of exactly what they agreed to.
 */
export const CONSENT_TEXT =
  `I agree to ${PRODUCT_NAME} sharing my name, email, phone number and this report with a partner ` +
  "building inspector so they can contact me about an inspection.";

/**
 * Said before anyone presses send. A recommendation that was quietly paid for
 * is the thing that would cost a buyer's trust in the report itself, so the
 * fee is disclosed up front (and the Fair Trading Act expects no less).
 */
export const FEE_DISCLOSURE =
  `${PRODUCT_NAME} receives a referral fee from the inspector. You pay the inspector for the inspection as normal; ` +
  "the inspector is independent, and their report is theirs.";

/** "West Coast", "west-coast", " WELLINGTON " → "west coast". */
export function normaliseRegion(r: string | null | undefined): string {
  return (r ?? "").toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

export interface InspectorLike {
  id: string;
  regions: string[] | null;
  active: boolean;
  created_at?: string;
}

/**
 * The partner covering this region: the first active one, oldest first, so the
 * same region always goes to the same partner. Null when nobody covers it —
 * the request is still recorded and forwarded to Tectara by hand.
 */
export function inspectorForRegion<T extends InspectorLike>(inspectors: T[], region: string | null | undefined): T | null {
  const want = normaliseRegion(region);
  if (!want) return null;
  const covering = inspectors
    .filter((i) => i.active && (i.regions ?? []).some((r) => normaliseRegion(r) === want))
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  return covering[0] ?? null;
}

export const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
