// Which items a photograph can actually settle.
//
// Improvements only. A photograph cannot tell you whether the studio was
// consented, what the title says, or how the suburb is trending — offering an
// upload against those would promise something the analysis can't deliver, and
// the checklist already points them at a document, the council or the agent.
//
// Kept here rather than in lib/ai/item-photos.ts so the browser can ask the
// question without importing the module that talks to the model.

import { ITEM_BY_ID } from "@/lib/scoring/catalog";

export function isPhotoAssessable(itemId: string): boolean {
  return ITEM_BY_ID[itemId]?.inspection === "improvements";
}
