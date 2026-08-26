// ============================================================
// Assess ONE item from photographs the buyer took at the property.
//
// The report reads a listing. A listing photographs a kitchen, not the piles
// under the floor, not the switchboard, not the wall behind the shower — so
// those items come back Tier 3 and, since the "score only what you can see"
// change, unscored. The viewing checklist then tells the buyer what to go and
// look at, and this is the other half of that: they point a phone at it, and
// the item gets assessed properly instead of staying a gap forever.
//
// The whole thing turns on one field. `shows_item` is the model saying whether
// the photographs actually show the thing it was asked about. A blurry shot of
// a cupboard door is not a switchboard, and returning a confident 6/10 for it
// would be worse than the gap it replaced — it would launder a guess into
// evidence and then into a letter to a vendor's agent. When shows_item is
// false, nothing is scored and the checklist line stays open.
// ============================================================

import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropic, VISION_MODEL } from "@/lib/ai/client";
import { ITEM_BY_ID } from "@/lib/scoring/catalog";
import { usesSpecTier } from "@/lib/scoring/model";
import { assessFoundation } from "@/lib/scoring/foundation";
import { urgencyLabel } from "@/lib/property-tab/types";
import type { ConfidenceTier, SpecTier, UrgencyScore, ReplacementCost } from "@/lib/property-tab/types";
import type { ItemPhotoAnalysis } from "@/lib/viewing/photo-types";
import { PRODUCT_NAME } from "@/lib/brand";

/** What comes back and gets merged over the item's original assessment. */
export type { ItemPhotoAnalysis } from "@/lib/viewing/photo-types";

export interface ItemPhotoContext {
  buildYear?: number | null;
  floorAreaSqm?: number | null;
  propertyType?: string | null;
  /** The original finding, so the model can agree with it or correct it. */
  priorSummary?: string | null;
}

/** Which items a photograph can settle — see lib/viewing/photo-assessable.ts. */
export { isPhotoAssessable } from "@/lib/viewing/photo-assessable";

// What "look at this" means per item, so the model knows what it's being shown
// and what would count as a defect. Only the items a listing routinely misses
// need their own note; the rest get the generic instruction.
const WHAT_THE_PHOTO_SHOULD_SHOW: Record<string, string> = {
  ext_foundation:
    "The subfloor, taken through the access hatch or from a vent: pile type and material, rot or splitting, sagging bearers, standing water or damp ground, and clearance between the ground and the joists. A photo of the perimeter from outside shows the foundation TYPE but not its condition.",
  liv_insulation:
    "The ceiling cavity through the manhole, or the underfloor: whether insulation is present, what type, how thick, and whether it is evenly laid or flattened, gapped or missing.",
  bath_waterproof:
    "The wet area — wall linings beside and behind the shower, the junction between wall and floor, grout and silicone, skirtings, and any lifting vinyl or staining. A membrane is never visible; you are reading the symptoms of one that has failed.",
  liv_fixtures:
    "The switchboard: ceramic rewirable fuses versus modern breakers, whether an RCD is fitted, and the general state of the board and its wiring.",
  bath_hotwater:
    "The hot water cylinder or gas califont: its label and date if legible, lagging, corrosion, and any wet tray or staining beneath it.",
  ext_roof:
    "The roof from ground level on as many sides as possible: rust, lifted or cracked sheets or tiles, moss, and the flashings around the chimney and penetrations.",
};

interface RawItemPhoto {
  shows_item: boolean;
  score: number | null;
  confidence_tier: number;
  condition?: string;
  material?: string;
  estimated_age?: string;
  spec_tier?: string;
  observed_defect?: string;
  ai_summary: string;
  replacement_cost?: { low?: number; high?: number; notes?: string };
  foundation_type?: string;
  foundation_symptoms?: string[];
  subfloor_visible?: boolean;
}

const TOOL_NAME = "submit_item_assessment";

