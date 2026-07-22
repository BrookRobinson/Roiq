// A realistic demo report (14 Ferndale Road, Remuera) powered by the REAL v3.1
// engine, so dashboard demo links (/report/rpt_001) showcase the persona toggle
// genuinely recomputing — not a hardcoded number.

import type { StoredReport } from "@/lib/report-store";
import type { SubItem, ExtraDwelling, UrgencyScore, Remediation, SpecTier } from "@/lib/property-tab/types";
import { urgencyLabel } from "@/lib/property-tab/types";
import { emptyListing } from "@/lib/scraper/types";
import { SCORING_MODEL, usesSpecTier } from "./model";
import { SOURCE_TAXONOMY } from "./catalog";
import { scoreBoth, type Assessment } from "./report";

// Hand-tuned 1–10 scores telling a coherent story: prime Remuera location, sunny
// north aspect, renovated kitchen — but an aging iron roof, no ceiling insulation,
// and weak bathroom ventilation. Clean freehold title on flat, low-hazard land.
const SCORES: Record<string, number> = {
  // Improvements — Exterior
  ext_foundation: 7, ext_roof: 4, ext_cladding: 7, ext_windows: 8, ext_decking: 6,
  ext_gutters: 6, ext_soffits: 7, ext_doors: 7, ext_paint: 6, ext_chimney: 6,
  // Kitchen (recently renovated)
  kit_cabinetry: 8, kit_appliances: 8, kit_benchtop: 9, kit_flooring: 7, kit_layout: 8, kit_sink: 8, kit_splashback: 8,
  // Bathroom
  bath_shower: 6, bath_waterproof: 5, bath_hotwater: 6, bath_vanity: 6, bath_toilet: 7, bath_ventilation: 1, bath_flooring: 6,
  // Living
  liv_heating: 8, liv_size: 8, liv_insulation: 3, liv_light: 9, liv_flooring: 7, liv_ceiling: 7, liv_fixtures: 6,
  // Bedrooms
  bed_size: 7, bed_heating: 5, bed_storage: 7, bed_windows: 8, bed_flooring: 7, bed_ceiling: 7,
  // Garage
  gar_type: 7, gar_construction: 7, gar_door: 6, gar_floor: 7, gar_power: 7,
  // Outdoor
  out_drainage: 6, out_driveway: 7, out_fencing: 7, out_landscaping: 8,
  // Location
  loc_schools: 9, loc_growth: 8, loc_sun: 9, loc_amenities: 8, loc_street: 8, loc_employment: 7,
  loc_transport: 6, loc_walkability: 7, loc_parks: 8, loc_views: 7, loc_noise: 8, loc_safety: 8, loc_future: 7,
  // Land (v4 — flood, liquefaction, coastal, soil, fault, wind erased)
  land_size: 7, land_topography: 6, land_aspect: 8, land_shape: 7, land_frontage: 8, land_trees: 7,
  // Legal (unconsented rear studio flagged — drives the remediation example)
  leg_title: 10, leg_weathertight: 8, leg_unconsented: 4, leg_consents: 7, leg_eqc: 9,
  leg_easements: 7, leg_lim: 7, leg_encumbrances: 9,
};

// Spec/quality tier of the materials (Improvements) — the value axis separate from
// condition. Renovated kitchen + engineered-timber floors are premium; the original
// tiled bathroom is standard; everything unlisted defaults to standard.
const SPEC: Record<string, SpecTier> = {
  kit_cabinetry: "modern", kit_appliances: "modern", kit_benchtop: "modern", kit_splashback: "modern",
  liv_flooring: "modern",
  bath_shower: "dated", bath_vanity: "dated", bath_flooring: "dated",
  liv_fixtures: "dated", // original-ish light fittings & switches
  liv_insulation: "deteriorated", // minimal 1970s insulation — effectively end of life
  bath_ventilation: "deteriorated", // no ducted extractor fans fitted
};

// One-line findings for Location/Land/Legal cards.
const FINDINGS: Record<string, string> = {
  loc_schools: "Double zone — Remuera Primary + Auckland Grammar",
  loc_growth: "Strong — sustained Remuera median growth",
  loc_sun: "Excellent — north-facing living, all-day sun",
  loc_amenities: "Good — Remuera shops & supermarket within ~1km",
  loc_transport: "Moderate — bus routes nearby, no rapid transit",
  land_topography: "Moderate — gentle cross-slope to the rear",
  leg_title: "Freehold — no encumbrances",
  leg_weathertight: "Low risk — 1975 weatherboard, pre-leaky era",
  leg_unconsented: "Flagged — rear studio may be unconsented",
};

