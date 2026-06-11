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
