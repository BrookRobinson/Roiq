// ============================================================
// BDR Report — three-tier renovation visualiser model (v3.7)
// Maps a reno item to a visual area and, for each tier (Patch Up / Replace
// Budget / Replace High End), the gpt-image-1 prompt describing the materials.
// Patch Up keeps the EXISTING material (cleaned/painted); Budget shows budget
// replacement materials; High End shows premium materials.
// ============================================================

import type { Tier, RenoKind } from "@/lib/reno-costing/three-tier";

export type VisualKind = "cladding" | "kitchen" | "bathroom" | "decking" | "roof" | "fencing";
export const VISUAL_KINDS: VisualKind[] = ["cladding", "kitchen", "bathroom", "decking", "roof", "fencing"];
export const VISUAL_TIERS: Tier[] = ["patch", "budget", "premium"];

/** Which reno kinds have a meaningful visual; null = no visualiser. */
export function visualKindFor(kind: RenoKind): VisualKind | null {
  switch (kind) {
    case "cladding": case "exterior_paint": return "cladding";
    case "kitchen": return "kitchen";
    case "bathroom": return "bathroom";
    case "decking": return "decking";
    case "roof": return "roof";
    case "fencing": return "fencing";
    default: return null;
  }
}

export const AREA_LABEL: Record<VisualKind, string> = {
  cladding: "exterior cladding", kitchen: "kitchen", bathroom: "bathroom",
  decking: "timber deck", roof: "roof", fencing: "boundary fence",
};

export const TIER_DISPLAY: Record<Tier, { label: string; icon: string }> = {
  patch: { label: "Patch Up", icon: "🩹" },
  budget: { label: "Replace Budget", icon: "🔨" },
  premium: { label: "Replace High End", icon: "✨" },
};

// What each tier should look like, per area — the heart of the prompt.
export const TIER_LOOK: Record<VisualKind, Record<Tier, string>> = {
  cladding: {
    patch: "the SAME existing weatherboard cladding with holes and cracks filled, sanded and freshly painted a clean white — same boards, just tidy and well-maintained",
    budget: "new painted pine weatherboard cladding in fresh white, clean and straight",
    premium: "new clear cedar bevel-back weatherboard cladding with a natural oil finish, architectural quality",
  },
  kitchen: {
    patch: "the SAME kitchen with the cabinet doors freshly repainted, new handles, a new tap and a decluttered benchtop — same layout and cabinets",
    budget: "a new budget flat-pack kitchen with a laminate benchtop, simple white cabinetry and a tiled splashback",
    premium: "a premium custom kitchen with a stone benchtop, island, integrated appliances and designer cabinetry",
  },
  bathroom: {
    patch: "the SAME bathroom re-grouted and re-sealed with a new vanity and tapware, deep-cleaned and bright — same layout and tiles",
    budget: "a budget bathroom refit with an acrylic shower, new vanity, toilet and a simple tiled floor",
    premium: "a premium bathroom with a fully tiled walk-in glass shower, stone vanity, designer tapware and a heated floor",
  },
  decking: {
    patch: "the SAME timber deck sanded and re-oiled with damaged boards replaced — same deck, restored",
    budget: "a new treated pine deck, freshly oiled, clean and even",
    premium: "a new Kwila hardwood deck with a rich natural oil finish, premium quality",
  },
  roof: {
    patch: "the SAME roof re-coated and tidied with flashings re-sealed — same roof, refreshed",
    budget: "a new corrugate iron roof, clean and even",
    premium: "a new Colorsteel long-run roof with a premium colour-matched finish",
  },
  fencing: {
    patch: "the SAME fence with broken palings replaced and re-stained — same fence, tidied",
    budget: "a new timber paling fence, freshly stained",
    premium: "a new powder-coated aluminium slat fence, modern and premium",
  },
};

/** Prompt for editing the buyer's actual listing photo (gpt-image-1 image-to-image). */
export function editPromptFor(kind: VisualKind, tier: Tier): string {
  return `Edit this photo of a New Zealand house ${AREA_LABEL[kind]}. Show ${TIER_LOOK[kind][tier]}. Keep the same camera angle, building shape, surroundings and composition — change only the ${AREA_LABEL[kind]}. Photorealistic, real-estate quality, bright natural daylight. No text, no people, no watermark.`;
}

/** Prompt for generating from scratch when there is no usable photo. */
export function renderPromptFor(kind: VisualKind, tier: Tier): string {
  return `Photorealistic real-estate photo of a New Zealand house ${AREA_LABEL[kind]} showing ${TIER_LOOK[kind][tier]}. Bright natural daylight, wide angle, magazine quality. No text, no people, no watermark.`;
}

// ── Interactive material studio (pick a material + colour, then Preview) ──────

/** Edit the buyer's photo, swapping ONLY the chosen surface to the picked material + colour. */
export function materialEditPrompt(surfaceLabel: string, materialRender: string, colourRender: string): string {
  return `Edit this photo of a New Zealand home interior/exterior. Replace ONLY the ${surfaceLabel} with ${colourRender} ${materialRender}. Keep the EXACT same camera angle, room layout, furniture, walls, windows, joinery, fixtures and lighting — change nothing except the ${surfaceLabel}. Photorealistic, real-estate quality, bright natural daylight, accurate perspective and scale. No text, no people, no watermark.`;
}

/** Generate from scratch when there's no usable photo. */
export function materialRenderPrompt(surfaceLabel: string, materialRender: string, colourRender: string): string {
  return `Photorealistic real-estate photo of a New Zealand room showing a ${surfaceLabel} finished in ${colourRender} ${materialRender}, tastefully furnished, bright natural daylight, wide angle, magazine quality. No text, no people, no watermark.`;
}
