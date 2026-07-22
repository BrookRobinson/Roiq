import type Anthropic from "@anthropic-ai/sdk";
import { ALL_V31_IDS } from "@/lib/scoring/catalog";
import { LOCATION_PENALTIES } from "@/lib/scoring/model";

const LOCATION_PENALTY_IDS = LOCATION_PENALTIES.map((p) => p.id);

// Forced tool that constrains Claude's output to the structured shape the
// Property tab consumes. Using tool use (rather than output_config.format) keeps
// the deeply-nested arrays and optional fields flexible — validation/clamping
// happens in analyze.ts after parsing.

export interface RawReplacementCost {
  low: number;
  high: number;
  notes?: string;
}

export interface RawRemediation {
  description: string;
  low: number;
  mid: number;
  high: number;
  urgency_years: number;
  renovation_line_item: string;
}

export interface RawSubItem {
  id: string;
  present?: boolean;
  material?: string;
  estimated_age?: string;
  condition?: string;
  score: number | null;
  confidence_tier: number;
  spec_tier?: string;
  evidence_source?: string;
  ai_summary: string;
  renovation_link?: boolean;
  healthy_homes_link?: boolean;
  photo_references?: number[];
  replacement_cost?: RawReplacementCost | null;
  // v3.2 — sourced reasoning for Location/Land/Legal items
  finding?: string;
  source?: string;
  source_type?: string;
  verify_against?: string;
  remediation?: RawRemediation | null;
}

export interface RawDwellingHealthyHomes {
  standard: string;
  status: string;
  note?: string;
}

export interface RawExtraDwelling {
  type: string;
  size_estimate?: string;
  construction?: string;
  condition?: string;
  score: number;
  replacement_cost?: RawReplacementCost | null;
  consent_status?: "consented" | "unconsented" | "unknown";
  structure_type?: string;
  habitable?: boolean;
  size_sqm?: number;
  bedrooms?: number;
  self_contained?: boolean;
  red_flags?: string[];
  healthy_homes?: RawDwellingHealthyHomes[];
  ai_summary: string;
  photo_references?: number[];
}

export interface RawInformationGap {
  gap_type: string;
  area: string;
  description: string;
  in_agent_letter?: boolean;
  in_lim_letter?: boolean;
}

export interface RawPropertyContext {
  title_type?: "freehold" | "cross_lease" | "unit_title" | "leasehold" | "unknown";
  has_chimney?: boolean;
  has_solar?: boolean;
  has_retaining_walls?: boolean;
  has_pool?: boolean;
  has_body_corporate?: boolean;
}

// v4 — objective location negatives detected for THIS address. Subtract only.
export interface RawLocationPenalty {
  id: string;
  severity: number; // 0–10
  note?: string;
}

export interface RawAnalysis {
  sub_items: RawSubItem[];
  extra_dwellings?: RawExtraDwelling[];
  information_gaps?: RawInformationGap[];
  property_context?: RawPropertyContext;
  location_penalties?: RawLocationPenalty[];
}

export const ANALYSIS_TOOL_NAME = "submit_property_analysis";

const replacementCostSchema = {
  type: ["object", "null"],
  properties: {
    low: { type: "number", description: "Low end of the ±15% range, NZD" },
    high: { type: "number", description: "High end of the ±15% range, NZD" },
    notes: { type: "string", description: "What the cost covers and any caveats" },
  },
  required: ["low", "high"],
} as const;

const remediationSchema = {
  type: ["object", "null"],
  description:
    "Include ONLY when this specific Location/Land/Legal finding is genuinely fixable (e.g. unconsented works, cross-lease defects, failing drainage/retaining). Inherent risks (flood, liquefaction, coastal, fault, school zone, title type when freehold, amenities, noise) must NOT carry a remediation.",
  properties: {
    description: { type: "string", description: "The remedy, e.g. 'Certificate of Acceptance for rear deck'" },
    low: { type: "number", description: "Low estimate, NZD" },
    mid: { type: "number", description: "Mid estimate, NZD" },
    high: { type: "number", description: "High estimate, NZD" },
    urgency_years: { type: "number", description: "Years until the work is needed, for hold-period gating" },
    renovation_line_item: { type: "string", description: "Label shown in the Renovations tab" },
  },
  required: ["description", "low", "mid", "high"],
} as const;

