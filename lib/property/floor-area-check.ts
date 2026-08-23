// ============================================================
// Two records of the same house, and what it means when they disagree.
//
// The listing advertises a floor area. The district valuation roll records one
// too, from the council's own rating assessment. When the advertised house is
// materially BIGGER than the rated one, something was built that the rating
// record has not caught up with — which is, among other possibilities, what an
// undeclared addition looks like from the outside.
//
// This is the only consent-adjacent check the app can honestly make. Councils
// do not publish building consents as queryable data, so the report can never
// say a structure is unconsented. It CAN say that two public records of the
// same property disagree by 40m², and let the reader take that to the LIM.
//
// Pure and dependency-free: the thresholds decide whether a buyer is told to
// look harder at a house, and a wrong one is either a false alarm on an honest
// listing or a missed room. Tested in scripts/verify-floor-area.mjs.
// ============================================================

/**
 * How far apart the two figures must be before it means anything.
 *
 * Both conditions have to hold, deliberately. Rating rolls and listings measure
 * differently — a roll often excludes the garage, the conservatory or a sleepout
 * that an agent happily counts — so a 30m² gap on a large house is ordinary and
 * a percentage alone would flag half the country. Requiring a fifth of the house
 * AND more than a garage's worth of floor keeps this to gaps that need explaining.
 */
export const MATERIAL_PCT = 20;
export const MATERIAL_SQM = 25;

/**
 * Past this, a difference may simply post-date the last rating assessment: work
 * consented and completed after the valuation is not in the roll yet.
 */
export const STALE_ROLL_YEARS = 3;

export type FloorAreaStatus =
  | "unknown" // one of the two figures is missing
  | "consistent" // the records agree, within the tolerance above
  | "listing_larger" // the advertised house is bigger than the rated one
  | "listing_smaller"; // the rated house is bigger than the advertised one

export interface FloorAreaComparison {
  status: FloorAreaStatus;
  listingSqm: number | null;
  rollSqm: number | null;
  /** Always positive — the size of the gap, whichever way it runs. */
  differenceSqm: number | null;
  /** The gap as a share of the roll's figure. */
  differencePct: number | null;
  /** How old the rating assessment is, when it says. */
  rollAgeYears: number | null;
  /** Plain-language finding. Never asserts a consent status — see the header. */
  note: string | null;
}

const EMPTY: FloorAreaComparison = {
  status: "unknown",
  listingSqm: null,
  rollSqm: null,
  differenceSqm: null,
  differencePct: null,
  rollAgeYears: null,
  note: null,
};

const usable = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;

function yearsSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const years = (now.getTime() - then.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return years >= 0 ? Math.round(years * 10) / 10 : null;
}

/**
 * Compare the advertised floor area against the rating record.
 *
 * Returns "unknown" whenever either figure is missing, which is most of the
 * time: the valuation roll covers roughly 12% of New Zealand properties. A
 * check that usually can't run is still worth having when it does — but nothing
 * downstream may treat its silence as an all-clear.
 */
export function compareFloorArea(args: {
  listingSqm: number | null | undefined;
  rollSqm: number | null | undefined;
  rollEffectiveDate?: string | null;
  now?: Date;
}): FloorAreaComparison {
  const listingSqm = usable(args.listingSqm);
  const rollSqm = usable(args.rollSqm);
  if (listingSqm == null || rollSqm == null) return { ...EMPTY, listingSqm, rollSqm };

  const differenceSqm = Math.round(Math.abs(listingSqm - rollSqm));
  const differencePct = Math.round((differenceSqm / rollSqm) * 100);
  const rollAgeYears = yearsSince(args.rollEffectiveDate, args.now ?? new Date());
  const material = differencePct >= MATERIAL_PCT && differenceSqm >= MATERIAL_SQM;

  if (!material) {
    return {
      status: "consistent",
      listingSqm,
      rollSqm,
      differenceSqm,
      differencePct,
      rollAgeYears,
      note: `The listing and the council's rating record agree on size (${listingSqm}m² advertised, ${rollSqm}m² rated).`,
    };
  }

  const stale = rollAgeYears != null && rollAgeYears >= STALE_ROLL_YEARS;
  const staleLine = stale
    ? ` The rating assessment is about ${Math.round(rollAgeYears!)} years old, so work done and consented since then may simply not be in it yet.`
    : "";

  if (listingSqm > rollSqm) {
    return {
      status: "listing_larger",
      listingSqm,
      rollSqm,
      differenceSqm,
      differencePct,
      rollAgeYears,
      // Deliberately does not say "unconsented". We have not seen a council
      // file and cannot: this is two records disagreeing, which is a reason to
      // look, not a finding.
      note:
        `The listing advertises ${listingSqm}m² of floor area; the council's rating record has ${rollSqm}m² — ` +
        `about ${differenceSqm}m² more house than the rating roll knows about (${differencePct}%).` +
        ` That gap is worth explaining. It can be innocent — rolls often leave out a garage, conservatory or sleepout that an agent counts, and measurement conventions differ — but an addition the council never recorded looks exactly like this.${staleLine}` +
        ` The LIM or council property file is what settles it.`,
    };
  }

  return {
    status: "listing_smaller",
    listingSqm,
    rollSqm,
    differenceSqm,
    differencePct,
    rollAgeYears,
    note:
      `The council's rating record has ${rollSqm}m² of floor area; the listing advertises ${listingSqm}m² — ` +
      `about ${differenceSqm}m² less (${differencePct}%). Usually a measurement difference or a part of the building the listing hasn't counted, and occasionally something that has been removed.${staleLine}`,
  };
}
