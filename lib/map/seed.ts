// ============================================================
// Property Map — 20 seed listings across Auckland, Wellington and Christchurch,
// with pre-computed RoiQ scores, valuations and repair allowances. Used as the
// fallback when the `map_listings` table is empty (it currently always is, since
// the 24h scoring job hasn't run against live portals yet). Tuned for a
// green/orange/red spread in BOTH modes: homebuyer colour = valuation vs asking;
// investor colour emerges from price / growth / rent under the default variables.
// ============================================================

import type { MapListing } from "./types";

const PHOTOS = [
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=70",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=70",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=70",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70",
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=70",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=70",
];
const pics = (i: number): string[] => [PHOTOS[i % PHOTOS.length], PHOTOS[(i + 2) % PHOTOS.length]];

type Seed = Omit<MapListing, "photos" | "status" | "fullReportId"> & { listingType: MapListing["listingType"] };

const RAW: Seed[] = [
  // ── Auckland ──────────────────────────────────────────────────────────────
  { id: "seed-01", address: "24 Victoria Ave, Remuera", suburb: "Remuera", city: "Auckland", region: "Auckland", lat: -36.8770, lng: 174.8010, askingPrice: 1_850_000, bedrooms: 4, bathrooms: 3, propertyType: "house", floorAreaSqm: 220, landAreaSqm: 650, listingType: "negotiation", roiqScore: 720, roiqValuation: 1_720_000, medianPerSqm: 9_800, repairAllowance: 15_000, repairBreakdown: { "Kitchen refresh": 15_000 }, estimatedWeeklyRent: 1_150, suburbGrowthRatePct: 3.5 },
  { id: "seed-02", address: "9 Franklin Rd, Ponsonby", suburb: "Ponsonby", city: "Auckland", region: "Auckland", lat: -36.8560, lng: 174.7450, askingPrice: 1_650_000, bedrooms: 3, bathrooms: 2, propertyType: "house", floorAreaSqm: 180, landAreaSqm: 320, listingType: "auction", roiqScore: 780, roiqValuation: 1_980_000, medianPerSqm: 11_400, repairAllowance: 8_000, repairBreakdown: { "Interior repaint": 8_000 }, estimatedWeeklyRent: 1_050, suburbGrowthRatePct: 4.0 },
  { id: "seed-03", address: "51 Mount Eden Rd, Mount Eden", suburb: "Mount Eden", city: "Auckland", region: "Auckland", lat: -36.8770, lng: 174.7640, askingPrice: 1_250_000, bedrooms: 4, bathrooms: 2, propertyType: "house", floorAreaSqm: 160, landAreaSqm: 480, listingType: "sale", roiqScore: 690, roiqValuation: 1_150_000, medianPerSqm: 8_400, repairAllowance: 22_000, repairBreakdown: { "Roof replacement": 14_000, "Bathroom": 8_000 }, estimatedWeeklyRent: 850, suburbGrowthRatePct: 4.2 },
  { id: "seed-04", address: "12 Great South Rd, Manukau", suburb: "Manukau", city: "Auckland", region: "Auckland", lat: -36.9930, lng: 174.8790, askingPrice: 820_000, bedrooms: 4, bathrooms: 2, propertyType: "house", floorAreaSqm: 150, landAreaSqm: 500, listingType: "sale", roiqScore: 640, roiqValuation: 980_000, medianPerSqm: 6_100, repairAllowance: 12_000, repairBreakdown: { "Bathroom": 12_000 }, estimatedWeeklyRent: 640, suburbGrowthRatePct: 5.5 },
  { id: "seed-05", address: "88 Hurstmere Rd, Takapuna", suburb: "Takapuna", city: "Auckland", region: "Auckland", lat: -36.7870, lng: 174.7730, askingPrice: 1_950_000, bedrooms: 4, bathrooms: 3, propertyType: "house", floorAreaSqm: 200, landAreaSqm: 620, listingType: "auction", roiqScore: 610, roiqValuation: 1_600_000, medianPerSqm: 9_600, repairAllowance: 30_000, repairBreakdown: { "Roof replacement": 18_000, "Cladding repairs": 12_000 }, estimatedWeeklyRent: 1_200, suburbGrowthRatePct: 4.5 },
  { id: "seed-06", address: "33 Lincoln Rd, Henderson", suburb: "Henderson", city: "Auckland", region: "Auckland", lat: -36.8790, lng: 174.6300, askingPrice: 760_000, bedrooms: 3, bathrooms: 1, propertyType: "house", floorAreaSqm: 140, landAreaSqm: 550, listingType: "sale", roiqScore: 600, roiqValuation: 890_000, medianPerSqm: 5_600, repairAllowance: 18_000, repairBreakdown: { "Roof replacement": 18_000 }, estimatedWeeklyRent: 620, suburbGrowthRatePct: 5.5 },
  { id: "seed-07", address: "7 Elliot St, Papakura", suburb: "Papakura", city: "Auckland", region: "Auckland", lat: -37.0660, lng: 174.9440, askingPrice: 640_000, bedrooms: 3, bathrooms: 1, propertyType: "house", floorAreaSqm: 130, landAreaSqm: 480, listingType: "sale", roiqScore: 560, roiqValuation: 610_000, medianPerSqm: 4_800, repairAllowance: 14_000, repairBreakdown: { "Kitchen refresh": 9_000, "Flooring": 5_000 }, estimatedWeeklyRent: 560, suburbGrowthRatePct: 4.6 },
  { id: "seed-19", address: "5 Broadway, Newmarket", suburb: "Newmarket", city: "Auckland", region: "Auckland", lat: -36.8700, lng: 174.7770, askingPrice: 2_050_000, bedrooms: 3, bathrooms: 2, propertyType: "apartment", floorAreaSqm: 190, landAreaSqm: null, listingType: "negotiation", roiqScore: 640, roiqValuation: 1_720_000, medianPerSqm: 9_500, repairAllowance: 20_000, repairBreakdown: { "Bathroom": 12_000, "Interior repaint": 8_000 }, estimatedWeeklyRent: 1_150, suburbGrowthRatePct: 3.8 },

  // ── Wellington ────────────────────────────────────────────────────────────
  { id: "seed-08", address: "40 Cuba St, Te Aro", suburb: "Te Aro", city: "Wellington", region: "Wellington", lat: -41.2960, lng: 174.7770, askingPrice: 720_000, bedrooms: 2, bathrooms: 1, propertyType: "apartment", floorAreaSqm: 75, landAreaSqm: null, listingType: "sale", roiqScore: 520, roiqValuation: 760_000, medianPerSqm: 9_200, repairAllowance: 6_000, repairBreakdown: { "Interior repaint": 6_000 }, estimatedWeeklyRent: 700, suburbGrowthRatePct: 3.2 },
  { id: "seed-09", address: "18 Karori Rd, Karori", suburb: "Karori", city: "Wellington", region: "Wellington", lat: -41.2840, lng: 174.7360, askingPrice: 980_000, bedrooms: 4, bathrooms: 2, propertyType: "house", floorAreaSqm: 150, landAreaSqm: 600, listingType: "deadline", roiqScore: 700, roiqValuation: 1_180_000, medianPerSqm: 7_700, repairAllowance: 10_000, repairBreakdown: { "Bathroom": 10_000 }, estimatedWeeklyRent: 720, suburbGrowthRatePct: 3.5 },
  { id: "seed-10", address: "22 Miramar Ave, Miramar", suburb: "Miramar", city: "Wellington", region: "Wellington", lat: -41.3180, lng: 174.8210, askingPrice: 890_000, bedrooms: 3, bathrooms: 1, propertyType: "house", floorAreaSqm: 140, landAreaSqm: 460, listingType: "sale", roiqScore: 540, roiqValuation: 720_000, medianPerSqm: 6_400, repairAllowance: 26_000, repairBreakdown: { "Roof replacement": 16_000, "Subfloor / piles": 10_000 }, estimatedWeeklyRent: 680, suburbGrowthRatePct: 3.8 },
  { id: "seed-11", address: "3 Riddiford St, Newtown", suburb: "Newtown", city: "Wellington", region: "Wellington", lat: -41.3110, lng: 174.7810, askingPrice: 850_000, bedrooms: 3, bathrooms: 1, propertyType: "house", floorAreaSqm: 130, landAreaSqm: 350, listingType: "sale", roiqScore: 620, roiqValuation: 900_000, medianPerSqm: 7_100, repairAllowance: 9_000, repairBreakdown: { "Flooring": 9_000 }, estimatedWeeklyRent: 690, suburbGrowthRatePct: 3.6 },
  { id: "seed-12", address: "60 Johnsonville Rd, Johnsonville", suburb: "Johnsonville", city: "Wellington", region: "Wellington", lat: -41.2230, lng: 174.8050, askingPrice: 700_000, bedrooms: 3, bathrooms: 2, propertyType: "house", floorAreaSqm: 135, landAreaSqm: 450, listingType: "sale", roiqScore: 660, roiqValuation: 850_000, medianPerSqm: 6_300, repairAllowance: 7_000, repairBreakdown: { "Interior repaint": 7_000 }, estimatedWeeklyRent: 620, suburbGrowthRatePct: 5.5 },
  { id: "seed-20", address: "14 The Parade, Island Bay", suburb: "Island Bay", city: "Wellington", region: "Wellington", lat: -41.3430, lng: 174.7710, askingPrice: 1_080_000, bedrooms: 4, bathrooms: 2, propertyType: "house", floorAreaSqm: 160, landAreaSqm: 480, listingType: "deadline", roiqScore: 710, roiqValuation: 1_300_000, medianPerSqm: 8_100, repairAllowance: 12_000, repairBreakdown: { "Bathroom": 12_000 }, estimatedWeeklyRent: 780, suburbGrowthRatePct: 3.4 },

  // ── Christchurch ──────────────────────────────────────────────────────────
  { id: "seed-13", address: "72 Papanui Rd, Merivale", suburb: "Merivale", city: "Christchurch", region: "Canterbury", lat: -43.5156, lng: 172.6180, askingPrice: 1_450_000, bedrooms: 4, bathrooms: 3, propertyType: "house", floorAreaSqm: 200, landAreaSqm: 700, listingType: "negotiation", roiqScore: 760, roiqValuation: 1_380_000, medianPerSqm: 7_400, repairAllowance: 11_000, repairBreakdown: { "Kitchen refresh": 11_000 }, estimatedWeeklyRent: 850, suburbGrowthRatePct: 3.5 },
  { id: "seed-14", address: "15 Riccarton Rd, Riccarton", suburb: "Riccarton", city: "Christchurch", region: "Canterbury", lat: -43.5300, lng: 172.5900, askingPrice: 720_000, bedrooms: 3, bathrooms: 2, propertyType: "house", floorAreaSqm: 140, landAreaSqm: 500, listingType: "sale", roiqScore: 650, roiqValuation: 880_000, medianPerSqm: 5_800, repairAllowance: 9_000, repairBreakdown: { "Bathroom": 9_000 }, estimatedWeeklyRent: 600, suburbGrowthRatePct: 5.0 },
  { id: "seed-15", address: "44 Marriner St, Sumner", suburb: "Sumner", city: "Christchurch", region: "Canterbury", lat: -43.5680, lng: 172.7560, askingPrice: 950_000, bedrooms: 3, bathrooms: 2, propertyType: "house", floorAreaSqm: 160, landAreaSqm: 540, listingType: "sale", roiqScore: 560, roiqValuation: 780_000, medianPerSqm: 6_700, repairAllowance: 28_000, repairBreakdown: { "Roof replacement": 17_000, "Deck rebuild": 11_000 }, estimatedWeeklyRent: 700, suburbGrowthRatePct: 4.0 },
  { id: "seed-16", address: "8 Ilam Rd, Ilam", suburb: "Ilam", city: "Christchurch", region: "Canterbury", lat: -43.5230, lng: 172.5820, askingPrice: 780_000, bedrooms: 4, bathrooms: 2, propertyType: "house", floorAreaSqm: 150, landAreaSqm: 520, listingType: "sale", roiqScore: 630, roiqValuation: 760_000, medianPerSqm: 5_600, repairAllowance: 13_000, repairBreakdown: { "Kitchen refresh": 13_000 }, estimatedWeeklyRent: 640, suburbGrowthRatePct: 3.6 },
  { id: "seed-17", address: "26 Main North Rd, Papanui", suburb: "Papanui", city: "Christchurch", region: "Canterbury", lat: -43.4930, lng: 172.6060, askingPrice: 590_000, bedrooms: 3, bathrooms: 1, propertyType: "house", floorAreaSqm: 120, landAreaSqm: 460, listingType: "sale", roiqScore: 580, roiqValuation: 700_000, medianPerSqm: 5_100, repairAllowance: 15_000, repairBreakdown: { "Roof replacement": 15_000 }, estimatedWeeklyRent: 540, suburbGrowthRatePct: 5.0 },
  { id: "seed-18", address: "11 Lincoln Rd, Addington", suburb: "Addington", city: "Christchurch", region: "Canterbury", lat: -43.5410, lng: 172.6180, askingPrice: 520_000, bedrooms: 2, bathrooms: 1, propertyType: "townhouse", floorAreaSqm: 95, landAreaSqm: 180, listingType: "sale", roiqScore: 540, roiqValuation: 500_000, medianPerSqm: 5_300, repairAllowance: 8_000, repairBreakdown: { "Flooring": 8_000 }, estimatedWeeklyRent: 520, suburbGrowthRatePct: 3.9 },
];

export const SEED_LISTINGS: MapListing[] = RAW.map((r, i) => ({
  ...r,
  photos: pics(i),
  status: "active",
  fullReportId: null,
}));

export function seedById(id: string): MapListing | undefined {
  return SEED_LISTINGS.find((l) => l.id === id);
}
