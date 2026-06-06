import Anthropic from "@anthropic-ai/sdk";

import { getAnthropic, ANALYSIS_MODEL } from "./client";
import { SYSTEM_PROMPT } from "./system-prompt";
import {
  ANALYSIS_TOOL,
  ANALYSIS_TOOL_NAME,
  type RawAnalysis,
  type RawSubItem,
  type RawReplacementCost,
} from "./tool-schema";
import { prepareImages } from "./images";

import { PROPERTY_TEMPLATE, type TemplateSubItem } from "@/lib/property-tab/template";
import { CATEGORY_POINTS, SUB_ITEM_POINTS, calculateScore, type ScoringResult } from "@/lib/property-tab/scoring";
import { urgencyLabel } from "@/lib/property-tab/types";
import type {
  SubItem,
  Category,
  ExtraDwelling,
  ReplacementCost,
  PropertyTabData,
  UrgencyScore,
  ConfidenceTier,
} from "@/lib/property-tab/types";
import type { ScrapedListing } from "@/lib/scraper/types";

const CATEGORY_TOTAL = Object.values(CATEGORY_POINTS).reduce((a, b) => a + b, 0); // 950 by design

export interface GapFinding {
  gapType: string;
  area: string;
  description: string;
  includedInAgentLetter: boolean;
  includedInLimLetter: boolean;
}

export interface AnalysisResult {
  data: PropertyTabData;
  score: ScoringResult;
  gaps: GapFinding[];
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

// ── raw → SubItem ──────────────────────────────────────────────────────────

function mapSubItem(raw: RawSubItem, tmpl: TemplateSubItem, weight: number): SubItem {
  const score = clampScore(raw.score);
  return {
    id: tmpl.id,
    name: tmpl.name,
    material: raw.material?.trim() || "Not specified",
    estimatedAge: raw.estimated_age?.trim() || "Unknown",
    condition: raw.condition?.trim() || "See assessment",
    score,
    urgencyLabel: urgencyLabel(score),
    confidenceTier: clampTier(raw.confidence_tier),
    evidenceSource:
      raw.evidence_source?.trim() || (score === null ? "Build era inference" : "Listing photos"),
    aiSummary: raw.ai_summary?.trim() || "",
    estimatedReplacementCost: normCost(raw.replacement_cost),
    replacementCostWeight: weight,
    renovationLink: Boolean(raw.renovation_link),
    healthyHomesLink: Boolean(raw.healthy_homes_link),
    photoReferences: normPhotoRefs(raw.photo_references),
  };
}

function placeholderSubItem(tmpl: TemplateSubItem, weight: number, hadPhotos: boolean): SubItem {
  return {
    id: tmpl.id,
    name: tmpl.name,
    material: "Not visible in photos",
    estimatedAge: "Unknown",
    condition: "Not assessed — inspection recommended",
    score: null,
    urgencyLabel: urgencyLabel(null),
    confidenceTier: 3,
    evidenceSource: hadPhotos ? "Not visible in listing photos" : "No photos available",
    aiSummary:
      "This item could not be assessed from the available listing information and is flagged as a Tier 3 inspection item. Confirm its condition with a registered building inspector before making an offer.",
    estimatedReplacementCost: null,
    replacementCostWeight: weight,
    renovationLink: false,
    healthyHomesLink: false,
    photoReferences: [],
  };
}

function buildPropertyData(
  raw: RawAnalysis,
  hadPhotos: boolean
): { categories: Category[]; extraDwellings: ExtraDwelling[] } {
  const byId = new Map<string, RawSubItem>();
  for (const s of raw.sub_items ?? []) {
    if (s && typeof s.id === "string") byId.set(s.id, s);
  }

  const categories: Category[] = [];
  for (const cat of PROPERTY_TEMPLATE) {
    const allocated = CATEGORY_POINTS[cat.id] ?? 0;
    const weight = CATEGORY_TOTAL > 0 ? allocated / CATEGORY_TOTAL : 0;
    const subItems: SubItem[] = [];

    for (const tmpl of cat.subItems) {
      const subPts = SUB_ITEM_POINTS[cat.id]?.[tmpl.id] ?? 0;
      const rcw = allocated > 0 ? subPts / allocated : 0;
      const found = byId.get(tmpl.id);

      if (found && found.present !== false) {
        subItems.push(mapSubItem(found, tmpl, rcw));
      } else if (!tmpl.conditional) {
        // core item the model didn't (or couldn't) assess → Tier 3 placeholder
        subItems.push(placeholderSubItem(tmpl, rcw, hadPhotos));
      }
      // conditional + absent → omit entirely
    }

    if (subItems.length > 0) {
      categories.push({ id: cat.id, name: cat.name, icon: cat.icon, weight, subItems });
    }
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
    aiSummary: d.ai_summary?.trim() || "",
    photoReferences: normPhotoRefs(d.photo_references),
  }));

  return { categories, extraDwellings };
}

