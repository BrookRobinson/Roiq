import type Anthropic from "@anthropic-ai/sdk";
import { ALL_SUB_ITEM_IDS } from "@/lib/property-tab/template";

// Forced tool that constrains Claude's output to the structured shape the
// Property tab consumes. Using tool use (rather than output_config.format) keeps
// the deeply-nested arrays and optional fields flexible — validation/clamping
// happens in analyze.ts after parsing.

export interface RawReplacementCost {
  low: number;
  high: number;
  notes?: string;
}

export interface RawSubItem {
  id: string;
  present?: boolean;
  material?: string;
  estimated_age?: string;
  condition?: string;
  score: number | null;
  confidence_tier: number;
  evidence_source?: string;
  ai_summary: string;
  renovation_link?: boolean;
  healthy_homes_link?: boolean;
  photo_references?: number[];
  replacement_cost?: RawReplacementCost | null;
}

export interface RawExtraDwelling {
  type: string;
  size_estimate?: string;
  construction?: string;
  condition?: string;
  score: number;
  replacement_cost?: RawReplacementCost | null;
  consent_status?: "consented" | "unconsented" | "unknown";
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

export interface RawAnalysis {
  sub_items: RawSubItem[];
  extra_dwellings?: RawExtraDwelling[];
  information_gaps?: RawInformationGap[];
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
              enum: ALL_SUB_ITEM_IDS,
              description: "The sub-item id being assessed.",
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
            evidence_source: {
              type: "string",
              description: "e.g. 'Photos 3, 7, 9' or 'Build era inference'.",
            },
            ai_summary: {
              type: "string",
              description: "Professional paragraph per the writing standard (3-10 sentences).",
            },
            renovation_link: { type: "boolean", description: "True if work is needed within a normal hold period." },
            healthy_homes_link: { type: "boolean", description: "True if relevant to a Healthy Homes standard." },
            photo_references: {
              type: "array",
              items: { type: "integer" },
              description: "Photo numbers this assessment draws on.",
            },
            replacement_cost: replacementCostSchema,
          },
          required: ["id", "score", "confidence_tier", "ai_summary"],
        },
      },
      extra_dwellings: {
        type: "array",
        description: "Separate sleepouts, minor dwellings, pole sheds, or standalone garages of material value.",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            size_estimate: { type: "string" },
            construction: { type: "string" },
            condition: { type: "string" },
            score: { type: "integer", description: "1-10 condition score." },
            replacement_cost: replacementCostSchema,
            consent_status: { type: "string", enum: ["consented", "unconsented", "unknown"] },
            ai_summary: { type: "string" },
            photo_references: { type: "array", items: { type: "integer" } },
          },
          required: ["type", "score", "ai_summary"],
        },
      },
      information_gaps: {
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
      },
    },
    required: ["sub_items"],
  },
};