const extraDwellingsSchema = {
  type: "array",
  description:
    "EVERY standalone structure of material value: minor dwellings, sleepouts, tiny homes, studios, games/rumpus rooms, standalone garages, closed/lockable sheds, open pole sheds, carports, garden sheds, swimming pools and spas. Assess a HABITABLE one like a small house — it may be rented or lived in.",
  items: {
    type: "object",
    properties: {
      type: { type: "string", description: "Plain-English name as you'd describe it, e.g. 'Open pole shed'." },
      structure_type: {
        type: "string",
        enum: ["minor_dwelling", "tiny_home_fixed", "tiny_home_wheels", "studio_office", "games_room", "garage", "closed_shed", "pole_shed", "carport", "garden_shed", "pool_inground", "pool_above", "spa", "other"],
        description:
          "Classify the structure — this sets how it's valued. tiny_home_wheels ONLY when it's clearly on wheels//a towable unit (that makes it a chattel). pole_shed = open-sided implement shed; closed_shed = lockable walls + door.",
      },
      size_estimate: { type: "string" },
      construction: { type: "string" },
      condition: { type: "string" },
      score: { type: "integer", description: "1-10 condition score." },
      replacement_cost: replacementCostSchema,
      consent_status: { type: "string", enum: ["consented", "unconsented", "unknown"] },
      habitable: {
        type: "boolean",
        description:
          "TRUE if someone could sleep in it (sleepout, studio, minor dwelling, cabin). FALSE for a shed, workshop, carport or plain garage. If true it is a DWELLING and Healthy Homes applies when rented.",
      },
      size_sqm: { type: "number", description: "Floor area in m² as a NUMBER (e.g. 60). READ IT FROM THE LISTING DESCRIPTION whenever stated ('60m2 pole shed', 'large 45sqm sleepout') — the value is calculated off this. Only estimate from photos when the description doesn't say." },
      bedrooms: { type: "integer", description: "Separate bedrooms in this structure. 0 for a studio / open-plan sleepout." },
      self_contained: { type: "boolean", description: "TRUE only if it has its OWN kitchen AND bathroom, so it could be let independently." },
      red_flags: {
        type: "array",
        items: { type: "string" },
        description:
          "Material risks an investor must know, one short line each. Only genuine risks — e.g. 'Sleeping space with no consent on record — can't legally be rented until regularised', 'No visible heat source', 'Ground-level timber with no clearance — damp risk'. Omit if there are none. Do NOT list ordinary missing fittings (splashback, tapware, etc.).",
      },
      healthy_homes: {
        type: "array",
        description:
          "ONLY when habitable is true. One entry per standard, honestly reflecting what the photos actually show — most will be not_visible, and that is the correct answer. Do NOT guess.",
        items: {
          type: "object",
          properties: {
            standard: { type: "string", enum: ["heating", "insulation", "ventilation", "moisture", "draught"] },
            status: {
              type: "string",
              enum: ["met", "not_visible", "absent"],
              description:
                "met = clear visible evidence it complies (e.g. a heat pump head visible). absent = clearly not there (e.g. no heat source of any kind in a self-contained studio). not_visible = can't tell from the photos — use this whenever unsure.",
            },
            note: { type: "string", description: "Short reason, e.g. 'No heat pump or fixed heater visible'." },
          },
          required: ["standard", "status"],
        },
      },
      ai_summary: {
        type: "string",
        description:
          "A tight summary of what the photos ACTUALLY show about this structure — construction, size, apparent use, condition, and what you cannot see. 2-4 sentences. Do not speculate on interior fittings you can't see.",
      },
      photo_references: { type: "array", items: { type: "integer" } },
    },
    required: ["type", "score", "ai_summary"],
  },
} as const;

const propertyContextSchema = {
  type: "object",
  description:
    "Whole-property facts used to resolve conditional scoring items. Infer from the photos, listing facts, and description; default booleans to false and title_type to 'unknown' when genuinely undeterminable.",
  properties: {
    title_type: {
      type: "string",
      enum: ["freehold", "cross_lease", "unit_title", "leasehold", "unknown"],
      description: "Land title type, from the listing facts if stated.",
    },
    has_chimney: { type: "boolean", description: "A chimney / fireplace flue is visible or stated." },
    has_solar: { type: "boolean", description: "Solar panels are visible or stated." },
    has_retaining_walls: { type: "boolean", description: "Retaining walls are visible or on the site plan." },
    has_pool: { type: "boolean", description: "A pool or spa is present." },
    has_body_corporate: { type: "boolean", description: "An active body corporate applies (unit title, or cross-lease with one)." },
  },
  required: [],
} as const;

const locationPenaltiesSchema = {
  type: "array",
  description:
    "Objective location NEGATIVES that hurt resale for almost everyone, detected for THIS specific address. Location has NO positive score — only these penalties. Include a penalty ONLY if it genuinely applies; omit the rest. Scale severity by proximity.",
  items: {
    type: "object",
    properties: {
      id: {
        type: "string",
        enum: LOCATION_PENALTY_IDS,
        description: "Which objective negative applies.",
      },
      severity: {
        type: "integer",
        description:
          "0–10. 10 = worst case (directly on/under it), scaling down with distance. E.g. house fronting a motorway = 9–10; one street back = 4–5; 300m+ away = 0 (omit it).",
      },
      note: {
        type: "string",
        description:
          "Short reason with distance/evidence, e.g. 'fronts SH1 ~20m', 'within airport 55dB noise contour', 'south-facing gully, poor winter sun'.",
      },
    },
    required: ["id", "severity"],
  },
} as const;

const informationGapsSchema = {
  type: "array",
  description: "Material facts that could not be determined from the listing or photos.",
  items: {
    type: "object",
    properties: {
      gap_type: { type: "string", description: "e.g. 'photo', 'document', 'spec'." },
      area: { type: "string", description: "Short label, e.g. 'West wall exterior'." },
      description: { type: "string" },
      in_agent_letter: { type: "boolean" },
      in_lim_letter: { type: "boolean" },
    },
    required: ["area", "description"],
  },
} as const;