// ── prompt assembly ────────────────────────────────────────────────────────

function fact(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return `- ${label}: ${value}`;
}

function buildUserMessage(listing: ScrapedListing, photoCount: number): string {
  const facts = [
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
  ]
    .filter(Boolean)
    .join("\n");

  const checklist = PROPERTY_TEMPLATE.map((c) => {
    const items = c.subItems
      .map((s) => `${s.id}${s.conditional ? " (only if present)" : ""}`)
      .join(", ");
    return `${c.name}: ${items}`;
  }).join("\n");

  const photoLine =
    photoCount > 0
      ? `${photoCount} listing photo(s) are attached above, numbered 1-${photoCount}. Cite photo numbers in your evidence_source and photo_references.`
      : `No listing photos are available. Assess every item as Tier 3 from build era and location, with score = null where you cannot infer a condition.`;

  return `Analyse this New Zealand residential property and call ${ANALYSIS_TOOL_NAME}.

PROPERTY DETAILS
${facts || "- (limited details available from the listing)"}

PHOTOS
${photoLine}

SUB-ITEMS TO ASSESS (use these exact ids)
${checklist}

${listing.description ? `LISTING DESCRIPTION\n${listing.description.slice(0, 2000)}\n\n` : ""}Assess every non-conditional sub-item. Include a conditional sub-item only if it is genuinely present. Add any separate dwellings to extra_dwellings and any unknowns to information_gaps.`;
}

// ── main entry point ───────────────────────────────────────────────────────

async function runClaude(listing: ScrapedListing, images: Awaited<ReturnType<typeof prepareImages>>): Promise<RawAnalysis> {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of images) {
    content.push({ type: "text", text: `Photo ${img.number}:` });
    content.push(img.block);
  }
  content.push({ type: "text", text: buildUserMessage(listing, images.length) });

  const client = getAnthropic();
  const resp = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: ANALYSIS_TOOL_NAME },
    messages: [{ role: "user", content }],
  });

  const toolUse = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === ANALYSIS_TOOL_NAME
  );
  if (!toolUse) {
    throw new Error("Claude did not return a structured analysis (no tool_use block)");
  }
  return toolUse.input as RawAnalysis;
}

/**
 * Deterministic half of the pipeline: turn a raw Claude analysis into scored
 * PropertyTabData + gaps. Pure (no network) so it can be unit-tested without
 * spending on the API.
 */
export function assembleResult(
  raw: RawAnalysis,
  listing: ScrapedListing,
  photosAnalysed: number
): AnalysisResult {
  const region = (listing.region || listing.city || "Auckland").trim() || "Auckland";
  const { categories, extraDwellings } = buildPropertyData(raw, photosAnalysed > 0);
  const score = calculateScore(categories, extraDwellings, listing.buildYear ?? null, region);

  const gaps: GapFinding[] = (raw.information_gaps ?? []).map((g) => ({
    gapType: g.gap_type?.trim() || "info",
    area: g.area?.trim() || "Unknown",
    description: g.description?.trim() || "",
    includedInAgentLetter: g.in_agent_letter !== false,
    includedInLimLetter: Boolean(g.in_lim_letter),
  }));

  return {
    data: { categories, extraDwellings, overallScore: score.totalScore },
    score,
    gaps,
    photosAnalysed,
    model: ANALYSIS_MODEL,
  };
}

/**
 * Run the full photo-analysis pipeline for a scraped listing: download photos,
 * call Claude vision, then assemble + score the result.
 */
export async function analyseProperty(listing: ScrapedListing): Promise<AnalysisResult> {
  const images = await prepareImages(listing.photoUrls ?? []);
  const raw = await runClaude(listing, images);
  return assembleResult(raw, listing, images.length);
}
