// Listing acquisition with a fallback chain: try the direct portal scrape, and
// when it's blocked / empty / unsupported (or it's TradeMe, which blocks bots),
// recover the SAME property from another source via web search. The result
// carries a `dataSource` note when a fallback was used.

import { scrapeListingUrl, detectPortalFromUrl, type ScrapedListing } from "@/lib/scraper";
import { emptyListing } from "@/lib/scraper/types";
import { searchListing } from "@/lib/ai/listing-search";
import { lookupPropertyAreas } from "@/lib/ai/property-areas";
import { assessDwelling, identifiesOneProperty } from "@/lib/property/dwelling";
import { lookupLinzPropertyRecord } from "@/lib/linz/property-records";
import { lookupZone } from "@/lib/zoning/district-plan";
import type { TitleType } from "@/lib/scraper/types";

export class ListingNotFoundError extends Error {
  constructor() {
    super("LISTING_NOT_FOUND");
    this.name = "ListingNotFoundError";
  }
}

const PORTAL_LABEL: Record<string, string> = {
  trademe: "Trade Me", realestate: "realestate.co.nz", raywhite: "Ray White", harcourts: "Harcourts",
  bayleys: "Bayleys", barfoot: "Barfoot & Thompson", propertybrokers: "Property Brokers", oneroof: "OneRoof", professionals: "Professionals", unknown: "original",
};

const hasRealData = (l: ScrapedListing): boolean => l.askingPrice != null || l.bedrooms != null || l.floorAreaSqm != null;

// Below this many photos a listing can't support a real visual condition report
// (a single aerial-drone shot isn't a gallery) → go looking for the full set on
// OneRoof / the agent's own site before analysing.
const MIN_GALLERY = 5;

// Guard against garbage counts reaching the report (e.g. a 481 m² land area misread
// as "481 bedrooms"): a residential property doesn't have >20 beds/baths/car parks.
// Drop an out-of-range value rather than display it. Applied to every resolved
// listing, so it catches bad data from any scraper OR the web-search recovery.
function sanitizeCounts(l: ScrapedListing): ScrapedListing {
  const sane = (n: number | null): number | null => (n != null && n >= 1 && n <= 20 ? n : null);
  l.bedrooms = sane(l.bedrooms);
  l.bathrooms = sane(l.bathrooms);
  l.carParks = sane(l.carParks);
  return l;
}

// Fill gaps in `base` from recovered `fields` (recovered data wins on nulls/unknowns).
function merge(base: ScrapedListing, f: Partial<ScrapedListing>): ScrapedListing {
  return {
    ...base,
    address: f.address ?? base.address,
    suburb: f.suburb ?? base.suburb,
    city: f.city ?? base.city,
    region: f.region ?? base.region,
    askingPrice: f.askingPrice ?? base.askingPrice,
    priceText: f.priceText ?? base.priceText,
    bedrooms: f.bedrooms ?? base.bedrooms,
    bathrooms: f.bathrooms ?? base.bathrooms,
    carParks: f.carParks ?? base.carParks,
    floorAreaSqm: f.floorAreaSqm ?? base.floorAreaSqm,
    landAreaSqm: f.landAreaSqm ?? base.landAreaSqm,
    buildYear: f.buildYear ?? base.buildYear,
    propertyType: f.propertyType && f.propertyType !== "unknown" ? f.propertyType : base.propertyType,
    description: f.description ?? base.description,
    agencyName: f.agencyName ?? base.agencyName,
    agentName: f.agentName ?? base.agentName,
    daysOnMarket: f.daysOnMarket ?? base.daysOnMarket,
    // Sticky. A recovered source describing the neighbouring HOUSE must never
    // overturn the subject listing's own statement that it has no building.
    noBuildingStated: base.noBuildingStated || f.noBuildingStated,
  };
}