// Remediable findings → cost + Renovations line item (Section 8).
const REMEDIATIONS: Record<string, Remediation> = {
  leg_unconsented: {
    description: "Certificate of Acceptance for the rear studio",
    low: 4000,
    mid: 6500,
    high: 9000,
    urgencyYears: 2,
    renovationLineItem: "Certificate of Acceptance — rear studio",
  },
};

const bandFinding = (score: number) =>
  score >= 8 ? "Low concern" : score >= 5 ? "Moderate — verify" : "Concern — investigate";

const DEFAULT_BY_INSPECTION: Record<string, number> = {
  improvements: 7, location: 8, land: 8, legal: 8,
};

const SUMMARIES: Record<string, string> = {
  ext_roof:
    "Photos 1 and 4 show a long-run iron roof with surface rust along the ridgeline and around the flashings, consistent with a c.1975 original. Plan for replacement within 1–2 years; budget a recoat only if a full replacement isn't viable this cycle. Confirm purlin condition and underlay when re-roofing.",
  liv_insulation:
    "No ceiling insulation is visible in the roof-space photo (Photo 9), and the 1975 build era predates insulation requirements. Expect little to no ceiling or underfloor insulation. This is the single highest-impact, lowest-cost improvement — it lifts comfort, lowers running costs, and is required for Healthy Homes if rented.",
  bath_ventilation:
    "The main bathroom (Photo 5) has an openable window but no visible ducted extractor fan. Inadequate extraction drives mould and fails the Healthy Homes ventilation standard. Install ducted fans vented to outside in both bathrooms.",
  bath_waterproof:
    "Tiling in the main bathroom looks original; waterproofing behind 1970s tiling is commonly at or past end of life. Treat as probable — verify at inspection and budget to re-waterproof and re-tile the wet area.",
  loc_schools:
    "Within the Auckland Grammar and Epsom Girls' Grammar double-grammar zones — among the most sought-after school zones in the country, a strong and durable demand driver for owner-occupiers.",
  loc_sun:
    "North-facing living areas (Photos 2 and 3) and a clear northern aspect give excellent all-day sun — a premium feature for Remuera buyers.",
  leg_title:
    "Freehold title — the simplest and most marketable tenure, no body corporate or cross-lease complications. Confirm via the LINZ record of title.",
  leg_weathertight:
    "Built c.1975 in weatherboard — predates the 1994–2004 leaky-building era and uses a forgiving cladding system, so weathertightness risk is low. Still confirm any later monolithic-clad additions.",
  leg_unconsented:
    "Source: listing disclosure and the photo set — the rear studio in photo 12 does not appear in the council records summary, suggesting it may have been added without building consent. Unconsented work is a material legal risk: it can complicate finance and insurance, and a future buyer's lawyer will require it resolved. The usual remedy is a Certificate of Acceptance from the council, which involves an inspection and a fee — we've added an estimated $4,000–$9,000 to the Renovations tab. Order the LIM and council property file before going unconditional; if the work is structurally non-compliant, remediation could cost materially more.",
};

const COSTS: Record<string, { low: number; high: number; notes: string }> = {
  ext_roof: { low: 18000, high: 28000, notes: "185m² long-run iron re-roof incl. underlay, Auckland rate" },
  liv_insulation: { low: 2400, high: 3800, notes: "R3.2 ceiling batts + underfloor blanket, blow-in, Auckland" },
  bath_ventilation: { low: 700, high: 1400, notes: "Ducted extractor fans to two bathrooms" },
  bath_waterproof: { low: 3000, high: 6000, notes: "Re-waterproof + re-tile main bathroom wet area" },
  ext_paint: { low: 6000, high: 11000, notes: "Full exterior weatherboard repaint" },
  ext_gutters: { low: 1800, high: 3200, notes: "Replace spouting + downpipes" },
};

