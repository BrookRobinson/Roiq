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
// THE LABEL IS NOT ENOUGH, and 217 Poerua Valley Road proved it on the first
// real farm anybody tried: 489 hectares, advertised by OneRoof as "Rural &
// Lifestyle", 17 mentions of dairy — and it came through the scraper typed
// `house`, was analysed as one, and scored 607/1000 on the state of its rooms.
//
// Three things had to go wrong together and all three were already true:
//   • `detectPropertyType` maps "rural" AND "lifestyle" to `lifestyle`, so
//     `PropertyType.rural` is a value NOTHING in the scraper ever assigns
//   • JSON-LD said "House" first, so the rural wording never got a look-in
//   • with the type wrong, the dwelling check assumed a building and the whole
//     house model ran on a property with no floor area at all
//
// So the primary signal is the LAND AREA — a number the listing states, not a
// string a heuristic has to interpret. It cannot be got wrong by a mistyped
// category, and it survives whatever any portal calls things.
//
// FARM_LAND_SQM is a line somebody drew, and saying otherwise would be
// pretending. It is drawn deliberately far out: NZ lifestyle blocks run to
// perhaps ten hectares and a large one twenty, so at twenty hectares the only
// properties caught are ones nobody would call a home with a paddock. Erring
// high is the right direction — refusing a lifestyle block turns away the exact
// customer this app is for, while missing a small farm costs one analysis. When
// real sales data lands, replace it with evidence.
//
// It sits above two boundaries that already exist, and the three tell a
// consistent story:
//   • up to LAND_VALUE_MAX_SQM (1,650m²)  a normal section, land value published
//   • up to FARM_LAND_SQM                  analysed, land value withheld
//   • beyond                               farmland, refused before we spend
//
// Dependency-free, so scripts/verify-farm.mjs can load it with plain node.
// ============================================================

export interface FarmCheck {
  isFarm: boolean;
  /** Shown to the person who pasted the link, so it has to be a fact. */
  reason: string | null;
}

const NOT_A_FARM: FarmCheck = { isFarm: false, reason: null };

/**
 * Beyond this much land, it is being sold as productive country rather than as
 * a home with a paddock. A drawn line — see the header for why it is drawn here
 * and why erring high is the right direction.
 */
export const FARM_LAND_SQM = 200_000; // 20 hectares

export interface FarmEvidence {
  /** The portal's own classification, where it bothers to state one. */
  propertyType?: string | null;
  /** The primary signal: a number the listing states, not a label to interpret. */
  landAreaSqm?: number | null;
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
  // Land first — it is the signal a mistyped category can't hide.
  const land = listing.landAreaSqm;
  if (typeof land === "number" && Number.isFinite(land) && land > FARM_LAND_SQM) {
    const ha = land / 10_000;
    return {
      isFarm: true,
      reason: `it sits on ${ha < 100 ? ha.toFixed(1) : Math.round(ha).toLocaleString()} hectares, which is farmland rather than a house on a section`,
    };
  }

  const type = (listing.propertyType ?? "").trim().toLowerCase();
  if (type === "rural") {
    return {
      isFarm: true,
      reason: "the listing is advertised as rural farmland rather than a house on a section",
    };
  }
  return NOT_A_FARM;
}
