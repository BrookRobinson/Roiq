import Anthropic, { toFile } from "@anthropic-ai/sdk";

import { getAnthropic, ANALYSIS_MODEL, VISION_MODEL } from "./client";
import { SYSTEM_PROMPT } from "./system-prompt";
import {
  ANALYSIS_TOOL,
  ANALYSIS_TOOL_NAME,
  type RawAnalysis,
  type RawSubItem,
  type RawReplacementCost,
  type RawRemediation,
  type RawDwellingHealthyHomes,
} from "./tool-schema";
import { prepareImages, type PreparedImage } from "./images";

import { SCORING_MODEL, LOCATION_PENALTIES, usesSpecTier, SIZE_ITEM_IDS, type ScoringSubItem, type Inspection } from "@/lib/scoring/model";
import { buildCatalog, INSPECTION_META, SOURCE_TAXONOMY, type CatalogInspection } from "@/lib/scoring/catalog";
import { scoreBoth, type Assessment } from "@/lib/scoring/report";
import { fetchMarketData, type MarketResult } from "./market";
import { fetchSuburbValue } from "./comparables";
import type { MarketRent, CapitalGrowth, SuburbValue } from "@/lib/scoring/investment";
import type { PropertyContext, ScoreResult, PenaltyInput } from "@/lib/scoring/engine";
import { urgencyLabel } from "@/lib/property-tab/types";
import type {
  SubItem,
  ExtraDwelling,
  ReplacementCost,
  UrgencyScore,
  ConfidenceTier,
  Remediation,
  SourceType,
  SpecTier,
  SlopeBand,
  ShapeType,
  TreeMaturity,
  TreeUpkeep,
  AspectDirection,
  SunObstruction,
  AccessType,
  DwellingHealthyHomes,
  DwellingHHStandard,
  DwellingHHStatus,
} from "@/lib/property-tab/types";
import type { StructureType } from "@/lib/scoring/structures";
import type { ScrapedListing } from "@/lib/scraper/types";

export interface GapFinding {
  gapType: string;
  area: string;
  description: string;
  includedInAgentLetter: boolean;
  includedInLimLetter: boolean;
}

export interface AnalysisResult {
  context: PropertyContext;
  /** Persona-independent rich assessments, one per scored v3.1 sub-item. */
  subItems: SubItem[];
  extraDwellings: ExtraDwelling[];
  /** Objective location negatives (persona-independent); re-applied on client toggle. */
  penalties: PenaltyInput[];
  /** Both personas, precomputed from the same raw assessment. */
  scores: { buyer: ScoreResult; investor: ScoreResult };
  gaps: GapFinding[];
  /** Web-sourced (cited) market rent + capital growth for the suburb. */
  marketRent?: MarketRent;
  capitalGrowth?: CapitalGrowth;
  /** Web-sourced (cited) suburb median $/m² from recent comparable sales. */
  suburbValue?: SuburbValue;
  photosAnalysed: number;
  model: string;
}

// ── value normalisers ──────────────────────────────────────────────────────

function clampScore(n: number | null | undefined): UrgencyScore | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n))) as UrgencyScore;
}

function clampTier(n: number | undefined): ConfidenceTier {
  return n === 1 || n === 2 || n === 3 ? n : 3;
}

function normCost(c: RawReplacementCost | null | undefined): ReplacementCost | null {
  if (!c || !Number.isFinite(c.low) || !Number.isFinite(c.high)) return null;
  const low = Math.max(0, Math.round(c.low));
  const high = Math.max(low, Math.round(c.high));
  return { low, high, notes: c.notes?.trim() || "" };
}

function normPhotoRefs(refs: number[] | undefined): number[] {
  if (!Array.isArray(refs)) return [];
  return refs.filter((n) => Number.isInteger(n) && n > 0);
}

const STRUCTURE_TYPES: StructureType[] = ["minor_dwelling","tiny_home_fixed","tiny_home_wheels","studio_office","games_room","garage","closed_shed","pole_shed","carport","garden_shed","pool_inground","pool_above","spa","other"];
function normStructureType(v: string | undefined): StructureType | undefined {
  return v && STRUCTURE_TYPES.includes(v as StructureType) ? (v as StructureType) : undefined;
}

const DW_HH_STANDARDS: DwellingHHStandard[] = ["heating", "insulation", "ventilation", "moisture", "draught"];
const DW_HH_STATUSES: DwellingHHStatus[] = ["met", "not_visible", "absent"];

/** Keep only valid standard/status pairs, one entry per standard. */
function normDwellingHH(rows: RawDwellingHealthyHomes[] | undefined): DwellingHealthyHomes[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: DwellingHealthyHomes[] = [];
  for (const r of rows) {
    const standard = r?.standard as DwellingHHStandard;
    const status = r?.status as DwellingHHStatus;
    if (!DW_HH_STANDARDS.includes(standard) || !DW_HH_STATUSES.includes(status)) continue;
    if (seen.has(standard)) continue;
    seen.add(standard);
    out.push({ standard, status, note: r.note?.trim() || undefined });
  }
  return out;
}

const SOURCE_TYPES: SourceType[] = [
  "photo", "council_data", "linz", "title", "lim", "gns", "market_data", "map_poi", "moe_zones", "inference",
];

function normSourceType(s: string | undefined): SourceType | undefined {
  return s && (SOURCE_TYPES as string[]).includes(s) ? (s as SourceType) : undefined;
}