function buildSubItems(): SubItem[] {
  const out: SubItem[] = [];
  for (const item of SCORING_MODEL) {
    // Only the chimney conditional is present in this property.
    if (item.conditional && item.id !== "ext_chimney") continue;
    const score = (SCORES[item.id] ?? DEFAULT_BY_INSPECTION[item.inspection] ?? 7) as UrgencyScore;
    const cost = item.costBearing && COSTS[item.id] ? COSTS[item.id] : null;
    const isImprovement = item.inspection === "improvements";
    const tax = SOURCE_TAXONOMY[item.id];

    // Sourced reasoning for Location/Land/Legal.
    const finding = isImprovement ? undefined : FINDINGS[item.id] ?? bandFinding(score);
    const reasoning = SUMMARIES[item.id]
      ?? (isImprovement
        ? ""
        : `Source: ${tax?.source ?? "listing facts"}. ${finding}. ${tax?.verifyAgainst ? `Confirm against the ${tax.verifyAgainst} before going unconditional.` : "Verify before going unconditional."}`);
    const tier: 1 | 2 | 3 = isImprovement
      ? (score <= 4 ? 1 : 2)
      : (tax && ["title", "photo", "moe_zones", "linz"].includes(tax.sourceType) ? 1 : 3);

    out.push({
      id: item.id,
      name: item.label,
      material: "See assessment",
      estimatedAge: isImprovement ? "c.1975 (build era)" : "—",
      condition: urgencyLabel(score),
      score,
      urgencyLabel: urgencyLabel(score),
      confidenceTier: tier,
      evidenceSource: isImprovement ? "Listing photos" : tax?.source ?? "Location & facts inference",
      aiSummary: reasoning,
      estimatedReplacementCost: cost,
      replacementCostWeight: 0,
      specTier: usesSpecTier(item) ? (SPEC[item.id] ?? "dated") : undefined,
      renovationLink: Boolean(cost),
      healthyHomesLink: item.affectsHealthyHomes,
      photoReferences: item.id === "loc_sun" ? [2, 3] : item.id === "leg_unconsented" ? [12] : [],
      ...(isImprovement
        ? {}
        : {
            finding,
            source: tax?.source,
            sourceType: tax?.sourceType,
            verifyAgainst: tax?.verifyAgainst,
            remediation: REMEDIATIONS[item.id] ?? null,
          }),
    });
  }
  return out;
}

const EXTRA_DWELLINGS: ExtraDwelling[] = [
  {
    id: "ed_1",
    type: "Sleepout / studio (self-contained)",
    sizeEstimate: "~45 m²",
    construction: "Weatherboard, separate from the main dwelling",
    condition: "Good — tidy, lined and powered",
    score: 7 as UrgencyScore,
    estimatedReplacementCost: { low: 95000, high: 135000, notes: "Standalone studio replacement, Auckland" },
    consentStatus: "unknown",
    structureType: "minor_dwelling",
    habitable: true,
    sizeSqm: 45,
    bedrooms: 1,
    selfContained: true,
    aiSummary:
      "A separate ~45m² weatherboard studio sits at the rear (Photo 12) — lined, powered, with its own entry and windows to two elevations. Externally it presents as a self-contained sleepout. We cannot see inside: the interior fit-out, any kitchen or bathroom, insulation and the state of the services are all unverified from the listing photos.",
    redFlags: [
      "Sleeping space with no consent on record — it can't legally be rented until that's confirmed or regularised (LIM check).",
      "No heat pump head or flue visible on any elevation — likely no fixed heating, which a tenanted dwelling must have.",
      "Sits close to ground level with little visible clearance — check subfloor ventilation and damp.",
    ],
    healthyHomes: [
      { standard: "heating", status: "absent", note: "No fixed heat source visible on any elevation" },
      { standard: "insulation", status: "not_visible", note: "Cannot be seen from photos" },
      { standard: "ventilation", status: "not_visible", note: "Windows present; no extractor confirmed" },
      { standard: "moisture", status: "not_visible", note: "Low ground clearance — inspect subfloor" },
      { standard: "draught", status: "not_visible" },
    ],
    photoReferences: [12],
  },
  {
    id: "ed_2",
    type: "Open pole shed",
    sizeEstimate: "~60 m² (9 × 6.5m)",
    construction: "Steel portal frame, open-sided, gravel floor",
    condition: "Fair — surface rust to the purlins",
    score: 6 as UrgencyScore,
    estimatedReplacementCost: { low: 22000, high: 32000, notes: "Steel pole shed, Auckland" },
    consentStatus: "unknown",
    structureType: "pole_shed",
    habitable: false,
    sizeSqm: 60,
    aiSummary:
      "An open-sided steel pole shed (~60m², stated in the listing) sits behind the garage (Photo 15). Useful covered storage for a boat, trailer or machinery. Open-sided with a gravel floor, so it's shelter rather than secure storage.",
    photoReferences: [15],
  },
  {
    id: "ed_3",
    type: "In-ground swimming pool",
    sizeEstimate: "~8 × 4m",
    construction: "In-ground, tiled surround",
    condition: "Good — clear water, tidy coping",
    score: 7 as UrgencyScore,
    estimatedReplacementCost: { low: 70000, high: 100000, notes: "In-ground pool replacement, Auckland" },
    consentStatus: "unknown",
    structureType: "pool_inground",
    habitable: false,
    aiSummary:
      "A tiled in-ground pool (~8 × 4m) occupies the northern lawn (Photos 16–17). Water is clear and the coping looks sound. The pool fence is partly obscured in the photos — compliance can't be confirmed from the listing.",
    redFlags: ["Pool fencing compliance can't be confirmed from the photos — a non-compliant barrier is a legal breach and must be fixed before settlement."],
    photoReferences: [16, 17],
  },
];

