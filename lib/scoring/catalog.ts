// ============================================================
// BDR SCORING CATALOG (v3.1)
// Display + AI structure DERIVED from SCORING_MODEL so the model
// stays the single source of truth. Icons, labels, ordering, the
// AI checklist, and the tool enum all come from here.
// ============================================================

import { SCORING_MODEL, type ScoringSubItem, type Inspection, type Persona } from "./model";
import { getMaxPoints } from "./engine";
import type { SourceType } from "@/lib/property-tab/types";

// ── Inspection-level display metadata ────────────────────────────────────────

export const INSPECTION_ORDER: Inspection[] = ["improvements", "location", "land", "legal"];

export const INSPECTION_META: Record<Inspection, { label: string; icon: string; blurb: string }> = {
  improvements: { label: "Improvements", icon: "🏠", blurb: "The building and everything on the land" },
  location: { label: "Location", icon: "📍", blurb: "Demand, lifestyle, and access" },
  land: { label: "Land", icon: "⛰️", blurb: "Site quality — size, contour, aspect & access" },
  legal: { label: "Legal", icon: "📜", blurb: "Title and compliance" },
};

// ── Category-level icons (improvements has several; others have one) ──────────

export const CATEGORY_ICON: Record<string, string> = {
  Exterior: "🧱",
  Kitchen: "🍳",
  Bathroom: "🚿",
  "Living areas": "🛋️",
  Bedrooms: "🛏️",
  Garage: "🚗",
  "Outdoor & grounds": "🌿",
  "Sun & aspect": "☀️",
  "Demand & lifestyle": "📈",
  "Hazard & site": "⛰️",
  "Title & compliance": "📜",
};

// ── Fast lookups ─────────────────────────────────────────────────────────────

export const ALL_V31_IDS: string[] = SCORING_MODEL.map((i) => i.id);

export const ITEM_BY_ID: Record<string, ScoringSubItem> = Object.fromEntries(
  SCORING_MODEL.map((i) => [i.id, i])
);

export function itemLabel(id: string): string {
  return ITEM_BY_ID[id]?.label ?? id;
}

// ── Grouped catalog: inspection → category → items (preserves model order) ────

export interface CatalogCategory {
  inspection: Inspection;
  category: string;
  icon: string;
  items: ScoringSubItem[];
}

export interface CatalogInspection {
  inspection: Inspection;
  label: string;
  icon: string;
  blurb: string;
  categories: CatalogCategory[];
}

let _catalog: CatalogInspection[] | null = null;

/** SCORING_MODEL regrouped for display + AI checklists, memoised. */
export function buildCatalog(): CatalogInspection[] {
  if (_catalog) return _catalog;

  const out: CatalogInspection[] = INSPECTION_ORDER.map((insp) => ({
    inspection: insp,
    label: INSPECTION_META[insp].label,
    icon: INSPECTION_META[insp].icon,
    blurb: INSPECTION_META[insp].blurb,
    categories: [],
  }));
  const byInsp = new Map(out.map((o) => [o.inspection, o]));

  for (const item of SCORING_MODEL) {
    const insp = byInsp.get(item.inspection)!;
    let cat = insp.categories.find((c) => c.category === item.category);
    if (!cat) {
      cat = {
        inspection: item.inspection,
        category: item.category,
        icon: CATEGORY_ICON[item.category] ?? "•",
        items: [],
      };
      insp.categories.push(cat);
    }
    cat.items.push(item);
  }

  _catalog = out;
  return out;
}

/** All distinct "inspection:category" pairs in model order (for fan-out / bars). */
export function categoryKeys(): { key: string; inspection: Inspection; category: string; icon: string }[] {
  return buildCatalog().flatMap((insp) =>
    insp.categories.map((c) => ({
      key: `${c.inspection}:${c.category}`,
      inspection: c.inspection,
      category: c.category,
      icon: c.icon,
    }))
  );
}

// ── Per-persona category subtotals (the denominator each bar fills towards) ───

export function categoryMax(category: CatalogCategory, persona: Persona): number {
  return category.items.reduce((s, it) => s + getMaxPoints(it, persona), 0);
}

export function inspectionMax(inspection: Inspection, persona: Persona): number {
  return SCORING_MODEL.filter((i) => i.inspection === inspection).reduce(
    (s, it) => s + getMaxPoints(it, persona),
    0
  );
}

// ── VFM grade (A+ … F). Calculated separately from the quality score per spec;
//    here it is an indicative band off the normalised /1000 base. ─────────────

export function vfmGrade(score: number): string {
  if (score >= 900) return "A+";
  if (score >= 820) return "A";
  if (score >= 740) return "A-";
  if (score >= 660) return "B+";
  if (score >= 580) return "B";
  if (score >= 500) return "B-";
  if (score >= 420) return "C+";
  if (score >= 340) return "C";
  if (score >= 260) return "D";
  return "F";
}

