// ============================================================
// The Land items, with what the geometry MEASURED put over what the analysis
// read off a photo.
//
// Orientation, shape and frontage all come off the LINZ parcel, the road land
// and the road line when those were fetched. One function for the report AND
// the map pin, so the two can't value the same section on different facts.
// Where nothing was measured the item is returned untouched: the analysis's
// read stands, still marked as a read.
// ============================================================

import type { SubItem } from "@/lib/property-tab/types";
import type { SiteLayout } from "./site-layout";
import { asRatio } from "./site-slope";

const BAND_LABEL: Record<string, string> = { flat: "Flat", gentle: "Gentle slope", moderate: "Moderate slope", steep: "Steep" };

const SHAPE_LABEL: Record<string, string> = {
  rectangular: "Rectangular",
  square: "Square",
  long_narrow: "Long and narrow",
  l_shaped: "L-shaped",
  wedge: "Wedge (triangular)",
  rear_lot: "Rear lot (battle-axe)",
  irregular: "Irregular",
};

const ACCESS_FINDING = (access: string, m: number, homes?: number): string =>
  access === "shared_driveway"
    ? `Shared access lot — no street frontage of its own; the driveway serves ${homes ?? "several"} homes`
    : access === "corner_site"
    ? `Corner site — ${m} m of street frontage across two sides`
    : access === "rear_lot"
    ? `Rear lot — reached by a ${m} m access leg, not a street frontage`
    : access === "right_of_way"
    ? "No legal road frontage — access is over neighbouring land"
    : `${m} m of street frontage`;

export function withMeasuredSite(s: SubItem, layout: SiteLayout | null | undefined): SubItem {
  if (!layout) return s;

  if (s.id === "land_aspect" && layout.aspect) {
    const a = layout.aspect;
    return {
      ...s,
      aspectDirection: a.direction as SubItem["aspectDirection"],
      confidenceTier: 1 as SubItem["confidenceTier"],
      evidenceSource: "LINZ parcel boundary + road centreline",
      finding: `${a.direction.replace(/_/g, "-")}-facing section — the street runs ${a.roadBearing}`,
    };
  }

  const m = layout.measured;
  if (!m) return s;
  // A modern survey is established fact. LINZ's older digitised boundaries can
  // be a metre or more out, which matters on a narrow access leg — say so.
  const tier = (m.surveyAccurate ? 1 : 2) as SubItem["confidenceTier"];
  const boundary = m.surveyAccurate ? "LINZ parcel boundary (surveyed)" : "LINZ parcel boundary (older digitised record, can be a metre or more out)";

  if (s.id === "land_topography" && m.terrain) {
    const t = m.terrain;
    return {
      ...s,
      slopeBand: t.slopeBand as SubItem["slopeBand"],
      usableLandPct: t.usablePct,
      confidenceTier: 1 as SubItem["confidenceTier"],
      evidenceSource: "LINZ national elevation model (LiDAR where flown)",
      finding: `${BAND_LABEL[t.slopeBand]} — ${asRatio(t.medianGradientPct)} on average, ${t.usablePct}% no steeper than 1:10, ${t.fallM} m fall across the section`,
    };
  }

  if (s.id === "land_shape") {
    return {
      ...s,
      shapeType: m.shapeType as SubItem["shapeType"],
      workableLandPct: m.workablePct,
      confidenceTier: tier,
      evidenceSource: boundary,
      finding: `${SHAPE_LABEL[m.shapeType] ?? "Irregular"} — ${m.workablePct}% of it is at least 6 m wide, enough to build on or use`,
    };
  }

  if (s.id === "land_frontage" && m.frontage) {
    return {
      ...s,
      accessType: m.frontage.access as SubItem["accessType"],
      ...(m.frontage.homesOnAccess ? { homesOnAccess: m.frontage.homesOnAccess } : {}),
      confidenceTier: tier,
      evidenceSource: `${boundary} + legal road parcels`,
      finding: ACCESS_FINDING(m.frontage.access, m.frontage.lengthM, m.frontage.homesOnAccess),
    };
  }

  return s;
}

/** Every item, measured where the geometry allows. */
export const withMeasuredSiteAll = (items: SubItem[], layout: SiteLayout | null | undefined): SubItem[] =>
  layout ? items.map((s) => withMeasuredSite(s, layout)) : items;