function buildDemoAssessment(): Assessment {
  const subItems = buildSubItems();
  return {
    subItems,
    extraDwellings: EXTRA_DWELLINGS,
    penalties: [],
    context: {
      titleType: "freehold",
      hasChimney: true,
      hasSolar: false,
      hasRetainingWalls: false,
      hasPool: false,
      hasBodyCorporate: false,
    },
  };
}

export function buildDemoReport(): StoredReport {
  const assessment = buildDemoAssessment();
  const scores = scoreBoth(assessment);

  const listing = {
    ...emptyListing("https://www.trademe.co.nz/a/property/residential/sale/auckland/remuera/14-ferndale-road", "trademe"),
    listingId: "rpt_001",
    address: "14 Ferndale Road",
    suburb: "Remuera",
    city: "Auckland",
    region: "Auckland",
    askingPrice: 1150000,
    priceMethod: "deadline" as const,
    priceText: "Deadline sale",
    bedrooms: 3,
    bathrooms: 2,
    carParks: 1,
    floorAreaSqm: 185,
    landAreaSqm: 612,
    propertyType: "house" as const,
    titleType: "freehold" as const,
    buildYear: 1975,
    description: "Sun-drenched 1970s family home in the double-grammar zone, renovated kitchen, separate studio.",
    daysOnMarket: 68,
    photoUrls: Array.from({ length: 18 }, (_, i) => `demo-photo-${i + 1}`),
    scrapedOk: true,
  };

  return {
    id: "rpt_001",
    createdAt: "2026-06-03T00:00:00.000Z",
    listing,
    context: assessment.context,
    subItems: assessment.subItems,
    extraDwellings: assessment.extraDwellings,
    penalties: assessment.penalties,
    scores,
    gaps: [
      {
        gapType: "document",
        area: "Title & LIM",
        description: "Order a LIM and the LINZ record of title to confirm freehold tenure, consents for the studio, and any natural-hazard overlays.",
        includedInAgentLetter: false,
        includedInLimLetter: true,
      },
      {
        gapType: "photo",
        area: "Roof space",
        description: "No clear roof-space photo confirming insulation — request one or confirm at inspection.",
        includedInAgentLetter: true,
        includedInLimLetter: false,
      },
    ],
    photosAnalysed: 18,
    model: "claude-sonnet-4-6 (demo)",
    marketRent: {
      weekly: 850,
      source: "myRent + Tenancy Services market rent (Remuera, 3-bed)",
      isEstimate: false,
    },
    capitalGrowth: {
      annualRatePct: 4.7,
      source: "QV House Price Index + Opes Partners (Auckland ~4.66%/yr, 20-yr avg)",
      why:
        "Within the Auckland Grammar / Epsom Girls' double-grammar zone — a durable, supply-constrained demand driver. Established Auckland City suburb with limited new-build competition, so values hold up better through cycles.",
      recentNote: "Median down ~9.4% over the last 12 months in a softer Auckland market — the projection uses the long-run trend, not the recent dip.",
    },
    suburbValue: {
      medianPerSqm: 9500,
      sampleSize: 18,
      medianSalePrice: 1750000,
      medianFloorArea: 184,
      propertyType: "house",
      suburb: "Remuera, Auckland",
      source: "oneroof.co.nz + homes.co.nz",
      retrieved: "June 2026",
    },
  };
}