/**
 * Floor area powers the Tectara Value Verdict (suburb median $/m² × condition × FLOOR
 * AREA) and land area shows on the report; portals routinely render these two figures
 * client-side or omit them, so even a complete scrape can lack them. When EITHER is
 * missing, fill it from council / RV records by address — only the absent field, and
 * only when we have an address to look up. Scraped values always win; the lookup runs
 * once and never overwrites data we already have.
 */
async function ensureAreas(listing: ScrapedListing, opts: { recoverPrice?: boolean } = {}): Promise<ScrapedListing> {
  // Backfills floor + land area (the Value Verdict needs the floor area) and — when asked —
  // the asking price, for scrapes that couldn't get one at all (e.g. OneRoof, whose subject
  // price is client-rendered and absent from the server HTML). A null priceText means "no
  // price found"; a real "By Negotiation" is left alone. recoverPrice is false on the
  // known-not-for-sale path, where a current asking price must never be introduced.
  const recoverPrice = opts.recoverPrice !== false;
  // A section has no floor area to find, and no building for one to belong to.
  // Looking one up is how a different property's house size and asking price
  // were merged into a bare-land listing.
  const noDwelling = !assessDwelling(listing).hasDwelling;
  const needAreas = !noDwelling && (listing.floorAreaSqm == null || listing.landAreaSqm == null);
  const needPrice = recoverPrice && listing.askingPrice == null && listing.priceText == null;
  if (!needAreas && !needPrice) return listing;
  const query = [listing.address, listing.suburb, listing.city].filter(Boolean).join(", ").trim();
  if (!query) return listing;

  // "Golf Links Road, Westland" is a STREET. A web search for it comes back
  // with whichever property on that road is currently advertised, and merging
  // that in attributes a stranger's floor area and asking price to the property
  // being analysed — the same failure as showing someone the wrong house, but
  // silent. Without a street number there is nothing safe to look up.
  if (!identifiesOneProperty(listing.address)) return listing;

  const facts = await lookupPropertyAreas(query).catch(() => null);
  if (!facts) return listing;

  if (listing.floorAreaSqm == null && facts.floorAreaSqm != null) listing.floorAreaSqm = facts.floorAreaSqm;
  if (listing.landAreaSqm == null && facts.landAreaSqm != null) listing.landAreaSqm = facts.landAreaSqm;
  if (needPrice && (facts.askingPrice != null || facts.priceText != null)) {
    const t = (facts.priceText ?? "").toLowerCase();
    listing.askingPrice = facts.askingPrice;
    listing.priceText = facts.priceText;
    listing.priceMethod =
        /auction/.test(t)                    ? "auction"
      : /deadline/.test(t)                   ? "deadline"
      : /tender/.test(t)                     ? "tender"
      : /enquir|offers over|oeo/.test(t)     ? "enquiries_over"
      : /negotiation|\bpoa\b/.test(t)        ? "price_by_negotiation"
      : facts.askingPrice != null            ? "fixed"
      : "unknown";
    if (facts.source) {
      listing.dataSource = listing.dataSource
        ? `${listing.dataSource} Asking price via ${facts.source}.`
        : `Asking price via ${facts.source}.`;
    }
  }
  return listing;
}

/** LINZ's own wording for a title, mapped onto the app's enum. */
const LINZ_TITLE_TYPES: Record<string, TitleType> = {
  "freehold": "freehold",
  "cross lease": "cross_lease",
  "unit title": "unit_title",
  "leasehold": "leasehold",
};

/**
 * Fill in what the public record already knows.
 *
 * Title type was previously inferred from the word "freehold" appearing
 * somewhere in the listing HTML — which is why the report labelled it
 * "Indicative". LINZ publishes the actual Record of Title for every property in
 * the country, so where it resolves, it simply wins.
 *
 * The rating valuation is treated differently, as enrichment rather than truth:
 * LINZ publishes the roll for only about 12% of properties (287k rows against
 * 2.4m addresses), so most lookups return a title and no valuation. Its figures
 * therefore only ever FILL GAPS — a scraped floor area, which describes the
 * property as it is being sold today, is never overwritten by a rating record
 * that may predate a renovation.
 *
 * Never called without a street number: `identifiesOneProperty` gates it, for
 * the same reason the web-search lookup is gated.
 */
