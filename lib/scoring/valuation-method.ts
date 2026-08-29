// ============================================================
// Which valuation method fits this property — decided before any of them runs.
//
// There used to be one method applied to everything: land + the building on it.
// That is right for a house on its own section and silently wrong for an
// apartment, which has no land at all. Every apartment in the country came back
// with no valuation and no explanation, because "land + building" had nothing
// to stand on.
//
// TENURE DECIDES IT, NOT THE MARKETING LABEL. A "townhouse" might be freehold
// on its own section, in which case it is a house as far as valuing goes; or it
// might be unit title, in which case it is an apartment that happens to have
// stairs. What the agent called it says nothing. What the title says is
// definitive, and LINZ hands it over free and nationally.
//
// Dependency-free, so scripts/verify-valuation-method.mjs can load it with
// plain node.
// ============================================================

export type ValuationMethod =
  /** Land + the depreciated building on it. A house on its own section. */
  | "land-and-building"
  /** Floor area × what comparable sales of THIS TYPE fetch per m². No land to price. */
  | "floor-area-comparables"
  /** Bare land — nothing built to value. */
  | "land-only"
  /** Nothing we can honestly do. */
  | "none";

export const METHOD_LABEL: Record<ValuationMethod, string> = {
  "land-and-building": "the land plus the building on it",
  "floor-area-comparables": "what comparable sales of this type fetch per square metre",
  "land-only": "the land on its own",
  none: "no method fits this property",
};

export interface MethodInput {
  /** The portal's label. Weak evidence — used only where tenure is silent. */
  propertyType?: string | null;
  /** LINZ's word, and the one that actually decides. */
  titleType?: string | null;
  floorAreaSqm?: number | null;
  landAreaSqm?: number | null;
  /**
   * The owner's undivided share of the land, from LINZ. Decides whether a cross
   * lease can be valued as a house at all — see below.
   */
  landShareFraction?: number | null;
}

/** Tenures where the owner has no section of their own to value. */
const NO_LAND_OF_THEIR_OWN = new Set(["unit_title", "leasehold", "licence_to_occupy"]);

/** Types that are a dwelling stacked among others, whatever the title turns out to say. */
const STACKED = new Set(["apartment", "unit"]);

/**
 * Pick the method.
 *
 * Order matters. Nothing built at all is settled first, because a bare section
 * has no floor area and would otherwise look like an apartment with a missing
 * measurement. Then tenure, then the property type, and only then the fallback
 * — which is the house method, because that is what most listings are.
 */
export function methodFor(input: MethodInput): ValuationMethod {
  const floor = input.floorAreaSqm ?? 0;
  const land = input.landAreaSqm ?? 0;
  const type = (input.propertyType ?? "").trim().toLowerCase();
  const title = (input.titleType ?? "").trim().toLowerCase();

  // Nothing built. Whatever the title says, there is only ground here.
  if (type === "section" || (floor <= 0 && land > 0)) return "land-only";

  // Nothing to measure and no ground either — there is no method for that.
  if (floor <= 0) return "none";

  // No section of their own: an apartment, or anything on a unit or leasehold
  // title. Comparable sales per m² of floor area is the method, because there
  // is no land component to add.
  if (NO_LAND_OF_THEIR_OWN.has(title) || STACKED.has(type)) return "floor-area-comparables";

  // A cross lease is a HOUSE, and used to be sent down the apartment road here.
  //
  // That was wrong in the way that matters most: the apartment method applies no
  // condition multiplier at all — deliberately, because nobody has measured what
  // a condition point is worth per m² in an apartment market — so every
  // cross-lease house in the country was valued with its condition ignored. A
  // cross-lease house scoring 250/1000 and one scoring 850/1000 came back at the
  // same figure. But a cross-lease flat is not stacked among others: it sits on
  // the ground, it has its own roof and its own kitchen, and it wears out and is
  // renovated exactly like the freehold house next door.
  //
  // So it is valued like a house — on the LAND ITS OWNER ACTUALLY HOLDS, which
  // is the whole site times their share, and then discounted for the tenure.
  // Both halves of that are in lib/scoring/cross-lease.ts and property-value.ts.
  //
  // Without the share we cannot do the first half. The portal publishes the
  // whole site for a cross lease and so does the title — 1,200m² for a two-flat
  // pair on 600m² each — so valuing it as a house without dividing it would hand
  // this flat the other flat's land as well. That overstatement is far worse
  // than the condition blindness it would fix, so where LINZ cannot tell us the
  // share, the old method stands and the report says the condition isn't priced.
  if (title === "cross_lease") {
    const share = input.landShareFraction ?? null;
    return share != null && share > 0 && land > 0 ? "land-and-building" : "floor-area-comparables";
  }

  // Freehold with a section under it — a house, a freehold townhouse, a
  // lifestyle block. The land is genuinely theirs and carries real value.
  if (land > 0) return "land-and-building";

  // Freehold, built, and no land area published. The listing is incomplete
  // rather than the property being unusual; comparable sales still work.
  return "floor-area-comparables";
}

/**
 * Is this suburb figure usable for this property?
 *
 * `SuburbValue` records the type its comparables were filtered to. A median
 * built from house sales says nothing about what an apartment fetches — they
 * are different markets in the same street — so a house median must never be
 * applied to an apartment merely because it was the figure to hand.
 */
export function comparablesMatch(
  propertyType: string | null | undefined,
  comparableType: string | null | undefined
): boolean {
  const want = (propertyType ?? "").trim().toLowerCase();
  const got = (comparableType ?? "").trim().toLowerCase();
  if (!want || !got) return false;
  if (want === got) return true;
  // Apartments and units are one market; townhouses and houses are not.
  return STACKED.has(want) && STACKED.has(got);
}
