// ============================================================
// Grading our own valuations against what the market actually paid.
//
// The app has never found out whether it was right. It publishes a valuation,
// the property sells, and the answer — which is free, and which is the only
// real test there is — goes in the bin. Every property we valued that later
// sold is a scored prediction sitting there ungraded.
//
// Two things this must get right, because both are ways of fooling yourself:
//
// 1. A HANDFUL OF SALES IS NOT A BIAS. Individual valuations scatter; two
//    identical sections sell differently depending on who turned up that day.
//    Three sales in a row reading low is a reason to LOOK, not a mandate to
//    move a rate. Chase the last few sales and you get a number that lurches
//    around and is wrong in a new direction every month. Below MIN_SAMPLE this
//    module refuses to return a bias verdict at all.
//
// 2. BIAS AND SPREAD ARE DIFFERENT FAULTS. A median error of −20% means the
//    rate is wrong and moving it fixes everything. A median error of zero with
//    sales scattered ±35% means the rate is FINE and the model is missing a
//    variable — moving the rate there makes it worse. They're reported
//    separately and named differently on purpose.
//
// Everything is median-based rather than mean-based: one $4m sale in a suburb
// of $600k houses would drag a mean somewhere useless.
//
// Dependency-free, so scripts/verify-scoreboard.mjs can load it with plain node.
// ============================================================

/** How many graded sales before we'll call anything a bias. */
export const MIN_SAMPLE = 25;

/** Median error beyond this, in either direction, is a systematic offset. */
export const BIAS_PCT = 5;

/**
 * Spread beyond this means the model is missing a variable. Individual
 * valuations always scatter; it's the size of the scatter that says whether
 * there's something we aren't looking at.
 */
export const NOISY_MAD_PCT = 15;

/**
 * A valuation older than this isn't a fair test any more. Grading a
 * two-year-old number against today's sale measures the market, not the model,
 * and "correcting" for it would bake a market movement into the rate forever.
 */
export const MAX_PREDICTION_AGE_DAYS = 365;

/** A valuation we published — before the property sold. */
export interface Prediction {
  id: string;
  /** What we said it was worth. */
  valuation: number | null;
  /** When we said it (ISO). */
  valuedAt: string | null;
  suburb: string | null;
  region: string | null;
  propertyType: string | null;
}

/** What the market actually paid. */
export interface Outcome {
  salePrice: number | null;
  saleDate: string | null;
  /** Where the price came from. A figure with no source is not evidence. */
  source: string | null;
}

export type Ungradable =
  | "no-valuation"
  | "no-sale-price"
  | "no-source"
  | "valued-after-sale"
  | "stale";

export const UNGRADABLE_REASON: Record<Ungradable, string> = {
  "no-valuation": "we never published a valuation for this property",
  "no-sale-price": "no sale price on file yet",
  "no-source": "the sale price has no source, so it isn't evidence",
  "valued-after-sale": "we valued it after it sold, which is a fit and not a prediction",
  stale: `the valuation was more than ${MAX_PREDICTION_AGE_DAYS} days old when it sold`,
};

export interface Grade {
  id: string;
  /** (valuation − sale price) as a % of the sale price. NEGATIVE = we were low. */
  errorPct: number;
  valuation: number;
  salePrice: number;
  /** How old our valuation was when the property sold. */
  ageDays: number;
  suburb: string | null;
  region: string | null;
  propertyType: string | null;
}

export interface Skipped {
  id: string;
  ungradable: Ungradable;
}

const DAY = 86_400_000;

/**
 * Grade one prediction against one outcome, or say why it can't be graded.
 *
 * The `valued-after-sale` case is the important refusal. A valuation produced
 * from a sold listing already knows the answer — grading it would report the
 * model as accurate because it was reading the result off the page.
 */
export function grade(p: Prediction, o: Outcome): Grade | Skipped {
  if (!p.valuation || p.valuation <= 0) return { id: p.id, ungradable: "no-valuation" };
  if (!o.salePrice || o.salePrice <= 0) return { id: p.id, ungradable: "no-sale-price" };
  if (!o.source) return { id: p.id, ungradable: "no-source" };
  if (!p.valuedAt || !o.saleDate) return { id: p.id, ungradable: "no-sale-price" };

  const valued = Date.parse(p.valuedAt);
  const sold = Date.parse(o.saleDate);
  if (!Number.isFinite(valued) || !Number.isFinite(sold)) {
    return { id: p.id, ungradable: "no-sale-price" };
  }
  if (sold < valued) return { id: p.id, ungradable: "valued-after-sale" };

  const ageDays = Math.round((sold - valued) / DAY);
  if (ageDays > MAX_PREDICTION_AGE_DAYS) return { id: p.id, ungradable: "stale" };

  return {
    id: p.id,
    errorPct: ((p.valuation - o.salePrice) / o.salePrice) * 100,
    valuation: p.valuation,
    salePrice: o.salePrice,
    ageDays,
    suburb: p.suburb,
    region: p.region,
    propertyType: p.propertyType,
  };
}

