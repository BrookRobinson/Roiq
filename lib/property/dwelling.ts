// ============================================================
// Is there a building on this property at all?
//
// The whole 1,000-point model scores a DWELLING: its roof, its kitchen, its
// bathroom, its joinery. Run it against a bare section and every one of those
// items is scored from photographs of an empty paddock, and the report reads as
// a confident assessment of a house that does not exist. That is the worst
// class of failure this product has — worse than missing a defect, because the
// output looks exactly as authoritative as a true one.
//
// Pure and dependency-free so it can be reasoned about and tested directly.
//
// Deliberately conservative: this only says "no dwelling" on EVIDENCE the
// listing itself supplies, never on a hunch. Refusing to analyse a real house
// is also a failure, and "large section" appears in the copy of half the houses
// in the country — so loose keyword matching is exactly what this must not do.
// ============================================================

export interface DwellingCheck {
  hasDwelling: boolean;
  /** Why we concluded there's no building — shown to the user, so it must be a fact. */
  reason: string | null;
}

const PRESENT: DwellingCheck = { hasDwelling: true, reason: null };

export interface DwellingEvidence {
  propertyType?: string | null;
  floorAreaSqm?: number | null;
  /** The portal published a floor area of exactly 0 — see ScrapedListing. */
  noBuildingStated?: boolean;
}

/**
 * Decide whether a listing has a building on it.
 *
 * The three signals, strongest first:
 *
 * 1. The portal stated a floor area of exactly 0. This is not a missing value,
 *    it is the portal answering the question — OneRoof publishes
 *    `floorAreaString: "0m²"` on its sections. Strongest because it is the
 *    property's own data rather than anything inferred.
 * 2. The property type is a section. Note this is checked AFTER the stated
 *    zero, because a portal's schema.org markup is generic — OneRoof labels
 *    every property page `SingleFamilyResidence`, sections included, which is
 *    how a paddock came to be scored as a house in the first place.
 * 3. A floor area of 0 that reached us some other way.
 *
 * Bedrooms are deliberately NOT trusted as proof of a dwelling. On the listing
 * that exposed this, a stray "1 bedroom" was scraped out of page furniture for
 * a property with no building on it, so treating a bedroom count as evidence
 * would defeat the check exactly when it matters most.
 */
export function assessDwelling(listing: DwellingEvidence): DwellingCheck {
  if (listing.noBuildingStated) {
    return {
      hasDwelling: false,
      reason: "its floor area is published as 0 m²",
    };
  }

  if ((listing.propertyType ?? "").toLowerCase() === "section") {
    return { hasDwelling: false, reason: "it is advertised as a section" };
  }

  if (listing.floorAreaSqm === 0) {
    return {
      hasDwelling: false,
      reason: "its floor area is published as 0 m²",
    };
  }

  return PRESENT;
}

/**
 * Can this address identify one property, or only a street?
 *
 * "Golf Links Road, Westland" names a road with houses up and down it. Handing
 * that to a web-search lookup returned a DIFFERENT property's floor area and
 * asking price, which were then merged into the report as though they belonged
 * to the section being analysed. A street number is the minimum that
 * distinguishes one title from its neighbours.
 *
 * Accepts the shapes NZ addresses actually take: "14", "14A", "2/14", "Unit 3,
 * 14", "Lot 2, 14". The number must START the first component, as it does in
 * every NZ street address — otherwise "State Highway 6" and marketing titles
 * like "Central Fox Glacier Living 2" would pass as identifying a property.
 */
export function identifiesOneProperty(address: string | null | undefined): boolean {
  if (!address) return false;
  const first = address.split(",")[0]?.trim() ?? "";
  if (!first) return false;
  return /^(?:unit\s*|lot\s*|flat\s*|apt\s*)?\d+\s*[a-z]?\b/i.test(first);
}
