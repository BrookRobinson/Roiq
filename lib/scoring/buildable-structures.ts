// ============================================================
// What you could put on this section, what it costs, and where the rules let
// you put it.
//
// The Land tab could already say whether a 70m² minor dwelling fits. That is one
// structure out of a dozen a buyer actually considers, and it is the largest and
// hardest of them — a section with no room for a granny flat very often has room
// for a double garage, and plenty of room for a woodshed.
//
// ── The setback is NOT one number ───────────────────────────────────────────
//
// This is the part that has to be right, because it decides where the footprint
// may be dragged. THREE regimes apply, by what the structure IS and how big:
//
//   ≤10m² accessory      no setback at all. Schedule 1 of the Building Act, as
//                        amended 23 October 2025, removed it — a garden shed may
//                        go to the boundary without consent.
//   10–30m² accessory    1m from the boundary or another building. Same
//                        amendment; it used to be "no closer than its own
//                        height", which is why older guidance disagrees.
//   minor dwelling       2m from boundaries AND other buildings, 70m² ceiling,
//                        50% site coverage. NES-DMRU, in force 15 January 2026.
//
// Over 30m² and not a minor dwelling, no exemption applies and the district plan
// governs — which this codebase has never read. Those sizes are offered with
// consent stated as required and the 1m margin used only as a drawing guide.
//
// ── The other conditions, which we state rather than test ───────────────────
//
// The Schedule 1 exemption also requires single storey, no more than 3.5m above
// floor level, a floor no more than 1m above the ground, no plumbing or drinking
// water storage, and — for sleeping — a connection to the existing dwelling with
// no cooking facilities. None of those are geometry, so none are checked here.
// They are printed, because a footprint that "fits" is not the same as one that
// is exempt.
// ============================================================

import { STRUCTURES, type StructureType } from "./structures";

/** Which rule set decides the setback for a given structure and size. */
export type ConsentRegime =
  /** Schedule 1, ≤10m² accessory — no setback, no building consent. */
  | "exempt-no-setback"
  /** Schedule 1, 10–30m² accessory — 1m from boundaries and buildings. */
  | "exempt-1m"
  /** NES-DMRU — a self-contained dwelling. 2m, 70m², 50% coverage. */
  | "minor-dwelling"
  /** Over the exemption. The district plan governs and we haven't read it. */
  | "consent-required";

export interface BuildableStructure {
  id: string;
  label: string;
  /** Maps onto the valuation catalogue, so build cost and resale value agree. */
  type: StructureType;
  /**
   * Fixed cost before a square metre is added — a slab, delivery, the trades
   * turning up. Pricing small structures purely per m² understates them badly:
   * a 5m² woodshed is not a fifteenth of a 75m² one.
   */
  baseCost: number;
  perSqm: number;
  minSqm: number;
  maxSqm: number;
  defaultSqm: number;
  /** Typical proportions, so the drawn footprint is shaped like the real thing. */
  ratio: number;
  /** True for anything self-contained — routes to the NES rather than Schedule 1. */
  dwelling?: boolean;
  note?: string;
}

/**
 * Costs are anchored to lib/scoring/structures.ts so a structure this tab prices
 * you to BUILD and the one the report values on a neighbouring property cannot
 * drift apart. `baseCost + perSqm × typicalSqm` reproduces that module's
 * `rate × typicalSqm` within a few percent, with the fixed share pulled out so
 * small sizes stop being nonsense.
 */
export const BUILDABLE: BuildableStructure[] = [
  {
    id: "minor_dwelling",
    label: "Granny flat / minor dwelling",
    type: "minor_dwelling",
    baseCost: 25_000, perSqm: 2_250, minSqm: 20, maxSqm: 70, defaultSqm: 60, ratio: 1.5,
    dwelling: true,
    note: "Self-contained — kitchen and bathroom. Permitted up to 70m² under the NES, but it must still meet the Building Code and be consented as a building.",
  },
  {
    id: "sleepout",
    label: "Sleepout (no kitchen)",
    type: "studio_office",
    baseCost: 12_000, perSqm: 1_450, minSqm: 8, maxSqm: 30, defaultSqm: 20, ratio: 1.4,
    note: "Exempt only if it has no cooking facilities and no plumbing, and is used with the existing house.",
  },
  {
    id: "studio_office",
    label: "Studio / home office",
    type: "studio_office",
    baseCost: 11_000, perSqm: 1_450, minSqm: 8, maxSqm: 30, defaultSqm: 18, ratio: 1.3,
  },
  {
    id: "garage_single",
    label: "Single garage (one bay)",
    type: "garage",
    baseCost: 8_000, perSqm: 980, minSqm: 15, maxSqm: 24, defaultSqm: 18, ratio: 2,
  },
  {
    id: "garage_double",
    label: "Double garage (two bay)",
    type: "garage",
    baseCost: 8_000, perSqm: 980, minSqm: 30, maxSqm: 48, defaultSqm: 36, ratio: 1,
    note: "Over 30m² — no Schedule 1 exemption, so this one needs a building consent.",
  },
  {
    id: "carport",
    label: "Carport",
    type: "carport",
    baseCost: 3_000, perSqm: 420, minSqm: 12, maxSqm: 40, defaultSqm: 18, ratio: 2,
  },
  {
    id: "closed_shed",
    label: "Closed / lockable shed",
    type: "closed_shed",
    baseCost: 4_500, perSqm: 780, minSqm: 6, maxSqm: 40, defaultSqm: 15, ratio: 1.5,
  },
  {
    id: "pole_shed",
    label: "Open pole shed",
    type: "pole_shed",
    baseCost: 6_000, perSqm: 350, minSqm: 20, maxSqm: 120, defaultSqm: 60, ratio: 2,
  },
  {
    id: "wood_shed",
    label: "Wood shed",
    type: "pole_shed",
    baseCost: 600, perSqm: 300, minSqm: 2, maxSqm: 12, defaultSqm: 5, ratio: 2,
    note: "Open-fronted, timber frame on a simple base.",
  },
  {
    id: "garden_shed",
    label: "Garden shed",
    type: "garden_shed",
    baseCost: 900, perSqm: 520, minSqm: 2, maxSqm: 12, defaultSqm: 6, ratio: 1.4,
  },
  {
    id: "greenhouse",
    label: "Greenhouse",
    type: "other",
    baseCost: 800, perSqm: 450, minSqm: 3, maxSqm: 20, defaultSqm: 8, ratio: 1.8,
  },
];

