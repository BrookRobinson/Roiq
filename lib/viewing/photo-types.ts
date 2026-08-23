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
  material: string;
  estimatedAge: string;
  specTier?: SpecTier;
  observedDefect?: string;
  summary: string;
  estimatedReplacementCost: ReplacementCost | null;
  photoCount: number;
  analysedAt: string;
  model: string;
}
