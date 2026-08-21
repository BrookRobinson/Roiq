// ============================================================
// BDR Report — EXTRA DWELLING VALUE (no points, value only)
//
// A second dwelling is NOT scored. Whether you want a cabin in the back yard is
// subjective, and ~99% of properties don't have one — folding it into the score
// would make properties incomparable and drag every normal house down. So the
// Condition & Quality Score stays a clean /1000 for every property, and the
// extra dwelling contributes the one thing that IS objective: value.
//
//   depreciated value = replacement cost new × condition factor
//   added value       = depreciated value − cost to make it compliant
//
// Condition is assessed the same way the house is; the compliance deduction is
// the real cost of getting it consented + up to Healthy Homes (see
// dwellingComplianceWork), because that's what a buyer would knock off.
// ============================================================

import type { ExtraDwelling } from "@/lib/property-tab/types";
import { HH_STANDARDS } from "./healthy-homes";
import { STRUCTURES, structureRCN, isPool } from "./structures";

/** 1–10 condition → how much of the replacement cost survives. Matches the
 * improvement valuation's depreciation curve so the two read consistently. */
export function dwellingConditionFactor(score: number | null): number {
  const s = Math.max(0, Math.min(10, score ?? 5));
  return Math.round((0.3 + 0.07 * s) * 100) / 100;
}

// ── Compliance remediation → a Renovations-tab line the buyer can opt into ────

export interface DwellingComplianceWork {
  needed: boolean;
  low: number;
  high: number;
  scope: string[]; // what the work covers
}

/** Cost of getting a habitable extra dwelling consented + up to Healthy Homes. */
export function dwellingComplianceWork(d: ExtraDwelling): DwellingComplianceWork {
  const scope: string[] = [];
  let low = 0;
  let high = 0;

  // Pools: compliant fencing is a legal requirement under the Building Act.
  if (isPool(d.structureType)) {
    if (d.consentStatus !== "consented") {
      scope.push("Compliant pool fencing / barrier certification");
      low += 3500;
      high += 9000;
    }
    return { needed: scope.length > 0, low, high, scope };
  }

  if (!d.habitable) return { needed: false, low: 0, high: 0, scope };

  if (d.consentStatus !== "consented") {
    low += 4000;
    high += 12000;
    scope.push("Certificate of Acceptance / consent regularisation");
  }
  for (const h of d.healthyHomes ?? []) {
    if (h.status !== "absent") continue;
    const std = HH_STANDARDS.find((s) => s.key === `hh_${h.standard}`);
    if (!std) continue;
    low += std.remediation.low;
    high += std.remediation.high;
    scope.push(std.label);
  }
  return { needed: scope.length > 0, low, high, scope };
}

// ── Value ─────────────────────────────────────────────────────────────────────

export interface DwellingValue {
  id: string;
  type: string;
  replacementNew: number; // replacement cost new (per-m² off the stated size where possible)
  costBasis: string; // how the RCN was derived, e.g. "60m² × $450/m²"
  conditionFactor: number; // depreciation from condition
  depreciated: number; // replacementNew × conditionFactor
  retention: number; // fraction of depreciated cost a buyer actually pays
  complianceCost: number; // mid cost to make it legally compliant (0 if none needed)
  addedValue: number; // what it actually adds
  chattel: boolean; // not part of the land — only counts if included in the sale
  note?: string; // type-specific caveat (chattel, pool running costs…)
}

export interface ExtraDwellingValueResult {
  dwellings: DwellingValue[];
  addedValue: number; // total added to the property value
}

const mid = (low: number, high: number) => Math.round((low + high) / 2);

/** Value every standalone structure: RCN × condition × retention, less compliance. */
export function valueExtraDwellings(dwellings: ExtraDwelling[]): ExtraDwellingValueResult {
  const out: DwellingValue[] = dwellings.map((d) => {
    const meta = STRUCTURES[d.structureType ?? "other"];
    const aiMid = d.estimatedReplacementCost ? mid(d.estimatedReplacementCost.low, d.estimatedReplacementCost.high) : null;
    const { rcn, basis } = structureRCN(d.structureType, d.sizeSqm, aiMid);
    const cf = dwellingConditionFactor(d.score);
    const depreciated = Math.round(rcn * cf);
    const work = dwellingComplianceWork(d);
    const complianceCost = work.needed ? mid(work.low, work.high) : 0;
    return {
      id: d.id,
      type: d.type,
      replacementNew: rcn,
      costBasis: basis,
      conditionFactor: cf,
      depreciated,
      retention: meta.retention,
      complianceCost,
      addedValue: Math.max(0, Math.round(depreciated * meta.retention) - complianceCost),
      chattel: Boolean(meta.chattel),
      note: meta.note,
    };
  });
  return { dwellings: out, addedValue: out.reduce((s, d) => s + d.addedValue, 0) };
}
