import { NextRequest, NextResponse } from "next/server";

import { buildScoreboard } from "@/lib/valuation/scoreboard-store";
import {
  MIN_SAMPLE,
  BIAS_PCT,
  NOISY_MAD_PCT,
  MAX_PREDICTION_AGE_DAYS,
  VERDICT_MEANING,
  UNGRADABLE_REASON,
} from "@/lib/valuation/scoreboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Not public, unlike the other health endpoints.
 *
 * Those report whether a thing is working. This one reports how WRONG our
 * valuations are — "Tectara runs 20% under the market, here are its ten worst
 * misses" is a sentence we may need to act on and must not publish at a URL
 * anyone can guess. Same secret as the nightly cron; open on a local machine so
 * it can be read while working.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") ?? req.headers.get("x-cron-secret") ?? "";
  return header === `Bearer ${secret}` || header === secret;
}

/**
 * GET /api/health/valuation — how good are our valuations, measured against
 * what the market actually paid?
 *
 * The app has never known. It publishes a number, the property sells, and the
 * only real test there is goes unrecorded. This is the scoreboard: every
 * property we valued that later sold, graded.
 *
 * `medianErrorPct` is the one to read, and its SIGN is the point — negative
 * means we run below the market, which for a buyer means underbidding and
 * losing houses. `madPct` beside it is the spread, and the two are different
 * faults: an offset means the rate is wrong, a wide spread with no offset
 * means the rate is fine and the model is missing a variable.
 *
 * Read `bareLand` first. A section has no building to estimate, so the sale
 * price IS the land value — it is the cleanest test we have, and the same land
 * rate is buried inside every house valuation in that suburb.
 *
 * Until a sale feed fills `map_listings.sale_price`, this reports zero graded
 * sales and counts what is waiting. That is the honest answer, not a fault.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const board = await buildScoreboard();

  return NextResponse.json({
    ok: board.ok,
    reason: board.reason,
    // What the thresholds are, so a reader doesn't have to guess what "biased"
    // was measured against.
    rules: {
      minSampleBeforeCallingItBias: MIN_SAMPLE,
      biasThresholdPct: BIAS_PCT,
      noisySpreadPct: NOISY_MAD_PCT,
      maxPredictionAgeDays: MAX_PREDICTION_AGE_DAYS,
    },
    coverage: {
      predictions: board.predictions,
      awaitingOutcome: board.awaitingOutcome,
      graded: board.overall.n,
      skipped: Object.fromEntries(
        Object.entries(board.skipped).map(([k, n]) => [k, { count: n, why: UNGRADABLE_REASON[k as never] }])
      ),
    },
    overall: { ...board.overall, meaning: VERDICT_MEANING[board.overall.verdict] },
    // True only when a properly-sampled offset has actually been measured. When
    // it flips, the reports owe their readers a sentence saying so.
    discloseToReaders: board.disclose,
    bareLand: { ...board.bareLand, meaning: VERDICT_MEANING[board.bareLand.verdict] },
    dwellings: { ...board.dwellings, meaning: VERDICT_MEANING[board.dwellings.verdict] },
    byRegion: board.byRegion,
    bySuburb: board.bySuburb,
    worstMisses: board.worst,
  });
}