export function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#00e676";
  if (grade.startsWith("B")) return "#00d4c8";
  if (grade.startsWith("C")) return "#f59e0b";
  return "#ef4444";
}

// ── Source taxonomy (v3.2 §5) — a named, real source for every Location/Land/
//    Legal sub-item. Used as a guaranteed fallback when the AI omits a source,
//    and by the demo. Never a vague source. ────────────────────────────────────

export interface SourceRef {
  source: string;
  sourceType: SourceType;
  verifyAgainst?: string;
}

export const SOURCE_TAXONOMY: Record<string, SourceRef> = {
  // Location
  loc_schools: { source: "Ministry of Education enrolment zones + property address", sourceType: "moe_zones", verifyAgainst: "Ministry of Education / the school" },
  loc_growth: { source: "BDR Report market data — suburb median trend & days-to-sell", sourceType: "market_data" },
  loc_sun: { source: "Photo analysis (sun, shadows, room orientation) + section orientation", sourceType: "photo" },
  loc_amenities: { source: "Map POI data — distance to supermarket, shops, cafés", sourceType: "map_poi" },
  loc_street: { source: "Streetscape photos + street-level inference", sourceType: "photo" },
  loc_employment: { source: "Map routing distance/time to the CBD", sourceType: "map_poi" },
  loc_transport: { source: "Transit/map data — nearest stops & frequency", sourceType: "map_poi" },
  loc_walkability: { source: "POI density around the address", sourceType: "map_poi" },
  loc_parks: { source: "Map POI — nearest parks & reserves", sourceType: "map_poi" },
  loc_views: { source: "Photos taken from windows/balcony", sourceType: "photo" },
  loc_noise: { source: "Proximity to motorway/rail/airport/industry on map", sourceType: "map_poi" },
  loc_safety: { source: "Area-level safety data for the suburb", sourceType: "market_data" },
  loc_future: { source: "Council district plan / zoning layer", sourceType: "council_data", verifyAgainst: "council district plan" },
  // Land (v4 — flood, liquefaction, coastal, soil, fault, wind erased)
  land_size: { source: "Record of title / LINZ", sourceType: "linz" },
  land_topography: { source: "Photos + topographic contours (LINZ)", sourceType: "linz" },
  land_aspect: { source: "Section orientation on the map", sourceType: "map_poi" },
  land_shape: { source: "Title diagram / aerial imagery", sourceType: "linz" },
  land_subdivision: { source: "Zoning + lot size + district-plan minimum-lot rules", sourceType: "council_data", verifyAgainst: "council district plan" },
  land_frontage: { source: "Record of title / listing", sourceType: "title" },
  land_trees: { source: "Photos + council protected/notable-tree register", sourceType: "council_data" },
  // Legal
  leg_title: { source: "Record of title / listing", sourceType: "title", verifyAgainst: "record of title" },
  leg_weathertight: { source: "Build era + cladding type + leaky-era window (1994–2004)", sourceType: "inference", verifyAgainst: "LIM / building report" },
  leg_unconsented: { source: "LIM / council property file + photo cross-check", sourceType: "lim", verifyAgainst: "LIM / council property file" },
  leg_consents: { source: "LIM / council records (CCCs issued)", sourceType: "lim", verifyAgainst: "LIM" },
  leg_eqc: { source: "Listing disclosure / EQC claim records", sourceType: "council_data", verifyAgainst: "EQC claim history" },
  leg_bodycorp: { source: "Body corporate minutes & disclosure (unit title)", sourceType: "title", verifyAgainst: "body corporate minutes" },
  leg_easements: { source: "Record of title", sourceType: "title", verifyAgainst: "record of title" },
  leg_crosslease: { source: "Flats plan vs current footprint (title)", sourceType: "title", verifyAgainst: "flats plan / record of title" },
  leg_lim: { source: "LIM", sourceType: "lim", verifyAgainst: "LIM" },
  leg_encumbrances: { source: "Record of title", sourceType: "title", verifyAgainst: "record of title" },
};

// ── Document verification (v3.3) ─────────────────────────────────────────────
// These legal items show NO inferred score — a real document must be uploaded
// and read by Claude to earn a verified score that counts toward the total.
export const VERIFIED_DOC_ITEMS = ["leg_lim", "leg_consents", "leg_eqc"] as const;
export const TITLE_ITEM = "leg_title";

export function isVerifiedDocItem(id: string): boolean {
  return (VERIFIED_DOC_ITEMS as readonly string[]).includes(id);
}

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  photo: "Photo analysis",
  council_data: "Council data",
  linz: "LINZ",
  title: "Record of title",
  lim: "LIM",
  gns: "GNS Science",
  market_data: "Market data",
  map_poi: "Map data",
  moe_zones: "MoE zones",
  inference: "Inference",
};