function normRemediation(r: RawRemediation | null | undefined): Remediation | null {
  if (!r || !Number.isFinite(r.low) || !Number.isFinite(r.high)) return null;
  const low = Math.max(0, Math.round(r.low));
  const high = Math.max(low, Math.round(r.high));
  const mid = Number.isFinite(r.mid) ? Math.min(high, Math.max(low, Math.round(r.mid))) : Math.round((low + high) / 2);
  return {
    description: r.description?.trim() || "Remediation",
    low,
    mid,
    high,
    urgencyYears: Number.isFinite(r.urgency_years) ? Math.max(0, Math.round(r.urgency_years)) : 3,
    renovationLineItem: r.renovation_line_item?.trim() || r.description?.trim() || "Remediation",
  };
}

/** Build the v3.2 sourced-reasoning fields, falling back to the source taxonomy. */
function sourcedFields(raw: RawSubItem, item: ScoringSubItem): Partial<SubItem> {
  const tax = SOURCE_TAXONOMY[item.id];
  // Only L/L/L items (and any item the AI explicitly sourced) carry these.
  if (!tax && !raw.finding && !raw.source) return {};
  return {
    finding: raw.finding?.trim() || undefined,
    source: raw.source?.trim() || tax?.source,
    sourceType: normSourceType(raw.source_type) ?? tax?.sourceType,
    verifyAgainst: raw.verify_against?.trim() || tax?.verifyAgainst,
    remediation: item.inspection === "improvements" ? null : normRemediation(raw.remediation),
  };
}

function mapTitle(t: ScrapedListing["titleType"]): PropertyContext["titleType"] {
  switch (t) {
    case "freehold":
    case "cross_lease":
    case "unit_title":
    case "leasehold":
      return t;
    default:
      return "unknown"; // licence_to_occupy / unknown
  }
}

// ── raw → SubItem ──────────────────────────────────────────────────────────

const SPEC_TIERS = ["deteriorated", "dated", "modern", "luxury"] as const;
function normSpecTier(v: string | undefined): SpecTier | undefined {
  if (!v) return undefined;
  if (v === "original") return "dated"; // legacy v4 tier → closest v5 tier (functional but old)
  return (SPEC_TIERS as readonly string[]).includes(v) ? (v as SpecTier) : undefined;
}

const SLOPE_BANDS_IN = ["flat", "gentle", "moderate", "steep"] as const;
function normSlopeBand(v: string | undefined): SlopeBand | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  return (SLOPE_BANDS_IN as readonly string[]).includes(s) ? (s as SlopeBand) : undefined;
}

/** 0–100 usable share; anything outside that is a model slip, so drop it. */
function normUsablePct(v: number | undefined): number | undefined {
  if (v == null || !Number.isFinite(v)) return undefined;
  const n = Math.round(v);
  return n >= 0 && n <= 100 ? n : undefined;
}

const SHAPE_TYPES_IN = [
  "rectangular", "square", "wide_frontage", "long_narrow", "l_shaped", "wedge", "rear_lot", "irregular",
] as const;
function normShapeType(v: string | undefined): ShapeType | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  return (SHAPE_TYPES_IN as readonly string[]).includes(s) ? (s as ShapeType) : undefined;
}

const TREE_MATURITY_IN = ["bare", "young", "established", "mature"] as const;
function normTreeMaturity(v: string | undefined): TreeMaturity | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  return (TREE_MATURITY_IN as readonly string[]).includes(s) ? (s as TreeMaturity) : undefined;
}

const TREE_UPKEEP_IN = ["well_maintained", "tidy", "overgrown", "neglected"] as const;
function normTreeUpkeep(v: string | undefined): TreeUpkeep | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  return (TREE_UPKEEP_IN as readonly string[]).includes(s) ? (s as TreeUpkeep) : undefined;
}

const ASPECT_DIRS_IN = [
  "north", "north_east", "north_west", "east", "west", "south_east", "south_west", "south",
] as const;
function normAspectDirection(v: string | undefined): AspectDirection | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  return (ASPECT_DIRS_IN as readonly string[]).includes(s) ? (s as AspectDirection) : undefined;
}

const SUN_OBSTRUCTION_IN = ["open", "partly_shaded", "heavily_shaded"] as const;
function normSunObstruction(v: string | undefined): SunObstruction | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  return (SUN_OBSTRUCTION_IN as readonly string[]).includes(s) ? (s as SunObstruction) : undefined;
}

const ACCESS_TYPES_IN = [
  "prime_frontage", "corner_site", "road_frontage", "shared_driveway", "right_of_way", "rear_lot",
] as const;
function normAccessType(v: string | undefined): AccessType | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  return (ACCESS_TYPES_IN as readonly string[]).includes(s) ? (s as AccessType) : undefined;
}

/** Households on the access; 1 = sole. Anything outside 1–20 is a model slip. */
function normHomesOnAccess(v: number | undefined): number | undefined {
  if (v == null || !Number.isFinite(v)) return undefined;
  const n = Math.round(v);
  return n >= 1 && n <= 20 ? n : undefined;
}

/** Listing facts mapSubItem needs for the age fallback and size estimates. */
interface SubItemContext {
  buildYear: number | null;
  floorAreaSqm: number | null;
  bedrooms: number | null;
}

const UNKNOWN_AGE_RE = /^(unknown|n\/?a|not\s*(specified|stated|visible|known|assessed)|tbd|\?+|-|—|see assessment)$/i;

/** Never show "Unknown": fall back to a specific year estimate from the build era + spec tier.
 * The AI is asked to always give a justified age; this only fires if it omits one. */
