// ============================================================
// The land, adjusted for THIS section.
//
// The starting figure is what a TYPICAL section of this size fetches in the
// suburb — valueLand() extracts it from ordinary house sales, and ordinary
// sales are of ordinary sections: some sloping, some rear lots, some facing
// south. So the base is not a perfect section, and each adjustment below is
// measured from the typical one. A flat, north-facing, rectangular front
// section earns a PREMIUM over the base; a steep rear wedge loses value. An
// average section lands back on the base.
//
// Two kinds of adjustment, and the difference matters:
//   • AREA — shape and slope. Only the part of the section you can't use is
//     discounted, and it keeps some value (garden, privacy, buffer). Slope is
//     applied to the land the shape left usable, so an awkward steep corner is
//     not discounted twice.
//   • WHOLE SITE — orientation and access. A south-facing, shaded rear lot
//     sells for less across every square metre.
//
// Every rate is an industry-typical adjustment we chose, not one measured from
// sales. They live in LAND_ADJ and nowhere else, so calibrating against real
// sales (Cotality, the valuation scoreboard) is a change to one table.
//
// A fact the analysis didn't establish makes NO adjustment and says so. It is
// never guessed toward either end.
//
// Dependency-free so a verify script can load it with plain node.
// ============================================================

export type Aspect = "north" | "north_east" | "north_west" | "east" | "west" | "south_east" | "south_west" | "south";
export type Shade = "open" | "partly_shaded" | "heavily_shaded";
export type Access = "prime_frontage" | "corner_site" | "road_frontage" | "shared_driveway" | "right_of_way" | "rear_lot";

export const LAND_ADJ = {
  shape: {
    /** A typical section's regular, workable share. */
    typicalWorkablePct: 95,
    /** What the unworkable part loses against the rest: it keeps 40% of the rate. */
    unworkableDiscount: 0.6,
  },
  slope: {
    typicalUsablePct: 90,
    /** Too steep to use, but still garden and outlook: keeps half the rate. */
    unusableDiscount: 0.5,
  },
  aspectPct: {
    north: 5, north_east: 3, north_west: 3, east: 0, west: 0, south_east: -4, south_west: -4, south: -7,
  } as Record<Aspect, number>,
  shadePct: { open: 0, partly_shaded: -2, heavily_shaded: -6 } as Record<Shade, number>,
  accessPct: {
    prime_frontage: 3, corner_site: 2, road_frontage: 0, shared_driveway: -4, right_of_way: -6, rear_lot: -8,
  } as Record<Access, number>,
  /** Each household sharing the access beyond two. */
  perExtraHomePct: -1,
  /** The access adjustment never goes past this. */
  accessFloorPct: -15,
};

/**
 * What a typical section measures NEAR THIS ONE — median of the residential
 * sections within `radiusM`, by the same rules as the subject. Replaces the
 * national defaults in LAND_ADJ when present; a hilly suburb's typical section
 * is itself sloping, and its sale prices already say so.
 */
export interface NearbyTypical {
  workablePct: number;
  /** Null when too few nearby sections were inside the elevation model. */
  usablePct: number | null;
  sampled: number;
  radiusM: number;
}

export interface SiteFacts {
  workablePct?: number | null;
  usablePct?: number | null;
  aspect?: Aspect | null;
  shade?: Shade | null;
  access?: Access | null;
  homesOnAccess?: number | null;
}

export interface LandLine {
  id: "land_shape" | "land_topography" | "land_aspect" | "land_frontage";
  label: string;
  /** Positive is a premium over a typical section, negative a discount. */
  deltaNZD: number;
  /** False when the fact wasn't established — no adjustment is made. */
  established: boolean;
  working: string;
}

export interface AdjustedLand {
  /** A typical section of this size in this suburb. */
  baseNZD: number;
  lines: LandLine[];
  valueNZD: number;
}

