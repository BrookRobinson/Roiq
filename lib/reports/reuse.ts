// ============================================================
// Don't pay to analyse the same house twice — SERVER ONLY.
//
// Every finished report is already stored whole, with its listing URL and
// asking price beside it. So when someone pastes a link that's been done
// before, there is nothing to generate: hand back the saved analysis.
//
// The person still gets their OWN report. The caller saves what comes back
// under a fresh id in their own name, so it lands on their dashboard, they can
// attach their own documents, and it counts against their quota exactly like a
// fresh one. The only party who saves anything is us — the Claude bill.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { StoredReport } from "@/lib/report-store";
import {
  normaliseAddress,
  normaliseListingUrl,
  photosUnchanged,
  priceUnchanged,
} from "@/lib/reports/listing-key";

/** How long a saved analysis stays good for. */
export const REUSE_MAX_AGE_DAYS = 30;

export interface ReusedReport {
  report: StoredReport;
  /** When the original analysis was run — the UI says so rather than implying it's live. */
  analysedAt: string;
}

/**
 * A saved analysis for this property, if one is still trustworthy.
 *
 * Two things have to hold. It must be recent, and the asking price must not have
 * moved — a price drop is exactly the moment the old verdict becomes wrong, and
 * it's the whole reason we scrape before checking rather than after. When
 * neither side has a number (auction, "by negotiation", enquiries over) there's
 * nothing to compare and the age rule stands alone: a listing with no price
 * can't have a price change.
 */
export async function findReusableReport(opts: {
  url?: string | null;
  address?: string | null;
  /** Today's asking price, freshly scraped. */
  askingPrice?: number | null;
  /** Today's photos, freshly scraped — the report cites them by number. */
  photoUrls?: readonly string[] | null;
}): Promise<ReusedReport | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const urlKey = normaliseListingUrl(opts.url);
  const addressKey = normaliseAddress(opts.address);
  if (!urlKey && !addressKey) return null;

  const cutoff = new Date(Date.now() - REUSE_MAX_AGE_DAYS * 86_400_000).toISOString();

  try {
    // Pull recent completed reports and match in code. The stored columns aren't
    // normalised, so an `eq` on the raw URL would miss the same listing pasted
    // with a `?utm_source` tail — which is most of them.
    const { data, error } = await supabase
      .from("reports")
      .select("id, report, listing_url, address, asking_price, created_at")
      .eq("report_status", "complete")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error || !data?.length) return null;

    const match = data.find((row) => {
      // A URL match is the strong one. An address match catches the same house
      // pasted from a different portal, which is common and worth having.
      const sameListing =
        (urlKey && normaliseListingUrl(row.listing_url) === urlKey) ||
        (addressKey && normaliseAddress(row.address) === addressKey);
      if (!sameListing) return false;
      if (!priceUnchanged(opts.askingPrice ?? null, row.asking_price ?? null)) return false;

      // The photos are the other half of staleness, and the sneakier half: an
      // agent can reshoot or restyle a place without touching the price. The
      // report quotes photos by number, so a changed set makes every one of
      // those references wrong while the price check happily waves it through.
      const saved = row.report as unknown as StoredReport | null;
      return photosUnchanged(
        opts.photoUrls ?? [],
        saved?.listing?.photoUrls ?? [],
        saved?.photosAnalysed ?? null
      );
    });

    if (!match?.report) return null;

    return {
      report: stripPersonalWork(match.report as unknown as StoredReport),
      analysedAt: match.created_at,
    };
  } catch {
    // A failed lookup must never block a report — fall through to a real analysis.
    return null;
  }
}

/**
 * Strip what the first person paid for personally.
 *
 * `verifiedDocs` holds Claude's reading of a LIM, title, consents or EQC claim
 * that someone uploaded themselves. That's their purchased work, not a fact
 * about the house that comes free with the listing — so the next person starts
 * without it and uploads their own.
 */
function stripPersonalWork(report: StoredReport): StoredReport {
  const { verifiedDocs: _discarded, ...rest } = report;
  return rest as StoredReport;
}
