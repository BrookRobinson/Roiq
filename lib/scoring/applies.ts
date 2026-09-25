// ============================================================
// Whether a legal item APPLIES to this property at all.
//
// An item that can't apply is not a low risk, it is not a question — showing
// "Body corporate" on a freehold house, or asking for an EQC claim history in
// a town that has never had a claims event, hands the reader homework about a
// problem their property cannot have.
//
// Dependency-free so a verify script can load it with plain node.
// ============================================================

/**
 * Regions where a natural-hazard claim history is a live question, because a
 * major claims event hit them: the Canterbury earthquakes (2010–11), the
 * Seddon and Kaikōura earthquakes (2013, 2016), the Nelson–Tasman floods
 * (2022), Cyclone Gabrielle and the Auckland floods (2023). Matched on the
 * listing's region, lower-cased.
 */
const CLAIMS_EVENT_REGIONS = [
  "canterbury",
  "christchurch",
  "wellington",
  "marlborough",
  "kaikoura",
  "kaikōura",
  "hawke's bay",
  "hawkes bay",
  "gisborne",
  "tairāwhiti",
  "tairawhiti",
  "auckland",
  "nelson",
  "tasman",
];
/** Towns inside an event area whose region is wider than it: Buller's 2021 floods. */
const CLAIMS_EVENT_TOWNS = ["westport", "buller", "karamea"];

export interface ApplicabilityInput {
  titleType?: string | null;
  /** The listing / analysis said there is a body corporate — never inferred from the item existing. */
  statedBodyCorporate?: boolean;
  region?: string | null;
  city?: string | null;
  /**
   * Something outside the item points at unconsented work: a second dwelling
   * or structure was found, or the advertised floor area is materially bigger
   * than the rating record. See unconsentedSignal().
   */
  unconsentedSignal?: boolean;
}

/** The item as the analysis left it — only its own read, never its existence. */
export interface ItemRead {
  score?: number | null;
  confidenceTier?: number;
  remediation?: unknown;
}

export function legalItemApplies(id: string, p: ApplicabilityInput, item?: ItemRead): boolean {
  if (id === "leg_unconsented") {
    // Only when something actually raises it. "Nothing in the listing or the
    // public record suggests a problem" is not a risk to check — it was sitting
    // under that heading as "Not established" on houses with nothing to ask.
    // The analysis's own read counts only when it is a real one: a Tier 3
    // guess from nothing is exactly the line being removed.
    const flagged = !!item && ((item.score != null && item.score <= 7 && item.confidenceTier !== 3) || !!item.remediation);
    return p.unconsentedSignal === true || flagged;
  }
  if (id === "leg_bodycorp") {
    // A body corporate comes with a UNIT TITLE. A cross lease or an unknown
    // title can have one only if something actually says so; a freehold title
    // never does.
    if (p.titleType === "unit_title") return true;
    if (p.titleType === "freehold" || p.titleType === "leasehold") return false;
    return p.statedBodyCorporate === true;
  }
  if (id === "leg_eqc") {
    const where = `${p.city ?? ""} ${p.region ?? ""}`.toLowerCase();
    return CLAIMS_EVENT_REGIONS.some((r) => where.includes(r)) || CLAIMS_EVENT_TOWNS.some((t) => where.includes(t));
  }
  return true;
}

/** The outside evidence for unconsented work: another structure, or a floor-area gap. */
export const unconsentedSignal = (a: { extraStructures: number; floorAreaLarger: boolean }): boolean =>
  a.extraStructures > 0 || a.floorAreaLarger;