export const BUILDABLE_BY_ID = new Map(BUILDABLE.map((b) => [b.id, b]));

/** Schedule 1 ceiling for a detached accessory building. */
export const SCHEDULE1_MAX_SQM = 30;
/** Below this, Schedule 1 asks for no setback at all (since 23 October 2025). */
export const SCHEDULE1_NO_SETBACK_MAX_SQM = 10;
/** NES-DMRU ceiling for a self-contained minor dwelling. */
export const NES_DWELLING_MAX_SQM = 70;

/** Which rules apply to THIS structure at THIS size. */
export function regimeFor(s: BuildableStructure, sqm: number): ConsentRegime {
  if (s.dwelling) return sqm <= NES_DWELLING_MAX_SQM ? "minor-dwelling" : "consent-required";
  if (sqm <= SCHEDULE1_NO_SETBACK_MAX_SQM) return "exempt-no-setback";
  if (sqm <= SCHEDULE1_MAX_SQM) return "exempt-1m";
  return "consent-required";
}

/** Metres this structure must stand off a boundary, and off what's already built. */
export function setbacksFor(regime: ConsentRegime): { boundary: number; building: number } {
  switch (regime) {
    case "exempt-no-setback":
      return { boundary: 0, building: 0 };
    case "exempt-1m":
      return { boundary: 1, building: 1 };
    case "minor-dwelling":
      return { boundary: 2, building: 2 };
    case "consent-required":
      // No exemption to lean on and no district plan read, so 1m is a DRAWING
      // guide and the copy says consent is needed. Pretending to know the real
      // yard here would be the invented-number problem in a new place.
      return { boundary: 1, building: 1 };
  }
}

/** One line telling the reader what they'd be committing to. */
export function regimeNote(regime: ConsentRegime, sqm: number): string {
  switch (regime) {
    case "exempt-no-setback":
      return `Under ${sqm}m² and detached — Schedule 1 of the Building Act asks for no building consent and, since 23 October 2025, no setback from the boundary at all.`;
    case "exempt-1m":
      return `${sqm}m², between 10 and 30 — no building consent under Schedule 1, provided it stays 1m off the boundary and off anything already built.`;
    case "minor-dwelling":
      return `A self-contained unit at ${sqm}m² is permitted under the NES for minor residential units: 2m off boundaries and other buildings, and total site coverage at or under 50%. It still needs a building consent as a dwelling.`;
    case "consent-required":
      return `${sqm}m² is past the Schedule 1 exemption, so this needs a building consent and the district plan's own yard rules apply — which this report doesn't read. The 1m margin drawn here is a guide, not a rule.`;
  }
}

/** Footprint in metres for a given area, at the type's usual proportions. */
export function footprintFor(s: BuildableStructure, sqm: number): { width: number; length: number } {
  const w = Math.sqrt(sqm / s.ratio);
  return { width: Math.round(w * 10) / 10, length: Math.round(w * s.ratio * 10) / 10 };
}

export interface BuildEstimate {
  low: number;
  mid: number;
  high: number;
  /** How the figure was reached, for the reader who wants to argue with it. */
  basis: string;
}

/**
 * What it costs to build, as a range.
 *
 * A point estimate on a structure nobody has quoted is false precision — the
 * same trap the valuation avoids — so this is ±18%, which is about the spread
 * between a competent local builder and a main contractor on work this size.
 */
export function estimateBuild(s: BuildableStructure, sqm: number): BuildEstimate {
  const size = Math.max(s.minSqm, Math.min(s.maxSqm, sqm));
  const mid = Math.round((s.baseCost + s.perSqm * size) / 10) * 10;
  return {
    low: Math.round((mid * 0.82) / 10) * 10,
    mid,
    high: Math.round((mid * 1.18) / 10) * 10,
    basis: `$${s.baseCost.toLocaleString("en-NZ")} base + ${size}m² × $${s.perSqm.toLocaleString("en-NZ")}/m²`,
  };
}

/**
 * What a buyer would actually get back for it if they sold.
 *
 * Cost is not value, and this codebase has said so about pools since the
 * structures catalogue was written — $85k in, about $34k back. Reusing that
 * module's retention factors means the build tab and the valuation cannot tell
 * a reader two different stories about the same shed.
 */
export function resaleOf(s: BuildableStructure, sqm: number): number {
  return Math.round(estimateBuild(s, sqm).mid * STRUCTURES[s.type].retention);
}
