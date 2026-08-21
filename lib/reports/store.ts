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

export async function saveReport(report: StoredReport, ownerKey: string): Promise<SaveResult> {
  const supabase = createAdminClient();
  if (!supabase) return { saved: false, reason: "no_database" };

  const body = slim(report);
  const l = body.listing ?? ({} as StoredReport["listing"]);

  const row = {
    id: body.id,
    owner_key: ownerKey,
    user_id: null, // no signed-in user yet; claimed when auth lands
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
export async function loadReport(id: string, ownerKey: string | null): Promise<StoredReport | null> {
  const supabase = createAdminClient();
  if (!supabase || !ownerKey) return null;

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .eq("owner_key", ownerKey)
      .maybeSingle();
    if (error || !data?.report) return null;
    return data.report as unknown as StoredReport;
  } catch {
    return null;
  }
}

/** The caller's reports, newest first. */
export async function listReports(ownerKey: string | null, limit = 50): Promise<ReportSummary[]> {
  const supabase = createAdminClient();
  if (!supabase || !ownerKey) return [];

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("owner_key", ownerKey)
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

export async function deleteReport(id: string, ownerKey: string | null): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase || !ownerKey) return false;
  try {
    const { error } = await supabase.from("reports").delete().eq("id", id).eq("owner_key", ownerKey);
    return !error;
  } catch {
    return false;
  }
}
