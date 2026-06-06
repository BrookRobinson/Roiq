import Anthropic, { toFile } from "@anthropic-ai/sdk";

import { getAnthropic, ANALYSIS_MODEL } from "./client";
import { SYSTEM_PROMPT } from "./system-prompt";
import {
  ANALYSIS_TOOL,
  ANALYSIS_TOOL_NAME,
  type RawAnalysis,
  type RawSubItem,
  type RawReplacementCost,
} from "./tool-schema";
import { prepareImages, type PreparedImage } from "./images";

import { PROPERTY_TEMPLATE, type TemplateSubItem, type TemplateCategory } from "@/lib/property-tab/template";
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
  hadPhotos: boolean,
  categoryIds?: string[]
): { categories: Category[]; extraDwellings: ExtraDwelling[] } {
  const byId = new Map<string, RawSubItem>();
  for (const s of raw.sub_items ?? []) {
    if (s && typeof s.id === "string") byId.set(s.id, s);
  }

  const templates = categoryIds
    ? PROPERTY_TEMPLATE.filter((c) => categoryIds.includes(c.id))
    : PROPERTY_TEMPLATE;

  const categories: Category[] = [];
  for (const cat of templates) {
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
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserMessage(listing: ScrapedListing, photoCount: number, categoryIds?: string[]): string {
  const templates = categoryIds
    ? PROPERTY_TEMPLATE.filter((c) => categoryIds.includes(c.id))
    : PROPERTY_TEMPLATE;
  const facts = formatFacts(listing);

  const checklist = templates
    .map((c) => {
      const items = c.subItems
        .map((s) => `${s.id}${s.conditional ? " (only if present)" : ""}`)
        .join(", ");
      return `${c.name}: ${items}`;
    })
    .join("\n");

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

function base64ImageContent(images: PreparedImage[]): Anthropic.ContentBlockParam[] {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of images) {
    content.push({ type: "text", text: `Photo ${img.number}:` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.media, data: img.buf.toString("base64") },
    });
  }
  return content;
}

async function runClaude(
  listing: ScrapedListing,
  images: PreparedImage[],
  categoryIds?: string[]
): Promise<RawAnalysis> {
  const content: Anthropic.ContentBlockParam[] = [
    ...base64ImageContent(images),
    { type: "text", text: buildUserMessage(listing, images.length, categoryIds) },
  ];

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
  photosAnalysed: number,
  categoryIds?: string[]
): AnalysisResult {
  const region = (listing.region || listing.city || "Auckland").trim() || "Auckland";
  const { categories, extraDwellings } = buildPropertyData(raw, photosAnalysed > 0, categoryIds);
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
export async function analyseProperty(
  listing: ScrapedListing,
  opts?: { categoryIds?: string[] }
): Promise<AnalysisResult> {
  const images = await prepareImages(listing.photoUrls ?? []);
  const raw = await runClaude(listing, images, opts?.categoryIds);
  return assembleResult(raw, listing, images.length, opts?.categoryIds);
}

// ── Fast path: Files-API upload + parallel per-category fan-out ───────────────
// Generating 31 detailed summaries in one serial call is ~200s. Splitting the
// work across one call per category — all reading a shared, cached image prefix
// uploaded once via the Files API — brings wall-clock down to roughly the
// slowest single category (~40-60s) and is more focused per item.

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
    // the meta call warms it and the category calls read it.
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
    model: ANALYSIS_MODEL,
    max_tokens: 8000,
    betas: [FILES_BETA],
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [ANALYSIS_TOOL as unknown as Anthropic.Beta.BetaToolUnion],
    tool_choice: { type: "tool", name: ANALYSIS_TOOL_NAME },
    messages: [{ role: "user", content: [...imageContent, { type: "text", text: instruction }] }],
  });
  const tu = resp.content.find(
    (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === ANALYSIS_TOOL_NAME
  );
  return tu ? (tu.input as RawAnalysis) : { sub_items: [] };
}

function categoryInstruction(listing: ScrapedListing, cat: TemplateCategory, photoCount: number): string {
  const ids = cat.subItems.map((s) => `${s.id}${s.conditional ? " (only if present)" : ""}`).join(", ");
  const photoLine =
    photoCount > 0
      ? `${photoCount} photos are attached above, numbered 1-${photoCount}. Cite photo numbers in evidence_source and photo_references.`
      : `No photos available — assess from build era and location as Tier 3, score null where you cannot infer condition.`;
  return `Assess ONLY the "${cat.name}" category for this New Zealand property, and call ${ANALYSIS_TOOL_NAME} with just these sub-items.

PROPERTY DETAILS
${formatFacts(listing) || "- (limited details available)"}

PHOTOS
${photoLine}

SUB-ITEMS TO ASSESS (use these exact ids, and ONLY these):
${ids}

Return extra_dwellings and information_gaps as empty arrays — those are handled separately. Assess every non-conditional sub-item; include a conditional sub-item only if it is genuinely present.`;
}

function metaInstruction(listing: ScrapedListing, photoCount: number): string {
  return `For this New Zealand property, call ${ANALYSIS_TOOL_NAME} but return sub_items as an EMPTY array. Populate ONLY:
- extra_dwellings: any separate sleepout, minor dwelling, pole shed, or standalone garage of material value (with replacement_cost and a 1-10 condition score).
- information_gaps: material facts that cannot be determined from the listing or photos.

PROPERTY DETAILS
${formatFacts(listing) || "- (limited details available)"}

${photoCount} photos are attached above, numbered 1-${photoCount}.`;
}

/**
 * Fast full report: upload photos once, then fan out one parallel call per
 * category over a shared cached image prefix. ~40-60s instead of ~200s serial.
 */
export async function analysePropertyFast(listing: ScrapedListing): Promise<AnalysisResult> {
  const images = await prepareImages(listing.photoUrls ?? []);

  // No photos → the single serial call is already fast (everything is Tier 3).
  if (images.length === 0) {
    const raw = await runClaude(listing, images);
    return assembleResult(raw, listing, 0);
  }

  const client = getAnthropic();

  // 1. Upload each downscaled photo once (avoids re-uploading per fan-out call).
  const uploaded = await uploadImages(client, images);
  const imageContent = fileImageContent(uploaded);

  // 2. Meta/prime pass — finds whole-property items and warms the image cache.
  const meta = await runFanCall(client, imageContent, metaInstruction(listing, images.length));

  // 3. Fan out one call per category, in parallel (each reads the primed cache).
  const perCategory = await Promise.all(
    PROPERTY_TEMPLATE.map((cat) =>
      runFanCall(client, imageContent, categoryInstruction(listing, cat, images.length))
        .then((r) => r.sub_items ?? [])
        .catch(() => [] as RawSubItem[])
    )
  );

  const raw: RawAnalysis = {
    sub_items: perCategory.flat(),
    extra_dwellings: meta.extra_dwellings ?? [],
    information_gaps: meta.information_gaps ?? [],
  };
  return assembleResult(raw, listing, images.length);
}