async function enrichFromLinz(listing: ScrapedListing): Promise<ScrapedListing> {
  if (!identifiesOneProperty(listing.address)) return listing;

  const query = [listing.address, listing.suburb, listing.city].filter(Boolean).join(", ").trim();
  const record = await lookupLinzPropertyRecord(query).catch(() => null);
  listing.linz = record;
  if (!record) return listing;

  // The address point and the territorial authority both came back with the
  // record, so the zone costs one more request and no second geocode.
  if (record.lat != null && record.lng != null) {
    listing.zoning = await lookupZone(record.lat, record.lng, record.territorialAuthority).catch(
      () => null
    );
  }

  const linzType = record.title?.type?.trim().toLowerCase();
  const mapped = linzType ? LINZ_TITLE_TYPES[linzType] : undefined;
  if (mapped) listing.titleType = mapped;

  // The title's own area is a survey figure and beats a scraped one.
  if (listing.landAreaSqm == null && record.title?.areaSqm != null) {
    listing.landAreaSqm = record.title.areaSqm;
  }

  const v = record.valuation;
  if (v) {
    if (listing.landAreaSqm == null && v.landAreaSqm != null) listing.landAreaSqm = v.landAreaSqm;
    // Deliberately not when the listing states there is no building: a rating
    // record can lag a demolition, and the listing is describing the property
    // as it is being sold today.
    if (listing.floorAreaSqm == null && !listing.noBuildingStated && v.floorAreaSqm != null) {
      listing.floorAreaSqm = v.floorAreaSqm;
    }
    if (listing.bedrooms == null && v.bedrooms != null) listing.bedrooms = v.bedrooms;
  }
  return listing;
}

// "retrieved June 2026" — so a cited source always carries when it was pulled.
function retrievedStamp(): string {
  return new Date().toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
}

/** Bare hostname for a source note, e.g. "https://www.chaneys.co.nz/x" → "chaneys.co.nz". */
function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

// Portals whose CDNs serve clean, full-resolution images that are FETCHABLE
// server-side (no hotlink/referer block). We prefer these for the actual photo
// recovery: many agency sites (e.g. Harcourts via cloudhi.io) only expose tiny
// thumbnails and 403/redirect a server-side fetch, so their photos look recovered
// but won't load in the vision analysis. OneRoof carries virtually every NZ listing
// with full-res, openly-fetchable images, so it's the most reliable photo source.
const PREFERRED_PHOTO_HOSTS = ["oneroof.co.nz", "realestate.co.nz", "homes.co.nz"];
const isPreferredPhotoHost = (u: string): boolean => PREFERRED_PHOTO_HOSTS.some((h) => hostOf(u).endsWith(h));

/**
 * Fetch the page(s) the web search pointed us to and scrape the photo gallery —
 * web_search gives URLs + facts but rarely the actual image URLs. We try the
 * PREFERRED photo hosts (OneRoof / realestate / homes — clean, full-res, fetchable)
 * first, then fall back to the rest, keeping the page with the MOST photos so a lone
 * hero shot never wins over the full gallery. A solid gallery from a preferred host
 * beats a larger one from an agency CDN that may only serve thumbnails or block
 * server-side fetches. Skips TradeMe (blocks bots); caps the network fan-out.
 */
