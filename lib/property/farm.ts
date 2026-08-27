// ============================================================
// Is this a farm? Because if it is, we stop before we start.
//
// Tectara values a home and the ground it sits on: what condition it's in, what
// it needs spent on it, and what that's worth against the asking price. A farm
// isn't worth what its house is worth. It's worth what it produces — hectares,
// soil, water take, stock units, supply contracts — and none of that is in a
// listing photograph. Running the 1,000-point model over one would score a
// $3m dairy unit on the state of its kitchen.
//
// So the refusal is at the door, before the analysis is paid for. It is the
// same shape as the bare-land check next door (lib/property/dwelling.ts): a
// fact about the listing, and a reason that gets shown to the person who pasted
// it, which is why the reason must be true rather than merely plausible.
//
// WHAT THIS DOESN'T DO is guess from land size. There's no hectare figure that
// separates a farm from a lifestyle block without somebody choosing it, and a
// lifestyle block IS in scope — a house on a few hectares is exactly the sort
// of property this app is for. So the only signal used is the one the portal
// states itself, which is the same standard the map already accepts for
// property types: a listing filed under rural/farming is a farm because the
// people selling it say so.
//
// A farm that arrives untyped falls through to the checks that already exist:
// no dwelling gets a land report, and a land value past LAND_VALUE_MAX_SQM is
// withheld rather than published. It won't be caught here, and that's a known
// gap rather than a silent one.
//
// Dependency-free, so scripts/verify-farm.mjs can load it with plain node.
// ============================================================

export interface FarmCheck {
  isFarm: boolean;
  /** Shown to the person who pasted the link, so it has to be a fact. */
  reason: string | null;
}

const NOT_A_FARM: FarmCheck = { isFarm: false, reason: null };

export interface FarmEvidence {
  /** The portal's own classification. "rural" is the one that means farming. */
  propertyType?: string | null;
}

/**
 * Farming land, by the portal's own classification.
 *
 * "lifestyle" is deliberately NOT a farm. A house on a few hectares is a home
 * with a paddock, and it is squarely what this app is for — the land figure on
 * one is already handled by the land-value cap rather than by refusing the
 * property outright.
 */
export function assessFarm(listing: FarmEvidence): FarmCheck {
  const type = (listing.propertyType ?? "").trim().toLowerCase();
  if (type === "rural") {
    return {
      isFarm: true,
      reason: "the listing is advertised as rural farmland rather than a house on a section",
    };
  }
  return NOT_A_FARM;
}