function tool(itemId: string, label: string): Anthropic.Tool {
  const isFoundation = itemId === "ext_foundation";
  return {
    name: TOOL_NAME,
    description: `Submit your assessment of "${label}" from the attached photographs.`,
    input_schema: {
      type: "object",
      properties: {
        shows_item: {
          type: "boolean",
          description: `True ONLY if the photographs genuinely show ${label} well enough to assess it. False if they show something else, are too dark, too blurred, or too far away. Be strict — a false positive here puts a guess into a document sent to a vendor.`,
        },
        score: {
          type: ["integer", "null"],
          description:
            "1-10 CONDITION score. 1-2 = critical, failed or absent; 3-4 = poor, replace soon; 5-6 = serviceable but tired; 7-8 = good; 9-10 = as new. Null if shows_item is false.",
        },
        confidence_tier: {
          type: "integer",
          description:
            "1 = the condition is plainly visible in these photographs. 2 = probable, partly obscured. 3 = you cannot really tell. Use 1 only when you can genuinely see it.",
        },
        condition: { type: "string", description: "Short condition phrase, e.g. \"Rust through the ridge flashing\"." },
        material: { type: "string", description: "What it is made of / what type it is, as far as the photographs show." },
        estimated_age: { type: "string", description: "Approximate age or era, e.g. \"~20 years\" or \"original to the house\"." },
        spec_tier: {
          type: "string",
          enum: ["deteriorated", "dated", "modern", "luxury"],
          description: "Quality tier of the materials and finish. Omit where it doesn't apply.",
        },
        observed_defect: {
          type: "string",
          description:
            "What is ACTUALLY VISIBLE in these photographs that needs work, in specific terms. Empty if nothing is wrong. Never generic.",
        },
        ai_summary: {
          type: "string",
          description:
            "2-4 plain-English sentences for the buyer: what you can see, what it means, and — if the earlier desktop finding is quoted to you — whether these photographs confirm or correct it.",
        },
        replacement_cost: {
          type: "object",
          properties: {
            low: { type: "number" },
            high: { type: "number" },
            notes: { type: "string" },
          },
          description: "Indicative NZD range to replace or remedy, if work is needed. Omit if none is.",
        },
        ...(isFoundation
          ? {
              foundation_type: {
                type: "string",
                enum: ["concrete_slab", "concrete_piles", "timber_piles", "mixed", "unknown"],
                description: "What the foundation actually is, from what the photographs show.",
              },
              foundation_symptoms: {
                type: "array",
                items: { type: "string" },
                description:
                  "Visible signs of movement: floors out of level, uneven gaps at doorways, openings out of square, diagonal cracking from a corner, rotten or split piles, subfloor damp.",
              },
              subfloor_visible: {
                type: "boolean",
                description: "True if a photograph genuinely shows under the floor.",
              },
            }
          : {}),
      },
      required: ["shows_item", "score", "confidence_tier", "ai_summary"],
    },
  };
}

const SYSTEM = `You are ${PRODUCT_NAME}'s inspection assistant. A prospective buyer has visited a New Zealand property and photographed ONE specific item that the listing photographs did not show, so that it can finally be assessed.

Rules:
- Assess ONLY the item you are asked about. Ignore everything else in the frame.
- If the photographs do not actually show that item — wrong subject, too dark, too blurred, too distant — set shows_item=false and score=null, and say so plainly. This is not a failure; it is the honest answer, and the buyer will be told to take another photo.
- Never infer condition from the building's era here. The whole point of these photographs is that somebody finally looked. If you cannot see it, say you cannot see it.
- Be specific about defects: name what is visible and where. "Below average" is useless to a buyer and worthless in a negotiation.
- Do not soften a real problem, and do not manufacture one that isn't in the frame.
Return your assessment ONLY by calling the ${TOOL_NAME} tool.`;

const clampScore = (n: unknown): UrgencyScore | null =>
  typeof n === "number" && Number.isFinite(n)
    ? (Math.min(10, Math.max(1, Math.round(n))) as UrgencyScore)
    : null;

const clampTier = (n: unknown): ConfidenceTier =>
  n === 1 || n === 2 || n === 3 ? (n as ConfidenceTier) : 2;

