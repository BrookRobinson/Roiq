// ============================================================
// Reading the scoreboard out of the map — SERVER ONLY.
//
// `map_listings` is the join: it carries our valuation (`roiq_valuation`), when
// we made it (`last_scored_at`), and — once a sale feed fills them — what the
// property actually sold for. Nothing else has to be plumbed; the prediction
// has been sitting there all along waiting for an outcome.
//
// Until a sale feed lands, every row grades as "no-sale-price" and the board
// reports zero graded sales. That is the correct answer, not a broken one, and
// `awaitingOutcome` is the number worth watching in the meantime: it says how
// many predictions are on file ready to be marked the day prices arrive.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { realValuation } from "@/lib/map/calc";
import {
  grade,
  isGrade,
  summarise,
  summariseBy,
  shouldDisclose,
  isBareLand,
  type Grade,
  type Skipped,
  type Summary,
  type Ungradable,
} from "./scoreboard";

export interface Scoreboard {
  ok: boolean;
  reason?: string;
  /** Rows carrying a valuation of ours, whatever their outcome. */
  predictions: number;
  /** Valuations on file with no sale price yet — the pipeline filling up. */
  awaitingOutcome: number;
  /** Why the rest couldn't be graded. */
  skipped: Partial<Record<Ungradable, number>>;
  overall: Summary;
  /** Does the app owe its readers a warning right now? */
  disclose: boolean;
  bareLand: Summary;
  dwellings: Summary;
  byRegion: Array<{ key: string; summary: Summary }>;
  bySuburb: Array<{ key: string; summary: Summary }>;
  /** The worst individual misses, for eyeballing what went wrong. */
  worst: Array<Pick<Grade, "id" | "suburb" | "valuation" | "salePrice" | "errorPct" | "ageDays">>;
}

export async function buildScoreboard(): Promise<Scoreboard> {
  const empty: Scoreboard = {
    ok: false,
    predictions: 0,
    awaitingOutcome: 0,
    skipped: {},
    overall: summarise([]),
    disclose: false,
    bareLand: summarise([]),
    dwellings: summarise([]),
    byRegion: [],
    bySuburb: [],
    worst: [],
  };

  const supabase = createAdminClient();
  if (!supabase) return { ...empty, reason: "no_database" };

  try {
    const rows = await readAllPages<{
      source_key: string | null;
      asking_price: number | null;
      suburb: string | null;
      region: string | null;
      property_type: string | null;
      roiq_valuation: number | null;
      last_scored_at: string | null;
      sale_price: number | null;
      sale_date: string | null;
      sale_source: string | null;
    }>(() =>
      supabase
        .from("map_listings")
        .select(
          "source_key, asking_price, suburb, region, property_type, roiq_valuation, last_scored_at, sale_price, sale_date, sale_source"
        )
        .not("roiq_valuation", "is", null)
    );

    const graded: Grade[] = [];
    const skipped: Partial<Record<Ungradable, number>> = {};

    for (const r of rows) {
      // Through realValuation, NEVER the raw column. Rows written before the
      // map fix hold the ASKING PRICE in `roiq_valuation`, because a failed
      // valuation used to fall back to it. Grading those would mark the
      // vendor's own number as our prediction — and since a property tends to
      // sell somewhere near its asking price, it would score us as accurate
      // precisely where we had never valued anything at all.
      const g = grade(
        {
          id: r.source_key ?? "?",
          valuation: realValuation(r.roiq_valuation, r.asking_price),
          valuedAt: r.last_scored_at,
          suburb: r.suburb,
          region: r.region,
          propertyType: r.property_type,
        },
        { salePrice: r.sale_price, saleDate: r.sale_date, source: r.sale_source }
      );
      if (isGrade(g)) graded.push(g);
      else {
        const reason = (g as Skipped).ungradable;
        skipped[reason] = (skipped[reason] ?? 0) + 1;
      }
    }

    // Predictions we can actually stand behind — a withheld valuation is not one.
    const predictions = rows.filter((r) => realValuation(r.roiq_valuation, r.asking_price) != null).length;
    const overall = summarise(graded);
    const bare = graded.filter((g) => isBareLand(g.propertyType));
    const built = graded.filter((g) => !isBareLand(g.propertyType));

    return {
      ok: true,
      predictions,
      awaitingOutcome: skipped["no-sale-price"] ?? 0,
      skipped,
      overall,
      disclose: shouldDisclose(overall),
      bareLand: summarise(bare),
      dwellings: summarise(built),
      byRegion: summariseBy(graded, (g) => g.region),
      bySuburb: summariseBy(graded, (g) => g.suburb).slice(0, 25),
      worst: [...graded]
        .sort((a, b) => Math.abs(b.errorPct) - Math.abs(a.errorPct))
        .slice(0, 10)
        .map((g) => ({
          id: g.id,
          suburb: g.suburb,
          valuation: g.valuation,
          salePrice: g.salePrice,
          errorPct: Math.round(g.errorPct * 10) / 10,
          ageDays: g.ageDays,
        })),
    };
  } catch (err) {
    return { ...empty, reason: (err as Error).message };
  }
}