async function recoverPhotos(candidateUrls: string[]): Promise<{ scraped: ScrapedListing; host: string } | null> {
  // Try clean, reliable portals before agency sites.
  const ranked = [...candidateUrls].sort(
    (a, b) => (isPreferredPhotoHost(a) ? 0 : 1) - (isPreferredPhotoHost(b) ? 0 : 1)
  );
  let best: { scraped: ScrapedListing; host: string } | null = null;          // richest by count
  let bestPreferred: { scraped: ScrapedListing; host: string } | null = null; // richest from a clean host
  let tried = 0;
  for (const cu of ranked) {
    if (detectPortalFromUrl(cu) === "trademe") continue;
    if (tried >= 5) break; // cap the number of pages we fetch
    tried++;
    try {
      const scraped = await scrapeListingUrl(cu);
      const n = scraped.photoUrls.length;
      if (n > (best?.scraped.photoUrls.length ?? 0)) best = { scraped, host: hostOf(cu) };
      if (isPreferredPhotoHost(cu) && n > (bestPreferred?.scraped.photoUrls.length ?? 0)) {
        bestPreferred = { scraped, host: hostOf(cu) };
        if (n >= 8) break; // a full gallery from a clean source — as good as it gets
      }
    } catch {
      /* unreachable / blocked → try the next candidate */
    }
  }
  // Prefer a usable clean gallery over a larger but lower-quality / unfetchable one.
  if (bestPreferred && bestPreferred.scraped.photoUrls.length >= MIN_GALLERY) return bestPreferred;
  return best;
}

/**
 * If `merged` has a THIN gallery (fewer than MIN_GALLERY photos), fetch the search's
 * candidate pages (agency site first) and scrape the gallery — web_search returns
 * page URLs + facts but rarely the actual image URLs, so this is what actually
 * recovers the photo set. We keep `merged`'s data and only swap in the recovered
 * photos when they're RICHER than what we already have (so a single aerial-drone
 * hero never blocks pulling the full agency / OneRoof gallery). The scraped page
 * also gap-fills any missing physical facts. Returns the (possibly enriched) listing
 * and the host the photos came from.
 */
async function fillPhotosFromCandidates(
  merged: ScrapedListing,
  candidateUrls: string[]
): Promise<{ listing: ScrapedListing; photoHost: string | null }> {
  if (merged.photoUrls.length >= MIN_GALLERY || candidateUrls.length === 0) {
    return { listing: merged, photoHost: null };
  }
  const rec = await recoverPhotos(candidateUrls);
  if (!rec || rec.scraped.photoUrls.length <= merged.photoUrls.length) {
    return { listing: merged, photoHost: null };
  }
  const filled = merge(rec.scraped, merged); // existing facts win; the page fills gaps + media
  filled.photoUrls = rec.scraped.photoUrls;
  filled.priceMethod = merged.priceMethod !== "unknown" ? merged.priceMethod : rec.scraped.priceMethod;
  filled.scrapedOk = true;
  return { listing: filled, photoHost: rec.host };
}