export function isGrade(g: Grade | Skipped): g is Grade {
  return (g as Grade).errorPct !== undefined;
}

/** Median of a list. Returns null for an empty one — never 0, which would read as "spot on". */
export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export type Verdict = "insufficient" | "unbiased" | "biased-low" | "biased-high" | "noisy";

export const VERDICT_MEANING: Record<Verdict, string> = {
  insufficient: `fewer than ${MIN_SAMPLE} graded sales — not enough to tell a bias from ordinary scatter`,
  unbiased: "no systematic offset, and the spread is what you'd expect",
  "biased-low": "we are systematically valuing below the market — buyers acting on this would underbid",
  "biased-high": "we are systematically valuing above the market — buyers acting on this would overpay",
  noisy: "no systematic offset, but the spread is wide: the rate is fine and the model is missing a variable",
};

export interface Summary {
  n: number;
  /** Negative = we run low. Null until there is anything to summarise. */
  medianErrorPct: number | null;
  /** Median absolute deviation from the median error — the spread, outlier-proof. */
  madPct: number | null;
  /** Share of sales we landed within 10% / 20% of. */
  within10Pct: number | null;
  within20Pct: number | null;
  verdict: Verdict;
}

export function summarise(grades: readonly Grade[]): Summary {
  const n = grades.length;
  if (!n) {
    return { n: 0, medianErrorPct: null, madPct: null, within10Pct: null, within20Pct: null, verdict: "insufficient" };
  }

  const errors = grades.map((g) => g.errorPct);
  const med = median(errors)!;
  const mad = median(errors.map((e) => Math.abs(e - med)))!;
  const within = (pct: number) => (grades.filter((g) => Math.abs(g.errorPct) <= pct).length / n) * 100;

  // The rule this module exists to enforce: below MIN_SAMPLE we do not get to
  // call anything a bias, however tempting the numbers look.
  let verdict: Verdict;
  if (n < MIN_SAMPLE) verdict = "insufficient";
  else if (Math.abs(med) >= BIAS_PCT) verdict = med < 0 ? "biased-low" : "biased-high";
  else if (mad >= NOISY_MAD_PCT) verdict = "noisy";
  else verdict = "unbiased";

  const r = (x: number) => Math.round(x * 10) / 10;
  return {
    n,
    medianErrorPct: r(med),
    madPct: r(mad),
    within10Pct: r(within(10)),
    within20Pct: r(within(20)),
    verdict,
  };
}

/**
 * Is this the point at which the app owes its readers a warning?
 *
 * Only a measured, sufficiently-sampled offset counts. Serving a valuation we
 * have MEASURED as systematically wrong, without saying so, is the same fault
 * as the map calling a house we'd never valued a "fair price" — worse, because
 * a buyer acting on a number we knew was 20% low loses every auction they enter.
 */
export function shouldDisclose(s: Summary): boolean {
  return s.verdict === "biased-low" || s.verdict === "biased-high";
}

/** Break the grades down by any key — suburb, region, type — smallest samples last. */
export function summariseBy<K extends string>(
  grades: readonly Grade[],
  key: (g: Grade) => K | null
): Array<{ key: K; summary: Summary }> {
  const buckets = new Map<K, Grade[]>();
  for (const g of grades) {
    const k = key(g);
    if (k == null) continue;
    const b = buckets.get(k) ?? [];
    b.push(g);
    buckets.set(k, b);
  }
  return [...buckets.entries()]
    .map(([k, gs]) => ({ key: k, summary: summarise(gs) }))
    .sort((a, b) => b.summary.n - a.summary.n);
}

/**
 * Bare land or a dwelling. Sections are the cleanest test there is — no
 * building to estimate, so the sale price IS the land value — which makes them
 * the canary: a systematic miss on sections means the land rate is wrong, and
 * that same rate is buried inside every house valuation in the suburb.
 */
export function isBareLand(propertyType: string | null): boolean {
  if (!propertyType) return false;
  return /^(section|lifestyle-section|bare-land|land)$/i.test(propertyType.trim());
}
