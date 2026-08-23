// ============================================================
// Tectara — STANDALONE STRUCTURE CATALOGUE (value, never points)
//
// Every standalone structure — minor dwelling, tiny home, games room, garage,
// closed shed, open pole shed, carport, pool, spa — is valued, not scored.
//
//   added value = RCN × condition × RETENTION − compliance cost
//
// RETENTION is the piece people get wrong: cost ≠ value. You can spend $85k on a
// pool and a buyer pays you ~$34k for it. A self-contained minor dwelling returns
// almost all of its cost; a spa returns almost none (and usually leaves on a
// truck). Each type carries its own retention factor and cost basis.
//
// Cost basis is PER M² wherever the size drives the build cost — so when the
// listing states the area ("60m² pole shed") we value off the real square
// meterage rather than a generic allowance.
// ============================================================

export type StructureType =
  | "minor_dwelling"
  | "tiny_home_fixed"
  | "tiny_home_wheels"
  | "studio_office"
  | "games_room"
  | "garage"
  | "closed_shed"
  | "pole_shed"
  | "carport"
  | "garden_shed"
  | "pool_inground"
  | "pool_above"
  | "spa"
  | "other";

export interface StructureMeta {
  label: string;
  basis: "perSqm" | "fixed";
  rate: number; // $/m² (perSqm) or total $ (fixed) — replacement cost NEW
  retention: number; // fraction of depreciated cost a buyer actually pays
  typicalSqm?: number; // fallback size when the listing doesn't state one
  habitable?: boolean; // sleepable by default → Healthy Homes applies if rented
  chattel?: boolean; // NOT part of the land — only counts if included in the sale
  note?: string;
}

export const STRUCTURES: Record<StructureType, StructureMeta> = {
  minor_dwelling: { label: "Minor dwelling / self-contained sleepout", basis: "perSqm", rate: 2800, retention: 0.9, typicalSqm: 45, habitable: true },
  tiny_home_fixed: { label: "Tiny home (fixed to land)", basis: "perSqm", rate: 2400, retention: 0.85, typicalSqm: 35, habitable: true },
  tiny_home_wheels: { label: "Tiny home (on wheels)", basis: "fixed", rate: 95000, retention: 0.15, habitable: true, chattel: true, note: "On wheels — a chattel, not part of the land. Confirm it's included in the sale and whether it's fixed and consented for permanent occupation." },
  studio_office: { label: "Studio / office (lined, powered)", basis: "perSqm", rate: 1900, retention: 0.8, typicalSqm: 25 },
  games_room: { label: "Games / rumpus room", basis: "perSqm", rate: 1800, retention: 0.75, typicalSqm: 35 },
  garage: { label: "Standalone garage", basis: "perSqm", rate: 1200, retention: 0.75, typicalSqm: 36 },
  closed_shed: { label: "Closed / lockable shed", basis: "perSqm", rate: 900, retention: 0.7, typicalSqm: 40 },
  pole_shed: { label: "Open pole shed", basis: "perSqm", rate: 450, retention: 0.6, typicalSqm: 60 },
  carport: { label: "Carport", basis: "perSqm", rate: 550, retention: 0.5, typicalSqm: 20 },
  garden_shed: { label: "Garden shed", basis: "fixed", rate: 4000, retention: 0.35 },
  pool_inground: { label: "In-ground swimming pool", basis: "fixed", rate: 85000, retention: 0.4, note: "Polarising and costly to run (~$2–3k/yr). Compliant fencing is a legal requirement." },
  pool_above: { label: "Above-ground pool", basis: "fixed", rate: 12000, retention: 0.2, chattel: true, note: "Often semi-portable — confirm it stays." },
  spa: { label: "Spa pool", basis: "fixed", rate: 9000, retention: 0.1, chattel: true, note: "Usually a chattel — commonly leaves with the vendor." },
  other: { label: "Other structure", basis: "perSqm", rate: 900, retention: 0.6, typicalSqm: 30 },
};

/** Structures that legally require compliant fencing. */
export const POOL_TYPES: StructureType[] = ["pool_inground", "pool_above"];
export const isPool = (t: StructureType | undefined): boolean => !!t && POOL_TYPES.includes(t);

/**
 * Replacement cost NEW for a structure. Values off the stated square meterage
 * whenever we have it (from the listing description or a photo estimate), and
 * falls back to the type's typical size — or the AI's own cost estimate.
 */
export function structureRCN(
  type: StructureType | undefined,
  sizeSqm: number | null | undefined,
  aiCostMid?: number | null
): { rcn: number; basis: string } {
  const meta = STRUCTURES[type ?? "other"];
  if (meta.basis === "fixed") {
    return { rcn: meta.rate, basis: `${meta.label} — typical installed cost` };
  }
  const size = sizeSqm && sizeSqm > 0 ? sizeSqm : null;
  if (size) {
    return { rcn: Math.round(meta.rate * size), basis: `${size}m² × $${meta.rate.toLocaleString("en-NZ")}/m²` };
  }
  // No stated size — prefer the AI's own cost estimate, else the typical size.
  if (aiCostMid && aiCostMid > 0) return { rcn: aiCostMid, basis: "Estimated from the listing (size not stated)" };
  const fallback = meta.typicalSqm ?? 30;
  return { rcn: Math.round(meta.rate * fallback), basis: `~${fallback}m² typical × $${meta.rate.toLocaleString("en-NZ")}/m² (size not stated)` };
}