function ageBracket(raw: string | undefined, specTier: SpecTier | undefined, buildYear: number | null): string {
  const a = raw?.trim();
  if (a && !UNKNOWN_AGE_RE.test(a)) return a;
  const now = 2026;
  // Updated/modern fittings in an older house → recently replaced, so young.
  if (specTier === "modern") return "~10 years (est.)";
  if (specTier === "luxury") return "~7 years (est.)";
  // Original-era fittings → age from the build year.
  if (buildYear && buildYear > 1850 && buildYear <= now) {
    return `~${now - buildYear} years (build era, est.)`;
  }
  return specTier === "deteriorated" ? "30+ years (end of life, est.)" : "~25 years (est.)";
}

/** Estimated area for a size item; apportions the total floor area when the AI omits it. */
function sizeSqm(raw: number | undefined, id: string, floorAreaSqm: number | null, bedrooms: number | null): number | undefined {
  if (raw != null && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  const floor = floorAreaSqm && floorAreaSqm > 0 ? floorAreaSqm : null;
  if (!floor) return undefined;
  if (id === "liv_size") return Math.round(floor * 0.28); // open living/dining/kitchen zone
  if (id === "bed_size") {
    const beds = bedrooms && bedrooms > 0 ? bedrooms : 3;
    return Math.max(9, Math.round((floor * 0.4) / beds)); // bedrooms ~40% of floor, split across rooms
  }
  return undefined;
}

function mapSubItem(raw: RawSubItem, item: ScoringSubItem, ctx: SubItemContext): SubItem {
  const score = clampScore(raw.score);
  const specTier = usesSpecTier(item) ? normSpecTier(raw.spec_tier) : undefined;
  return {
    id: item.id,
    name: item.label,
    material: raw.material?.trim() || "Not specified",
    estimatedAge: ageBracket(raw.estimated_age, specTier, ctx.buildYear),
    condition: raw.condition?.trim() || "See assessment",
    score,
    urgencyLabel: urgencyLabel(score),
    confidenceTier: clampTier(raw.confidence_tier),
    evidenceSource:
      raw.evidence_source?.trim() || (score === null ? "Build-era inference" : "Listing photos"),
    aiSummary: raw.ai_summary?.trim() || "",
    // Only cost-bearing items carry a replacement cost into the Renovations tab.
    estimatedReplacementCost: item.costBearing ? normCost(raw.replacement_cost) : null,
    replacementCostWeight: 0, // v3.1 engine weights by persona points, not this field
    specTier,
    observedDefect: raw.observed_defect?.trim() || undefined,
    estimatedSqm: SIZE_ITEM_IDS.has(item.id) ? sizeSqm(raw.estimated_sqm, item.id, ctx.floorAreaSqm, ctx.bedrooms) : undefined,
    // Topography carries the facts its score is derived from (see land-quality.ts).
    slopeBand: item.id === "land_topography" ? normSlopeBand(raw.slope_band) : undefined,
    usableLandPct: item.id === "land_topography" ? normUsablePct(raw.usable_land_pct) : undefined,
    shapeType: item.id === "land_shape" ? normShapeType(raw.shape_type) : undefined,
    workableLandPct: item.id === "land_shape" ? normUsablePct(raw.workable_land_pct) : undefined,
    treeMaturity: item.id === "land_trees" ? normTreeMaturity(raw.tree_maturity) : undefined,
    treeUpkeep: item.id === "land_trees" ? normTreeUpkeep(raw.tree_upkeep) : undefined,
    treesProtected: item.id === "land_trees" ? Boolean(raw.trees_protected) : undefined,
    aspectDirection: item.id === "land_aspect" ? normAspectDirection(raw.aspect_direction) : undefined,
    sunObstruction: item.id === "land_aspect" ? normSunObstruction(raw.sun_obstruction) : undefined,
    accessType: item.id === "land_frontage" ? normAccessType(raw.access_type) : undefined,
    homesOnAccess: item.id === "land_frontage" ? normHomesOnAccess(raw.homes_on_access) : undefined,
    renovationLink: Boolean(raw.renovation_link),
    // The model is the source of truth for Healthy-Homes relevance; the AI hint adds to it.
    healthyHomesLink: item.affectsHealthyHomes || Boolean(raw.healthy_homes_link),
    photoReferences: normPhotoRefs(raw.photo_references),
    ...sourcedFields(raw, item),
  };
}

function placeholderSubItem(item: ScoringSubItem, hadPhotos: boolean, ctx: SubItemContext): SubItem {
  return {
    id: item.id,
    name: item.label,
    material: "Not visible in photos",
    // No spec tier here, so the bracket comes from the build era alone.
    estimatedAge: ageBracket(undefined, undefined, ctx.buildYear),
    condition: "Not assessed — inspection recommended",
    score: null,
    urgencyLabel: urgencyLabel(null),
    confidenceTier: 3,
    evidenceSource: hadPhotos ? "Not visible in listing photos" : "No photos available",
    aiSummary:
      "This item could not be assessed from the available listing information and is flagged as a Tier 3 inspection item. Confirm its condition with a registered building inspector before making an offer.",
    estimatedReplacementCost: null,
    replacementCostWeight: 0,
    renovationLink: false,
    healthyHomesLink: item.affectsHealthyHomes,
    photoReferences: [],
    ...(SOURCE_TAXONOMY[item.id]
      ? {
          finding: "Not assessed — not visible in the listing",
          source: SOURCE_TAXONOMY[item.id].source,
          sourceType: SOURCE_TAXONOMY[item.id].sourceType,
          verifyAgainst: SOURCE_TAXONOMY[item.id].verifyAgainst,
          remediation: null,
        }
      : {}),
  };
}

// ── raw → Assessment (persona-independent) ──────────────────────────────────

function buildContext(raw: RawAnalysis, listing: ScrapedListing, subItems: SubItem[]): PropertyContext {
  const rc = raw.property_context ?? {};
  const listingTitle = mapTitle(listing.titleType);
  const titleType =
    rc.title_type && rc.title_type !== "unknown" ? rc.title_type : listingTitle;
  const has = (id: string) => subItems.some((s) => s.id === id);

  // Keep context consistent with which conditional items the AI actually scored,
  // so the engine includes exactly those in the denominator.
  return {
    titleType,
    hasChimney: Boolean(rc.has_chimney) || has("ext_chimney"),
    hasSolar: Boolean(rc.has_solar) || has("ext_solar"),
    hasRetainingWalls: Boolean(rc.has_retaining_walls) || has("out_retaining"),
    hasPool: Boolean(rc.has_pool) || has("out_pool"),
    hasBodyCorporate: Boolean(rc.has_body_corporate) || has("leg_bodycorp") || titleType === "unit_title",
  };
}

function buildAssessment(
  raw: RawAnalysis,
  listing: ScrapedListing,
  hadPhotos: boolean,
  inspections?: Inspection[]
): Assessment {
  const byId = new Map<string, RawSubItem>();
  for (const s of raw.sub_items ?? []) {
    if (s && typeof s.id === "string") byId.set(s.id, s);
  }

  const items = inspections
    ? SCORING_MODEL.filter((i) => inspections.includes(i.inspection))
    : SCORING_MODEL;

  const ctx: SubItemContext = {
    buildYear: listing.buildYear,
    floorAreaSqm: listing.floorAreaSqm,
    bedrooms: listing.bedrooms,
  };
  const subItems: SubItem[] = [];
  for (const item of items) {
    const found = byId.get(item.id);
    if (found && found.present !== false) {
      subItems.push(mapSubItem(found, item, ctx));
    } else if (!item.conditional) {
      // core item the model didn't (or couldn't) assess → Tier 3 placeholder
      subItems.push(placeholderSubItem(item, hadPhotos, ctx));
    }
    // conditional + absent → omit entirely (drops out of the denominator)
  }

  const extraDwellings: ExtraDwelling[] = (raw.extra_dwellings ?? []).map((d, i) => ({
    id: `ed_${i + 1}`,
    type: d.type?.trim() || "Extra structure",
    sizeEstimate: d.size_estimate?.trim() || "Unknown",
    construction: d.construction?.trim() || "Unknown",
    condition: d.condition?.trim() || "See assessment",
    score: clampScore(d.score) ?? (5 as UrgencyScore),
    estimatedReplacementCost:
      normCost(d.replacement_cost) ?? { low: 0, high: 0, notes: "Replacement cost not estimated" },
    consentStatus: d.consent_status ?? "unknown",
    structureType: normStructureType(d.structure_type),
    habitable: Boolean(d.habitable),
    sizeSqm: typeof d.size_sqm === "number" && d.size_sqm > 0 ? d.size_sqm : undefined,
    bedrooms: Number.isInteger(d.bedrooms) && (d.bedrooms as number) >= 0 ? d.bedrooms : undefined,
    selfContained: Boolean(d.self_contained),
    redFlags: (d.red_flags ?? []).map((f) => String(f).trim()).filter(Boolean),
    healthyHomes: normDwellingHH(d.healthy_homes),
    aiSummary: d.ai_summary?.trim() || "",
    photoReferences: normPhotoRefs(d.photo_references),
  }));

  const validPenaltyIds = new Set(LOCATION_PENALTIES.map((p) => p.id));
  const penalties: PenaltyInput[] = (raw.location_penalties ?? [])
    .filter((p) => p && validPenaltyIds.has(p.id))
    .map((p) => ({
      id: p.id,
      severity: Math.max(0, Math.min(10, Math.round(Number(p.severity) || 0))),
      note: p.note?.trim() || undefined,
    }))
    .filter((p) => p.severity > 0);

  const context = buildContext(raw, listing, subItems);
  return { subItems, extraDwellings, context, penalties };
}

// ── prompt assembly ────────────────────────────────────────────────────────

function fact(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return `- ${label}: ${value}`;
}

function formatFacts(listing: ScrapedListing): string {
  return [
    fact("Address", listing.address),
    fact("Suburb", listing.suburb),
    fact("Region", listing.region ?? listing.city),
    fact("Asking price", listing.askingPrice ? `$${listing.askingPrice.toLocaleString("en-NZ")}` : listing.priceText),
    fact("Bedrooms", listing.bedrooms),
    fact("Bathrooms", listing.bathrooms),
    fact("Floor area", listing.floorAreaSqm ? `${listing.floorAreaSqm} m²` : null),
    fact("Land area", listing.landAreaSqm ? `${listing.landAreaSqm} m²` : null),
    fact("Build year", listing.buildYear),
    fact("Property type", listing.propertyType !== "unknown" ? listing.propertyType : null),
    fact("Title type", listing.titleType !== "unknown" ? listing.titleType : null),
    // The public record, where we hold it. Given to the model as ESTABLISHED
    // FACT so it stops writing "confirm freehold tenure" and "check the zoning"
    // about things the report has already looked up — asking the buyer to go and
    // re-verify what is printed above the paragraph is the product failing them.
    ...publicRecordFacts(listing),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Title, rating valuation and zoning — retrieved before the analysis runs. */
function publicRecordFacts(listing: ScrapedListing): (string | null)[] {
  const t = listing.linz?.title;
  const v = listing.linz?.valuation;
  const z = listing.zoning;
  const nzd = (n: number | null | undefined) =>
    n != null ? `$${n.toLocaleString("en-NZ")}` : null;
  return [
    t?.type ? fact("Title type (LINZ record of title — CONFIRMED)", t.type) : null,
    t?.titleNo ? fact("Record of Title", t.titleNo) : null,
    t?.legalDescription ? fact("Legal description (LINZ)", t.legalDescription) : null,
    t?.estate ? fact("Estate (LINZ)", t.share ? `${t.estate} ${t.share}` : t.estate) : null,
    z?.zone ? fact("District plan zone (council — CONFIRMED)", `${z.zone} (${z.council})`) : null,
    v?.capitalValue ? fact("Rating valuation — capital value", nzd(v.capitalValue)) : null,
    v?.landValue ? fact("Rating valuation — land value", nzd(v.landValue)) : null,
    v?.improvementsValue ? fact("Rating valuation — improvements", nzd(v.improvementsValue)) : null,
    v?.floorAreaSqm ? fact("Floor area (valuation roll)", `${v.floorAreaSqm} m²`) : null,
  ];
}

function idsFor(insp: CatalogInspection, onlyIds?: Set<string>): string {
  return insp.categories
    .map((c) => {
      const items = c.items
        .filter((s) => !onlyIds || onlyIds.has(s.id))
        .map((s) => `${s.id}${s.conditional ? " (only if present)" : ""}`)
        .join(", ");
      return items ? `  ${c.category}: ${items}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

const INSPECTION_HOWTO: Record<Inspection, string> = {
  improvements: "assess from the photos",
  location: "assess from the address/suburb and your NZ location knowledge (not photos)",
  land: "assess from the region, location, and stated land facts",
  legal: "assess from the title type, build era, and listing facts",
};

function checklistText(inspections?: Inspection[], onlyIds?: Set<string>): string {
  return buildCatalog()
    .filter((insp) => !inspections || inspections.includes(insp.inspection))
    .map((insp) => ({ insp, ids: idsFor(insp, onlyIds) }))
    .filter(({ ids }) => ids !== "") // a continuation may not touch every inspection
    .map(({ insp, ids }) => `${insp.label.toUpperCase()} — ${INSPECTION_HOWTO[insp.inspection]}\n${ids}`)
    .join("\n\n");
}

function buildUserMessage(
  listing: ScrapedListing,
  photoCount: number,
  inspections?: Inspection[],
  labelled?: boolean,
  onlyIds?: Set<string>,
  landOnly?: boolean
): string {
  const facts = formatFacts(listing);
  const photoLine =
    photoCount > 0
      ? `${photoCount} listing photo(s) are attached above, numbered 1-${photoCount}.${labelled ? " Each photo is labelled with the area it shows (e.g. \"Photo 3 — Roof\") — assess the matching sub-items from the labelled photo." : ""} Cite photo numbers in your evidence_source and photo_references.`
      : `No listing photos are available. Assess Improvements items as Tier 3 from build era and location (score = null where you cannot infer a condition); still score Location, Land, and Legal from the facts.`;

  const today = new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
  return `Analyse this New Zealand residential property and call ${ANALYSIS_TOOL_NAME}.

TODAY'S DATE: ${today}. Base any growth/demand/market reasoning on the MOST RECENT data available as of today — prefer the latest REINZ/QV release and the last-12-month trend. Treat a census or market report more than ~18 months old as historical context, not the current market, and say so when you cite it.

PROPERTY DETAILS
${facts || "- (limited details available from the listing)"}

PHOTOS
${photoLine}

SUB-ITEMS TO ASSESS (use these exact ids)
${checklistText(inspections, onlyIds)}

${listing.description ? `LISTING DESCRIPTION\n${listing.description.slice(0, 2000)}\n\n` : ""}${
    onlyIds
      ? `This is the REMAINING part of an analysis that ran out of output room. Assess ONLY the ${onlyIds.size} sub-item id(s) listed above — do not repeat any others. Keep each ai_summary to two or three sentences so the whole set fits in one response. Still return property_context, extra_dwellings and information_gaps for the property as a whole.`
      : landOnly
      ? "THIS PROPERTY IS BARE LAND. There is no house on it and the photographs show an empty site — do NOT assess, score, describe or infer any building, roof, kitchen, bathroom, interior or fit-out, and do not return any sub-item outside the Land and Legal lists above. Assess the SITE from the photographs: contour and slope, how much of it is usable, shape, orientation and sun, road frontage and access, vegetation and existing planting, services at the boundary, and anything visible that would affect building on it. On the Legal side assess only what applies to a title with no dwelling — title type, easements and covenants, LIM flags and encumbrances — and leave weathertightness, body corporate and consents for structures alone unless a structure is genuinely visible. Return property_context, add any EXISTING structure (a shed, a barn) to extra_dwellings, and any unknowns to information_gaps."
      : "Assess every non-conditional sub-item across all four inspections. Include a conditional sub-item only if it is genuinely present. Return property_context, add any separate dwellings to extra_dwellings, and any unknowns to information_gaps."
  }`;
}

// ── main entry point ───────────────────────────────────────────────────────

function base64ImageContent(images: PreparedImage[], labels?: string[]): Anthropic.ContentBlockParam[] {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of images) {
    const label = labels?.[img.number - 1]; // labels align to original 1-based order
    content.push({ type: "text", text: `Photo ${img.number}${label ? ` — ${label}` : ""}:` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.media, data: img.buf.toString("base64") },
    });
  }
  return content;
}

// Sonnet 5 accepts up to 128k output tokens and this path streams, so the old
// 32000 ceiling bought nothing: a full report with photo-grounded evidence on
// every sub-item lands right around it. See runClaude for why overshooting it
// used to fail SILENTLY rather than loudly.
const MAX_OUTPUT_TOKENS = 64000;

// How many follow-up calls we will spend recovering a truncated response.
const MAX_CONTINUATIONS = 2;

/**
 * True only when every field the report actually consumes arrived.
 *
 * This matters because the SDK assembles streamed tool JSON with a PARTIAL
 * parser: when a response is cut off at max_tokens the tool_use block still
 * parses, but the trailing sub-item is missing fields and every sub-item after
 * it is missing entirely. Nothing throws. `buildAssessment` then turns each
 * absent id into a Tier-3 `placeholderSubItem` reading "Not visible in listing
 * photos" — so a truncated response looks to the user exactly like a report
 * where the photos were never used.
 */
function isCompleteSubItem(s: RawSubItem | undefined | null): boolean {
  return (
    !!s &&
    typeof s.id === "string" &&
    s.id !== "" &&
    typeof s.ai_summary === "string" &&
    s.ai_summary.trim() !== "" &&
    typeof s.confidence_tier === "number"
  );
}

/** Fold a continuation response into the accumulating analysis. */
function mergeAnalysis(into: RawAnalysis, next: RawAnalysis, seen: Set<string>): void {
  for (const s of next.sub_items ?? []) {
    if (!isCompleteSubItem(s) || seen.has(s.id)) continue;
    seen.add(s.id);
    into.sub_items.push(s);
  }
  // Whole-property fields are emitted AFTER sub_items, so a truncated first call
  // has none of them — take them from whichever response actually carried them.
  into.property_context ??= next.property_context;
  into.extra_dwellings ??= next.extra_dwellings;
  into.information_gaps ??= next.information_gaps;
  into.location_penalties ??= next.location_penalties;
}

async function callAnalysis(
  client: Anthropic,
  listing: ScrapedListing,
  images: PreparedImage[],
  inspections?: Inspection[],
  photoLabels?: string[],
  onlyIds?: Set<string>,
  landOnly?: boolean
): Promise<{ raw: RawAnalysis; truncated: boolean }> {
  const content: Anthropic.ContentBlockParam[] = [
    ...base64ImageContent(images, photoLabels),
    { type: "text", text: buildUserMessage(listing, images.length, inspections, !!photoLabels?.length, onlyIds, landOnly) },
  ];

  // Stream and assemble the final message. A full report at this max_tokens
  // would exceed the SDK's 10-minute non-streaming guard on a slow (Tier-1)
  // key, so we must stream — `.finalMessage()` returns the assembled result.
  const resp = await client.messages
    .stream({
      model: VISION_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Sonnet 5 runs adaptive thinking by default — disable it for this forced-
      // tool-choice extraction: the task is guided structured output, not open-ended
      // reasoning, so thinking only adds latency + input-token pressure (which the
      // Tier-1 30k ITPM cap is sensitive to). Keeps behaviour equivalent to 4.6.
      thinking: { type: "disabled" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: "tool", name: ANALYSIS_TOOL_NAME },
      messages: [{ role: "user", content }],
    })
    .finalMessage();

  const toolUse = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === ANALYSIS_TOOL_NAME
  );
  if (!toolUse) {
    throw new Error("Claude did not return a structured analysis (no tool_use block)");
  }
  const raw = toolUse.input as RawAnalysis;
  raw.sub_items ??= [];
  return { raw, truncated: resp.stop_reason === "max_tokens" };
}

/**
 * One full analysis, recovering from output truncation.
 *
 * A response cut off at max_tokens loses the tail of `sub_items` silently (see
 * isCompleteSubItem), so we detect `stop_reason === "max_tokens"` and re-ask for
 * exactly the ids that never arrived, merging each continuation into the result.
 */
async function runClaude(
  listing: ScrapedListing,
  images: PreparedImage[],
  inspections?: Inspection[],
  photoLabels?: string[],
  landOnly?: boolean
): Promise<RawAnalysis> {
  const client = getAnthropic();
  const requested = new Set(
    (inspections ? SCORING_MODEL.filter((i) => inspections.includes(i.inspection)) : SCORING_MODEL).map((i) => i.id)
  );

  const merged: RawAnalysis = { sub_items: [] };
  const seen = new Set<string>();
  let onlyIds: Set<string> | undefined;

  for (let attempt = 0; ; attempt++) {
    const { raw, truncated } = await callAnalysis(client, listing, images, inspections, photoLabels, onlyIds, landOnly);
    mergeAnalysis(merged, raw, seen);
    if (!truncated) break;

    // Conditional items the model deliberately skipped land in `missing` too;
    // re-asking for them is harmless — they stay marked "(only if present)".
    const missing = [...requested].filter((id) => !seen.has(id));
    console.warn(
      `[analyze] output truncated at max_tokens — ${seen.size}/${requested.size} sub-items complete, ${missing.length} missing`
    );
    if (missing.length === 0) break;
    if (attempt >= MAX_CONTINUATIONS) {
      console.warn(
        `[analyze] gave up after ${MAX_CONTINUATIONS} continuation(s); ${missing.length} sub-item(s) fall back to Tier-3 placeholders`
      );
      break;
    }
    onlyIds = new Set(missing);
  }

  return merged;
}

/**
 * Deterministic half of the pipeline: turn a raw Claude analysis into the
 * persona-independent assessment + both persona scores + gaps. Pure (no
 * network) so it can be unit-tested without spending on the API.
 */
export function assembleResult(
  raw: RawAnalysis,
  listing: ScrapedListing,
  photosAnalysed: number,
  inspections?: Inspection[]
): AnalysisResult {
  const assessment = buildAssessment(raw, listing, photosAnalysed > 0, inspections);
  const scores = scoreBoth(assessment);

  const gaps: GapFinding[] = (raw.information_gaps ?? []).map((g) => ({
    gapType: g.gap_type?.trim() || "info",
    area: g.area?.trim() || "Unknown",
    description: g.description?.trim() || "",
    includedInAgentLetter: g.in_agent_letter !== false,
    includedInLimLetter: Boolean(g.in_lim_letter),
  }));

  return {
    context: assessment.context,
    subItems: assessment.subItems,
    extraDwellings: assessment.extraDwellings,
    penalties: assessment.penalties ?? [],
    scores,
    gaps,
    photosAnalysed,
    model: VISION_MODEL,
  };
}

/**
 * Run the full photo-analysis pipeline for a scraped listing: download photos,
 * call Claude vision, then assemble + score the result.
 */
export async function analyseProperty(
  listing: ScrapedListing,
  opts?: {
    inspections?: Inspection[];
    /** Area labels aligned to listing.photoUrls order (manual upload) → into the vision prompt. */
    photoLabels?: string[];
    /** Suburb/market data already loaded by the upload flow's background prefetch. */
    prefetched?: { marketRent?: MarketRent; capitalGrowth?: CapitalGrowth; suburbValue?: SuburbValue };
    /**
     * Bare land — there is no building to assess. Restricts the analysis to the
     * Land and Legal inspections, so the model is never shown the improvements
     * checklist and any improvements item it volunteers anyway is dropped when
     * the result is assembled. Both halves matter: the prompt stops it being
     * asked for, the assembly stops it being believed.
     */
    landOnly?: boolean;
  }
): Promise<AnalysisResult> {
  const pf = opts?.prefetched;
  // Reuse prefetched suburb/market data if the upload flow already loaded it,
  // otherwise research it in parallel (non-fatal).
  const marketP: Promise<MarketResult> = pf
    ? Promise.resolve({ marketRent: pf.marketRent, capitalGrowth: pf.capitalGrowth })
    : fetchMarketData(listing).catch((e) => {
        console.warn("[market] lookup failed:", (e as Error)?.message);
        return {} as MarketResult;
      });
  const suburbP: Promise<SuburbValue | undefined> = pf
    ? Promise.resolve(pf.suburbValue)
    : fetchSuburbValue(listing).catch((e) => {
        console.warn("[suburb-value] lookup failed:", (e as Error)?.message);
        return undefined;
      });
  const images = await prepareImages(listing.photoUrls ?? []);
  // A section has no improvements to inspect. Narrowing here means the checklist,
  // the closing instruction and the assembled result all agree.
  const inspections: Inspection[] | undefined = opts?.landOnly
    ? ["land", "legal"]
    : opts?.inspections;
  const raw = await runClaude(listing, images, inspections, opts?.photoLabels, opts?.landOnly);
  const result = assembleResult(raw, listing, images.length, inspections);
  const market = await marketP;
  const suburbValue = await suburbP;
  return { ...result, marketRent: market.marketRent, capitalGrowth: market.capitalGrowth, suburbValue };
}

// ── Fast path: Files-API upload + parallel per-inspection fan-out ─────────────
// Generating all 84 detailed summaries in one serial call is slow. Splitting the
// work across one call per inspection — all reading a shared, cached image prefix
// uploaded once via the Files API — brings wall-clock down to roughly the slowest
// single inspection and is more focused per item.

const FILES_BETA = "files-api-2025-04-14";

interface UploadedImage {
  number: number;
  fileId: string;
}

async function uploadImages(client: Anthropic, images: PreparedImage[]): Promise<UploadedImage[]> {
  return Promise.all(
    images.map(async (img) => {
      const ext = img.media.split("/")[1] || "jpg";
      const uploaded = await client.beta.files.upload({
        file: await toFile(img.buf, `photo-${img.number}.${ext}`, { type: img.media }),
        betas: [FILES_BETA],
      });
      return { number: img.number, fileId: uploaded.id };
    })
  );
}

function fileImageContent(uploaded: UploadedImage[]): Anthropic.Beta.BetaContentBlockParam[] {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  uploaded.forEach((u, idx) => {
    content.push({ type: "text", text: `Photo ${u.number}:` });
    const img: Anthropic.Beta.BetaImageBlockParam = {
      type: "image",
      source: { type: "file", file_id: u.fileId },
    };
    // Cache the whole image prefix (system + images) at the last image block so
    // the meta call warms it and the inspection calls read it.
    if (idx === uploaded.length - 1) img.cache_control = { type: "ephemeral" };
    content.push(img);
  });
  return content;
}

async function runFanCall(
  client: Anthropic,
  imageContent: Anthropic.Beta.BetaContentBlockParam[],
  instruction: string
): Promise<RawAnalysis> {
  const resp = await client.beta.messages.create({
    model: VISION_MODEL,
    max_tokens: 8000,
    betas: [FILES_BETA],
    // Disable adaptive thinking (Sonnet 5 default-on) for the forced-tool extraction — see the single-call path.
    thinking: { type: "disabled" },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [ANALYSIS_TOOL as unknown as Anthropic.Beta.BetaToolUnion],
    tool_choice: { type: "tool", name: ANALYSIS_TOOL_NAME },
    messages: [{ role: "user", content: [...imageContent, { type: "text", text: instruction }] }],
  });
  if (resp.stop_reason === "max_tokens") {
    // Same silent-truncation trap as the single-call path, minus the recovery:
    // this fan-out path is opt-in (ANALYZE_FANOUT) and never used by the photo
    // upload flow, so for now we only make the loss visible in the logs.
    console.warn(`[analyze:fanout] output truncated at max_tokens (${resp.usage?.output_tokens} tokens) — sub-items will be dropped`);
  }
  const tu = resp.content.find(
    (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === ANALYSIS_TOOL_NAME
  );
  return tu ? (tu.input as RawAnalysis) : { sub_items: [] };
}

function inspectionInstruction(listing: ScrapedListing, insp: CatalogInspection, photoCount: number): string {
  const photoLine =
    photoCount > 0
      ? `${photoCount} photos are attached above, numbered 1-${photoCount}. Cite photo numbers in evidence_source and photo_references where relevant.`
      : `No photos available — ${INSPECTION_HOWTO[insp.inspection]}, score null only where you genuinely cannot infer condition.`;
  return `Assess ONLY the "${insp.label}" inspection for this New Zealand property, and call ${ANALYSIS_TOOL_NAME} with just these sub-items (${INSPECTION_HOWTO[insp.inspection]}).

PROPERTY DETAILS
${formatFacts(listing) || "- (limited details available)"}

PHOTOS
${photoLine}

SUB-ITEMS TO ASSESS (use these exact ids, and ONLY these):
${idsFor(insp)}

Return sub_items only; leave extra_dwellings, information_gaps, and property_context empty — those are handled separately. Assess every non-conditional sub-item; include a conditional sub-item only if it is genuinely present.`;
}

function metaInstruction(listing: ScrapedListing, photoCount: number): string {
  return `For this New Zealand property, call ${ANALYSIS_TOOL_NAME} but return sub_items as an EMPTY array. Populate ONLY:
- property_context: title_type, has_chimney, has_solar, has_retaining_walls, has_pool, has_body_corporate (infer from photos + facts).
- extra_dwellings: any separate sleepout, minor dwelling, pole shed, or standalone garage of material value (with replacement_cost and a 1-10 condition score).
- location_penalties: objective location NEGATIVES for THIS exact address (busy road/motorway, flight path, rail, industry, pylons, no sun), each with a severity 0-10 scaled by proximity. Include only those that genuinely apply; omit the rest.
- information_gaps: material facts that cannot be determined from the listing or photos.

PROPERTY DETAILS
${formatFacts(listing) || "- (limited details available)"}

${photoCount} photos are attached above, numbered 1-${photoCount}.`;
}

/**
 * Fast full report: upload photos once, then fan out one parallel call per
 * inspection over a shared cached image prefix.
 */
export async function analysePropertyFast(listing: ScrapedListing): Promise<AnalysisResult> {
  // Research market rent + capital growth in parallel — non-fatal. Merged into
  // whichever result path returns below.
  const marketP = fetchMarketData(listing).catch((e) => {
    console.warn("[market] lookup failed:", (e as Error)?.message);
    return {} as MarketResult;
  });
  const suburbP = fetchSuburbValue(listing).catch((e) => {
    console.warn("[suburb-value] lookup failed:", (e as Error)?.message);
    return undefined;
  });
  const finish = async (result: AnalysisResult): Promise<AnalysisResult> => {
    const market = await marketP;
    const suburbValue = await suburbP;
    return { ...result, marketRent: market.marketRent, capitalGrowth: market.capitalGrowth, suburbValue };
  };

  const images = await prepareImages(listing.photoUrls ?? []);

  // No photos → the single serial call is already fast (everything is Tier 3 /
  // fact-based).
  if (images.length === 0) {
    const raw = await runClaude(listing, images);
    return finish(assembleResult(raw, listing, 0));
  }

  const client = getAnthropic();

  // 1. Upload each downscaled photo once (avoids re-uploading per fan-out call).
  //    If the Files API is unavailable/overloaded, fall back to the single
  //    base64 call so a transient outage never hard-fails the report.
  let uploaded: UploadedImage[];
  try {
    uploaded = await uploadImages(client, images);
  } catch (err) {
    console.warn("[analyze] Files API unavailable — falling back to single call:", (err as Error)?.message);
    const raw = await runClaude(listing, images);
    return finish(assembleResult(raw, listing, images.length));
  }
  const imageContent = fileImageContent(uploaded);

  // 2. Meta/prime pass — finds whole-property context/items and warms the cache.
  let meta: RawAnalysis = { sub_items: [] };
  try {
    meta = await runFanCall(client, imageContent, metaInstruction(listing, images.length));
  } catch {
    /* non-fatal — proceed without context / extra dwellings / gaps */
  }

  // 3. Fan out one call per inspection, in parallel (each reads the primed cache).
  const perInspection = await Promise.all(
    buildCatalog().map((insp) =>
      runFanCall(client, imageContent, inspectionInstruction(listing, insp, images.length))
        .then((r) => r.sub_items ?? [])
        .catch(() => [] as RawSubItem[])
    )
  );

  const raw: RawAnalysis = {
    sub_items: perInspection.flat(),
    extra_dwellings: meta.extra_dwellings ?? [],
    information_gaps: meta.information_gaps ?? [],
    property_context: meta.property_context,
    location_penalties: meta.location_penalties ?? [],
  };
  return finish(assembleResult(raw, listing, images.length));
}

// Re-export so the catalog's inspection labels are available to callers.
export { INSPECTION_META };