const SPEC_TIERS: SpecTier[] = ["deteriorated", "dated", "modern", "luxury"];
const normSpec = (v: unknown): SpecTier | undefined =>
  typeof v === "string" && SPEC_TIERS.includes(v as SpecTier) ? (v as SpecTier) : undefined;

function normCost(raw: RawItemPhoto["replacement_cost"]): ReplacementCost | null {
  if (!raw || typeof raw.low !== "number" || typeof raw.high !== "number") return null;
  const low = Math.max(0, Math.round(raw.low));
  const high = Math.max(low, Math.round(raw.high));
  if (high <= 0) return null;
  return { low, high, notes: raw.notes?.trim() || "From your own photographs" };
}

export interface InlinePhoto {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export async function analyseItemPhotos(
  itemId: string,
  photos: InlinePhoto[],
  ctx: ItemPhotoContext = {}
): Promise<ItemPhotoAnalysis> {
  const item = ITEM_BY_ID[itemId];
  if (!item) throw new Error(`Unknown item ${itemId}`);

  const facts = [
    ctx.buildYear ? `Built c.${ctx.buildYear}` : null,
    ctx.floorAreaSqm ? `${ctx.floorAreaSqm}m² floor area` : null,
    ctx.propertyType && ctx.propertyType !== "unknown" ? ctx.propertyType : null,
  ].filter(Boolean);

  const content: Anthropic.ContentBlockParam[] = photos.map((p) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: p.mediaType, data: p.base64 },
  }));

  content.push({
    type: "text",
    text: [
      `Assess this one item: **${item.label}** (${item.category}).`,
      WHAT_THE_PHOTO_SHOULD_SHOW[itemId]
        ? `What these photographs should be showing: ${WHAT_THE_PHOTO_SHOULD_SHOW[itemId]}`
        : `Assess its condition, materials and age from what is visible.`,
      facts.length ? `Property facts: ${facts.join(" · ")}.` : null,
      ctx.priorSummary
        ? `The earlier desktop analysis, made without a photograph of this item, said: "${ctx.priorSummary}" Say in your summary whether these photographs confirm or correct that.`
        : null,
      `${photos.length} photograph${photos.length === 1 ? "" : "s"} attached. Call ${TOOL_NAME}.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const client = getAnthropic();
  const resp = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    tools: [tool(itemId, item.label)],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content }],
  });

  const call = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME
  );
  if (!call) throw new Error(`${PRODUCT_NAME} did not return an assessment.`);
  const raw = call.input as RawItemPhoto;

  const showsItem = Boolean(raw.shows_item);

  // The foundation is derived, never taken as a number — same arrangement as the
  // main analysis. Photographs of the subfloor are exactly what it was missing.
  const foundation =
    showsItem && itemId === "ext_foundation"
      ? assessFoundation({
          type: (raw.foundation_type as never) ?? "unknown",
          buildYear: ctx.buildYear ?? null,
          symptoms: (raw.foundation_symptoms ?? []) as never,
          subfloorVisible: Boolean(raw.subfloor_visible),
        })
      : null;

  const score = !showsItem ? null : foundation ? (foundation.score as UrgencyScore) : clampScore(raw.score);

  return {
    itemId,
    showsItem,
    score,
    confidenceTier: foundation ? foundation.confidenceTier : clampTier(raw.confidence_tier),
    condition: raw.condition?.trim() || (showsItem ? urgencyLabel(score) : "Not shown in these photos"),
    material: raw.material?.trim() || "Not specified",
    estimatedAge: raw.estimated_age?.trim() || "—",
    specTier: usesSpecTier(item) ? normSpec(raw.spec_tier) : undefined,
    observedDefect: raw.observed_defect?.trim() || undefined,
    summary: foundation
      ? [foundation.rationale, raw.ai_summary?.trim()].filter(Boolean).join(" ")
      : raw.ai_summary?.trim() || "",
    estimatedReplacementCost: item.costBearing && showsItem ? normCost(raw.replacement_cost) : null,
    photoCount: photos.length,
    analysedAt: new Date().toISOString(),
    model: VISION_MODEL,
  };
}