export async function resolveListing(url: string): Promise<ScrapedListing> {
  const portal = detectPortalFromUrl(url);
  let listing: ScrapedListing | null = null;

  // Trade Me blocks automated access AND its listing URLs carry no street address, so
  // a bare Trade Me link can't reliably identify the property — recovering from the
  // URL alone has analysed the WRONG house (it found a different property in the same
  // suburb). The UI intercepts Trade Me links and asks the user to confirm the address
  // (→ resolveListingByAddress); this is the backend backstop so no caller can ever
  // silently get the wrong property from a Trade Me URL.
  if (portal === "trademe") throw new ListingNotFoundError();

  // Every (non-Trade Me) URL — known portals AND unknown server-rendered agency
  // sites — gets a direct scrape first: the generic scraper (JSON-LD + CSS/regex)
  // handles most NZ agency sites (e.g. professionals.co.nz), and we fall back to
  // web-search below if it yields nothing real. Scraping the URL the user actually
  // gave beats a flaky search.
  try {
    listing = await scrapeListingUrl(url);
  } catch {
    listing = null;
  }

  // Recover from another source when the scrape was blocked, thin on DATA, or returned
  // too FEW PHOTOS (< MIN_GALLERY). web_search finds the facts + the pages the listing
  // lives on (the agency's own site, portals) but rarely the actual image URLs — so we
  // then FETCH those pages and scrape the photo gallery directly. The user should never
  // see "no photos" — or a lone drone shot — while a full gallery sits on OneRoof / the
  // agent's website.
  const thinGallery = !!listing && hasRealData(listing) && listing.photoUrls.length < MIN_GALLERY;
  if (!listing || !hasRealData(listing) || listing.photoUrls.length < MIN_GALLERY) {
    const found = await searchListing({ url, address: listing?.address ?? null });
    if (found.found || found.candidateUrls.length > 0 || found.fields.bedrooms != null || found.fields.floorAreaSqm != null) {
      if (thinGallery && listing) {
        // We already have a solid listing — only the gallery is thin. Keep all the
        // scraped data and just enrich the PHOTOS from the agency / OneRoof page.
        const rec = await fillPhotosFromCandidates(listing, found.candidateUrls);
        if (rec.photoHost) {
          listing = rec.listing;
          listing.url = url;
          listing.portal = portal;
          listing.dataSource = `${listing.photoUrls.length} photos sourced from ${rec.photoHost} — the original ${PORTAL_LABEL[portal] ?? "listing"} showed only a partial gallery (retrieved ${retrievedStamp()}).`;
        }
      } else {
        // Blocked / no usable data → recover the whole listing from the search, then
        // scrape the gallery from the pages it found.
        let merged = merge(listing ?? emptyListing(url, portal), found.fields);
        merged.scrapedOk = true;
        if (found.fields.photoUrls && found.fields.photoUrls.length > 0) merged.photoUrls = found.fields.photoUrls;

        const rec = await fillPhotosFromCandidates(merged, found.candidateUrls);
        merged = rec.listing;
        merged.url = url;
        merged.portal = portal;

        merged.dataSource = rec.photoHost
          ? `${merged.photoUrls.length} photos sourced from ${rec.photoHost} — the original ${PORTAL_LABEL[portal] ?? "listing"} blocked photo access (retrieved ${retrievedStamp()}).`
          : `Data sourced from ${found.source ?? "web search"}${portal !== "unknown" ? ` — the original ${PORTAL_LABEL[portal] ?? portal} listing was unavailable` : ""} (retrieved ${retrievedStamp()}).`;
        listing = merged;
      }
    }
  }

  // Nothing usable anywhere. A scrape that pulled PHOTOS is still usable — the vision
  // analysis runs on them even when price/beds didn't parse (e.g. a HubSpot agency
  // site), so don't discard a photo-rich result just because fields are thin.
  if (!listing || (!hasRealData(listing) && !listing.address && listing.photoUrls.length === 0)) {
    throw new ListingNotFoundError();
  }
  // Guarantee the floor + land area (records lookup by address) — even on an
  // otherwise-complete scrape, since the Value Verdict needs the floor area.
  listing = await ensureAreas(await enrichFromLinz(listing));
  return sanitizeCounts(listing);
}

// ── Manual address fallback ──────────────────────────────────────────────────
function parseAddress(raw: string): { address: string | null; suburb: string | null; city: string | null; region: string | null } {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    address: parts[0] ?? raw.trim() ?? null,
    suburb: parts[1] ?? null,
    city: parts[2] ?? parts[1] ?? null,
    region: parts[3] ?? null,
  };
}

/**
 * Recover a listing from a user-typed address — used when a URL can't be scraped
 * AND no address could be auto-detected. Searches OneRoof / realestate / homes /
 * the agency; if the property isn't for sale anywhere, it still proceeds on
 * public property data (never throws).
 */
