export type PriceMethod =
  | "fixed"
  | "enquiries_over"
  | "deadline"
  | "auction"
  | "tender"
  | "price_by_negotiation"
  | "unknown";

export type PropertyType =
  | "house"
  | "townhouse"
  | "unit"
  | "apartment"
  | "section"
  | "lifestyle"
  | "rural"
  | "commercial"
  | "unknown";

export type TitleType =
  | "freehold"
  | "cross_lease"
  | "unit_title"
  | "leasehold"
  | "licence_to_occupy"
  | "unknown";

export interface ScrapedListing {
  url: string;
  portal: SupportedPortal;
  listingId: string | null;

  // Property details
  address: string | null;
  suburb: string | null;
  city: string | null;
  region: string | null;

  // Price
  askingPrice: number | null;
  priceMethod: PriceMethod;
  priceText: string | null;
  rvCv: number | null;

  // Physical
  bedrooms: number | null;
  bathrooms: number | null;
  carParks: number | null;
  floorAreaSqm: number | null;
  landAreaSqm: number | null;
  propertyType: PropertyType;
  titleType: TitleType;
  /**
   * The owner's undivided share of the land, from LINZ — 0.5 on a two-flat
   * cross lease, 1 on a freehold section. Null means we could not read it,
   * which is deliberately not the same as 1: `landAreaSqm` on a cross lease is
   * the WHOLE site, shared with the other flats, and only this fraction says
   * how much of it is actually being bought.
   */
  landShareFraction: number | null;
  buildYear: number | null;

  // Listing details
  description: string | null;
  features: string[];
  agentName: string | null;
  agencyName: string | null;
  daysOnMarket: number | null;
  listedAt: string | null;

  // Media
  photoUrls: string[];

  // Meta
  scrapedAt: string;
  scrapedOk: boolean;
  errorMessage: string | null;
  /** Set when data was recovered from a fallback source (web search), e.g. "Data sourced from OneRoof …". */
  dataSource?: string | null;
  /**
   * The portal published a floor area of exactly 0 — it is telling us there is
   * no building, not failing to tell us how big one is.
   *
   * Kept apart from `floorAreaSqm: null` because the two lead opposite ways: a
   * missing figure sends us looking one up, a stated zero means there is
   * nothing to look up and nothing to score.
   */
  noBuildingStated?: boolean;
  /**
   * The public record for this address — Record of Title and, where the
   * district's roll is published, the rating valuation. Populated by
   * `enrichFromLinz()` in the resolver; null when the address couldn't be
   * pinned to exactly one property.
   */
  linz?: import("@/lib/linz/property-records").LinzPropertyRecord | null;
  /**
   * The district-plan zone, fetched from the council's own service.
   *
   * `null` means it genuinely could not be retrieved — 17 of the 67 councils
   * publish zones only as static maps. The report must SAY that; it must never
   * tell the reader to go and look the zoning up, which is the job they came
   * here to avoid.
   */
  zoning?: import("@/lib/zoning/district-plan").ZoneLookup | null;
}

export type SupportedPortal =
  | "trademe"
  | "realestate"
  | "raywhite"
  | "harcourts"
  | "bayleys"
  | "barfoot"
  | "propertybrokers"
  | "oneroof"
  | "professionals"
  | "unknown";

export function emptyListing(url: string, portal: SupportedPortal): ScrapedListing {
  return {
    url,
    portal,
    listingId: null,
    address: null,
    suburb: null,
    city: null,
    region: null,
    askingPrice: null,
    priceMethod: "unknown",
    priceText: null,
    rvCv: null,
    bedrooms: null,
    bathrooms: null,
    carParks: null,
    floorAreaSqm: null,
    landAreaSqm: null,
    propertyType: "unknown",
    titleType: "unknown",
    landShareFraction: null,
    buildYear: null,
    description: null,
    features: [],
    agentName: null,
    agencyName: null,
    daysOnMarket: null,
    listedAt: null,
    photoUrls: [],
    scrapedAt: new Date().toISOString(),
    scrapedOk: false,
    errorMessage: null,
    dataSource: null,
  };
}
