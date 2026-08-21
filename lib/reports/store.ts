// ============================================================
// Reports — server-side persistence.
//
// SERVER ONLY. Goes through the service role, because RLS on `reports` is
// written against auth.uid() and nothing signs in yet. That's the right way
// round: reports are the paid product, so the public anon key must not be able
// to read them. Ownership is enforced here instead — every read is filtered by
// the caller's owner_key, so possession of a report id is not enough.
//
// The full StoredReport goes in a jsonb column; the sibling columns are
// denormalised copies so the dashboard can list reports without pulling every
// blob over the wire.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { StoredReport } from "@/lib/report-store";

/** One row as the dashboard list needs it — no report blob. */
export interface ReportSummary {
  id: string;
  createdAt: string;
  address: string | null;
  suburb: string | null;
  region: string | null;
  askingPrice: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  score: number | null;
  propertyType: string | null;
  photosAnalysed: number | null;
  listingUrl: string | null;
}

export interface SaveResult {
  saved: boolean;
  reason?: "no_database" | "db_error";
  detail?: string;
}

/**
 * Photos arrive as base64 `data:` URLs on the upload flow. They're already
 * analysed by the time we get here, and a report carrying twenty of them is
 * megabytes of pointless jsonb, so drop them — the same trim `saveReport` does
 * for sessionStorage, for the same reason.
 */
function slim(report: StoredReport): StoredReport {
  const photoUrls = (report.listing?.photoUrls ?? []).filter(
    (u) => typeof u === "string" && !u.startsWith("data:")
  );
  return { ...report, listing: { ...report.listing, photoUrls } };
}

export async function saveReport(
  report: StoredReport,
  ownerKey: string,
  userId: string | null = null
): Promise<SaveResult> {
  const supabase = createAdminClient();
  if (!supabase) return { saved: false, reason: "no_database" };

  const body = slim(report);
  const l = body.listing ?? ({} as StoredReport["listing"]);

  const row = {
    id: body.id,
    owner_key: ownerKey,
    user_id: userId, // null when signed out; claimReports() attaches it later
    created_at: body.createdAt,
    report: body as unknown as Record<string, unknown>,

    // Denormalised for listing/filtering.
    listing_url: l.url ?? null,
    address: l.address ?? null,
    suburb: l.suburb ?? null,
    region: l.region ?? null,
    asking_price: l.askingPrice ?? null,
    floor_area_sqm: l.floorAreaSqm ?? null,
    land_area_sqm: l.landAreaSqm ?? null,
    bedrooms: l.bedrooms ?? null,
    bathrooms: l.bathrooms ?? null,
    car_parks: l.carParks ?? null,
    build_year: l.buildYear ?? null,
    property_type: l.propertyType ?? null,
    title_type: l.titleType ?? null,
    listing_source: l.portal ?? null,
    quality_score: Math.round(body.scores?.buyer?.base ?? 0) || null,
    photos_analysed: body.photosAnalysed ?? null,
    model: body.model ?? null,
    report_status: "complete",
  };

  try {
    // Upsert: re-saving the same report id (a retry, or docs added later)
    // updates it rather than colliding on the primary key.
    const { error } = await supabase.from("reports").upsert(row as never, { onConflict: "id" });
    if (error) return { saved: false, reason: "db_error", detail: error.message };
    return { saved: true };
  } catch (err) {
    return { saved: false, reason: "db_error", detail: (err as Error).message };
  }
}

/**
 * One report, but only for the browser that created it. Filtering on owner_key
 * is what keeps a report id from being a password — map pins publish report ids,
 * so an id-only lookup would hand the paid product to anyone who clicked a pin.
 */
/**
 * A report belongs to whoever made it — identified by a signed-in user id, or by
 * the browser cookie that made it before they signed in. Matching on either is
 * what stops signing in from orphaning your own reports.
 */
function ownerFilter(ownerKey: string | null, userId: string | null): string | null {
  const clauses: string[] = [];
  if (userId) clauses.push(`user_id.eq.${userId}`);
  if (ownerKey) clauses.push(`owner_key.eq.${ownerKey}`);
  return clauses.length ? clauses.join(",") : null;
}

export async function loadReport(
  id: string,
  ownerKey: string | null,
  userId: string | null = null
): Promise<StoredReport | null> {
  const supabase = createAdminClient();
  const filter = ownerFilter(ownerKey, userId);
  if (!supabase || !filter) return null;

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .or(filter)
      .maybeSingle();
    if (error || !data?.report) return null;
    return data.report as unknown as StoredReport;
  } catch {
    return null;
  }
}

/** The caller's reports, newest first. */
export async function listReports(
  ownerKey: string | null,
  userId: string | null = null,
  limit = 50
): Promise<ReportSummary[]> {
  const supabase = createAdminClient();
  const filter = ownerFilter(ownerKey, userId);
  if (!supabase || !filter) return [];

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];

    return data.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      address: r.address,
      suburb: r.suburb,
      region: r.region,
      askingPrice: r.asking_price,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      score: r.quality_score,
      propertyType: r.property_type,
      photosAnalysed: r.photos_analysed,
      listingUrl: r.listing_url,
    })) as ReportSummary[];
  } catch {
    return [];
  }
}

export async function deleteReport(
  id: string,
  ownerKey: string | null,
  userId: string | null = null
): Promise<boolean> {
  const supabase = createAdminClient();
  const filter = ownerFilter(ownerKey, userId);
  if (!supabase || !filter) return false;
  try {
    const { error } = await supabase.from("reports").delete().eq("id", id).or(filter);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Attach this browser's anonymous reports to the person who just signed in.
 * Runs on every session check — it's a no-op once there's nothing left to claim.
 */
export async function claimReports(ownerKey: string | null, userId: string): Promise<number> {
  const supabase = createAdminClient();
  if (!supabase || !ownerKey) return 0;
  try {
    const { data, error } = await supabase
      .from("reports")
      .update({ user_id: userId } as never)
      .eq("owner_key", ownerKey)
      .is("user_id", null)
      .select("id");
    return error || !data ? 0 : data.length;
  } catch {
    return 0;
  }
}

/**
 * The full report behind a map pin, for a Pro subscriber. Deliberately NOT
 * ownership-filtered: the map of everyone's analyses is what Pro buys. Limited to
 * properties that are publicly for sale, which is the only kind that reaches a pin.
 */
export async function loadReportForPro(id: string): Promise<StoredReport | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
    if (error || !data?.report) return null;
    return data.report as unknown as StoredReport;
  } catch {
    return null;
  }
}
