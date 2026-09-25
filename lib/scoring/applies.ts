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
}

export function legalItemApplies(id: string, p: ApplicabilityInput): boolean {
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
