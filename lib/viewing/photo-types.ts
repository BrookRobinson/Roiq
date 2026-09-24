import type { UrgentAction } from "@/lib/scoring/depreciation";
// The shape a buyer's own photograph of one item comes back as.
//
// Lives apart from lib/ai/item-photos.ts, which is where it is produced, so
// that client code and the dependency-free status module can name the type
// without dragging the Anthropic SDK anywhere near a browser bundle.

import type { ConfidenceTier, ReplacementCost, SpecTier, UrgencyScore } from "@/lib/property-tab/types";

export interface ItemPhotoAnalysis {
  itemId: string;
  /**
   * False when the photographs don't actually show the item. Nothing is scored
   * and the checklist line stays open — a confident number read off the wrong
   * cupboard door would be worse than the gap it replaced.
   */
  showsItem: boolean;
  score: UrgencyScore | null;
  confidenceTier: ConfidenceTier;
  condition: string;
  /** Absent when the photos don't establish one — see SubItem.material. */
  material?: string;
  estimatedAge: string;
  /**
   * What was legible on a data plate, verbatim. Null when no plate was readable.
   *
   * Kept separately from `estimatedAge` because it is EVIDENCE rather than a
   * conclusion: "Rheem 135L, ser. 0923" is checkable by the person holding the
   * photograph, and "~14 years" is not.
   */
  dataPlate?: string | null;
  /** Roof only. Drives the roof AREA, so a null here is better than a guess. */
  roofPitchDegrees?: number | null;
  roofForm?: string | null;
  specTier?: SpecTier;
  observedDefect?: string;
  /** What these photographs show that set the condition and the age, each citing its photo. */
  conditionEvidence?: string[];
  /** Work needed NOW to get it back to a well-maintained state. */
  urgentAction?: UrgentAction;
  summary: string;
  estimatedReplacementCost: ReplacementCost | null;
  photoCount: number;
  analysedAt: string;
  model: string;
}