export async function resolveListingByAddress(address: string): Promise<ScrapedListing> {
  let found = await searchListing({ address });
  // Web search is non-deterministic — a COMPLETELY empty first pass (nothing found,
  // no candidate pages, no facts) often succeeds on a second try. Retry once before
  // falling back to bare public data, so a property that IS cross-posted on OneRoof /
  // realestate isn't missed just because the first search happened to give up.
  const isEmpty = (r: typeof found): boolean =>
    !r.found && r.candidateUrls.length === 0 && r.fields.bedrooms == null &&
    r.fields.floorAreaSqm == null && r.fields.landAreaSqm == null && !r.fields.description &&
    (r.fields.photoUrls?.length ?? 0) === 0;
  if (isEmpty(found)) found = await searchListing({ address });
  const base = emptyListing(address, "unknown");
  const p = parseAddress(address);
  const f = found.fields;

  // Currently for sale → use the live listing.
  if (found.found) {
    let merged = merge(base, f);
    merged.address = merged.address ?? address;
    merged.scrapedOk = true;
    if (f.photoUrls && f.photoUrls.length > 0) merged.photoUrls = f.photoUrls;
    // No photo URLs from the search → scrape them from the page(s) it found.
    const rec = await fillPhotosFromCandidates(merged, found.candidateUrls);
    merged = rec.listing;
    merged.dataSource = rec.photoHost
      ? `Listing + ${merged.photoUrls.length} photos sourced from ${rec.photoHost} — retrieved ${retrievedStamp()}.`
      : `Listing data sourced from ${found.source} — retrieved ${retrievedStamp()}.`;
    merged = await ensureAreas(await enrichFromLinz(merged));
    return sanitizeCounts(merged);
  }

  // Not currently for sale, but the search surfaced the property (a past sale, a
  // property-data record, or just the agency / OneRoof page) → analyse on public
  // data, and STILL recover the photos if they're online. The user must never see
  // "no photos" when they exist on the agent's site or OneRoof. NEVER carry a past
  // sale price through as a current asking price.
  const hasFacts = f.bedrooms != null || f.bathrooms != null || f.floorAreaSqm != null || f.landAreaSqm != null || f.buildYear != null || !!f.description;
  const publicDataNote = "Analysis uses public property data — council records / CV, homes.co.nz and comparable sales where available.";
  if (hasFacts || found.candidateUrls.length > 0) {
    let merged = merge(base, f);
    merged.address = merged.address ?? address;
    merged.suburb = merged.suburb ?? p.suburb;
    merged.city = merged.city ?? p.city;
    merged.region = merged.region ?? p.region;
    merged.scrapedOk = true;
    if (f.photoUrls && f.photoUrls.length > 0) merged.photoUrls = f.photoUrls;
    // Recover the photo gallery from the agency / portal page even though it isn't a
    // live listing — and scraping it can also fill in missing physical facts.
    const rec = await fillPhotosFromCandidates(merged, found.candidateUrls);
    merged = rec.listing;
    // A past sale / estimate price is NOT a current asking price — null it AFTER
    // recovery (scraping the page can otherwise re-introduce a sale / estimate figure).
    merged.askingPrice = null;
    merged.priceText = null;
    merged.priceMethod = "unknown";
    const src = found.source ? ` Property details from ${found.source} (public / past-sale record).` : "";
    const photoNote = rec.photoHost ? ` ${merged.photoUrls.length} photos sourced from ${rec.photoHost}.` : "";
    merged.dataSource = `No active listing found for this address.${src}${photoNote} ${publicDataNote}`;
    // Not for sale → recover areas only; never introduce a current asking price.
    merged = await ensureAreas(await enrichFromLinz(merged), { recoverPrice: false });
    return sanitizeCounts(merged);
  }

  // Nothing at all → analyse on the bare address + public data.
  return {
    ...base,
    address: p.address,
    suburb: p.suburb,
    city: p.city,
    region: p.region,
    scrapedOk: true,
    dataSource: `No active listing found for this address. ${publicDataNote}`,
  };
}