const money = (n: number) => `${n < 0 ? "−" : "+"}$${Math.abs(Math.round(n)).toLocaleString("en-NZ")}`;
const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`;
const clampPct = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? null : Math.max(0, Math.min(100, Math.round(n)));
const words = (s: string) => s.replace(/_/g, " ");

export function adjustLand(baseNZD: number, f: SiteFacts, nearby?: NearbyTypical | null): AdjustedLand {
  const lines: LandLine[] = [];
  const A = LAND_ADJ;
  // Typical, measured nearby when we could; the national default otherwise,
  // and the working says which.
  const typW = nearby?.workablePct ?? A.shape.typicalWorkablePct;
  const typU = nearby?.usablePct ?? A.slope.typicalUsablePct;
  const whereW = nearby ? `the ${typW}% typical of ${nearby.sampled} sections within ${nearby.radiusM} m` : `a typical ${typW}% (a national figure; nothing nearby was measured)`;
  const whereU =
    nearby?.usablePct != null
      ? `the ${typU}% typical of sections within ${nearby.radiusM} m`
      : `a typical ${typU}% (a national figure; nothing nearby was measured)`;

  // ── Shape: the unworkable part, at a discount ────────────────────────────
  const w = clampPct(f.workablePct);
  if (w == null) {
    lines.push({ id: "land_shape", label: "Section shape", deltaNZD: 0, established: false, working: "The shape wasn't established, so no adjustment is made." });
  } else {
    const d = Math.round(((w - typW) / 100) * baseNZD * A.shape.unworkableDiscount);
    lines.push({
      id: "land_shape",
      label: "Section shape",
      deltaNZD: d,
      established: true,
      working:
        w === typW
          ? `${w}% of it is a regular, workable block, the same as ${whereW}. No adjustment.`
          : w < typW
          ? `${w}% of it is a regular, workable block against ${whereW}. The extra awkward ${typW - w}% is valued at ${Math.round((1 - A.shape.unworkableDiscount) * 100)}% of the rate: ${money(d)}.`
          : `${w}% of it is a regular, workable block against ${whereW}. That extra ${w - typW}% is usable land where a typical section has awkward corners: ${money(d)}.`,
    });
  }

  // ── Slope: applied to the land the shape left workable ───────────────────
  const u = clampPct(f.usablePct);
  if (u == null) {
    lines.push({ id: "land_topography", label: "Topography", deltaNZD: 0, established: false, working: "The contour wasn't established, so no adjustment is made." });
  } else {
    const share = (w ?? 100) / 100;
    const d = Math.round(share * ((u - typU) / 100) * baseNZD * A.slope.unusableDiscount);
    lines.push({
      id: "land_topography",
      label: "Topography",
      deltaNZD: d,
      established: true,
      working:
        u === typU
          ? `${u}% of it is flat enough to use, the same as ${whereU}. No adjustment.`
          : `${u}% of it is flat enough to use against ${whereU}, counted only on the ${w ?? 100}% the shape leaves workable so a steep corner isn't discounted twice. That difference is valued at ${Math.round((1 - A.slope.unusableDiscount) * 100)}% of the rate: ${money(d)}.`,
    });
  }

  // ── Orientation: whole site ──────────────────────────────────────────────
  if (!f.aspect || !(f.aspect in A.aspectPct)) {
    lines.push({ id: "land_aspect", label: "Section orientation", deltaNZD: 0, established: false, working: "The orientation wasn't established, so no adjustment is made." });
  } else {
    const p = A.aspectPct[f.aspect] + (f.shade ? A.shadePct[f.shade] ?? 0 : 0);
    const d = Math.round((p / 100) * baseNZD);
    lines.push({
      id: "land_aspect",
      label: "Section orientation",
      deltaNZD: d,
      established: true,
      working: `Faces ${words(f.aspect)} (${pct(A.aspectPct[f.aspect])})${f.shade ? `, ${words(f.shade)} (${pct(A.shadePct[f.shade] ?? 0)})` : ""}${p === 0 ? ", which is typical. No adjustment." : `, applied to the whole section: ${pct(p)}, ${money(d)}.`}`,
    });
  }

  // ── Access: whole site, worse the more homes share it ────────────────────
  if (!f.access || !(f.access in A.accessPct)) {
    lines.push({ id: "land_frontage", label: "Frontage & access", deltaNZD: 0, established: false, working: "The access wasn't established, so no adjustment is made." });
  } else {
    const base = A.accessPct[f.access];
    const extra = base < 0 && f.homesOnAccess && f.homesOnAccess > 2 ? (f.homesOnAccess - 2) * A.perExtraHomePct : 0;
    const p = Math.max(A.accessFloorPct, base + extra);
    const d = Math.round((p / 100) * baseNZD);
    lines.push({
      id: "land_frontage",
      label: "Frontage & access",
      deltaNZD: d,
      established: true,
      working: `${words(f.access).replace(/^./, (c) => c.toUpperCase())}${p === 0 ? ", which is typical. No adjustment." : ` (${pct(base)})${extra ? `, shared by ${f.homesOnAccess} homes (${pct(extra)})` : ""}, applied to the whole section: ${pct(p)}, ${money(d)}.`}`,
    });
  }

  const valueNZD = Math.max(0, baseNZD + lines.reduce((s, l) => s + l.deltaNZD, 0));
  return { baseNZD, lines, valueNZD };
}

/** The site facts, read off the report's Land items. */
export function siteFactsFrom(subItems: {
  id: string;
  workableLandPct?: number;
  usableLandPct?: number;
  aspectDirection?: string;
  sunObstruction?: string;
  accessType?: string;
  homesOnAccess?: number;
}[]): SiteFacts {
  const by = (id: string) => subItems.find((s) => s.id === id);
  return {
    workablePct: by("land_shape")?.workableLandPct ?? null,
    usablePct: by("land_topography")?.usableLandPct ?? null,
    aspect: (by("land_aspect")?.aspectDirection as Aspect | undefined) ?? null,
    shade: (by("land_aspect")?.sunObstruction as Shade | undefined) ?? null,
    access: (by("land_frontage")?.accessType as Access | undefined) ?? null,
    homesOnAccess: by("land_frontage")?.homesOnAccess ?? null,
  };
}