export const ANALYSIS_TOOL: Anthropic.Tool = {
  name: ANALYSIS_TOOL_NAME,
  description:
    "Submit the structured condition analysis for this property. Call this exactly once with every sub-item you were asked to assess.",
  input_schema: {
    type: "object",
    properties: {
      sub_items: {
        type: "array",
        description:
          "One entry per sub-item id provided in the user message. Omit a conditional sub-item only if it is genuinely not present in this property.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              enum: ALL_V31_IDS,
              description: "The sub-item id being assessed (RoiQ v3.1 scoring model).",
            },
            present: {
              type: "boolean",
              description: "False only if this (conditional) feature is absent from the property.",
            },
            material: { type: "string", description: "Material / construction, with the mix described if mixed." },
            estimated_age: { type: "string", description: "Estimated age or 'Unknown'." },
            condition: { type: "string", description: "One-line condition summary." },
            score: {
              type: ["integer", "null"],
              description: "1-10 urgency/condition score, or null if not assessable from photos.",
            },
            confidence_tier: {
              type: "integer",
              enum: [1, 2, 3],
              description: "1 confirmed from photo · 2 probable · 3 not visible / inferred.",
            },
            spec_tier: {
              type: "string",
              enum: ["deteriorated", "dated", "modern", "luxury"],
              description:
                "IMPROVEMENTS only — REQUIRED for every improvements item. This is the PRIMARY score driver: the tier sets a capped points band and the condition score then positions the item within it. deteriorated = the item is absent, broken, or so worn it needs full replacement regardless of its original spec (band 0–30% of the item's points); dated = present and functional but old-fashioned / an older spec (30–60%); modern = updated / contemporary look — tiling, stone or stone-look benchtops, good flooring, integrated appliances, modern fittings (60–80%); luxury = clearly high-end — natural stone, designer/architectural, imported fittings (80–100%). Judge the SPEC/era of the materials from the brand, materials and style visible in the photo (and listing description), NOT how new it looks — a tiled bathroom and a vinyl one can both be 10/10 condition but sit at different tiers. If you can't tell from the photo, infer from the build era. Rough era guide (assume it is 2026): dated = fitted pre-2014 or never renovated; modern = fitted 2014 onward; luxury = high-end materials at any age; deteriorated = broken/absent/end-of-life.",
            },
            evidence_source: {
              type: "string",
              description: "e.g. 'Photos 3, 7, 9' or 'Build era inference'.",
            },
            ai_summary: {
              type: "string",
              description:
                "Professional reasoning paragraph. For Location/Land/Legal it MUST follow: source → finding → what it means → what to verify → cost if remediable (3-6 sentences).",
            },
            renovation_link: { type: "boolean", description: "True if work is needed within a normal hold period." },
            healthy_homes_link: { type: "boolean", description: "True if relevant to a Healthy Homes standard." },
            photo_references: {
              type: "array",
              items: { type: "integer" },
              description: "Photo numbers this assessment draws on.",
            },
            replacement_cost: replacementCostSchema,
            // v3.2 — sourced reasoning (always populate for loc_*/land_*/leg_*)
            finding: {
              type: "string",
              description: "One-line status, e.g. 'Low — not in mapped flood plain' or 'Freehold — no encumbrances'.",
            },
            source: {
              type: "string",
              description: "A SPECIFIC named source — never vague. E.g. 'Auckland Council flood-hazard overlay', 'Ministry of Education enrolment zones', 'record of title', 'GNS Active Faults database', or a photo number.",
            },
            source_type: {
              type: "string",
              enum: ["photo", "council_data", "linz", "title", "lim", "gns", "market_data", "map_poi", "moe_zones", "inference"],
            },
            verify_against: {
              type: "string",
              description: "The authoritative document to confirm against, e.g. 'LIM', 'record of title', 'Ministry of Education'.",
            },
            remediation: remediationSchema,
          },
          required: ["id", "score", "confidence_tier", "ai_summary"],
        },
      },
      extra_dwellings: extraDwellingsSchema,
      information_gaps: informationGapsSchema,
      property_context: propertyContextSchema,
      location_penalties: locationPenaltiesSchema,
    },
    required: ["sub_items"],
  },
};

// Lightweight tool for the meta pass (one call that finds whole-property items
// while the per-category calls handle sub-items in parallel).
export const ANALYSIS_META_TOOL_NAME = "submit_property_meta";

export const ANALYSIS_META_TOOL: Anthropic.Tool = {
  name: ANALYSIS_META_TOOL_NAME,
  description:
    "Submit whole-property findings: title/feature context for conditional scoring, any separate dwellings/structures, and any material information gaps.",
  input_schema: {
    type: "object",
    properties: {
      property_context: propertyContextSchema,
      extra_dwellings: extraDwellingsSchema,
      information_gaps: informationGapsSchema,
      location_penalties: locationPenaltiesSchema,
    },
    required: [],
  },
};
