/**
 * Which provider actually served an aerial tile.
 *
 * `app/api/tiles/aerial` has two upstreams on DIFFERENT LICENCES — LINZ
 * Basemaps under CC BY 4.0, and Mapbox/Maxar under their own terms — and which
 * one a reader got depends both on configuration and on whether the first
 * choice answered at the time. The caption used to name both joined by "or",
 * which is a guess dressed as attribution; crediting the wrong provider is a
 * licensing problem rather than a wording one.
 *
 * A route file may only export route handlers, so the header name lives here
 * where both sides can import it and cannot drift apart.
 */
export const IMAGERY_SOURCE_HEADER = "x-imagery-source";

export type ImagerySource = "linz" | "mapbox";

export function isImagerySource(v: string | null): v is ImagerySource {
  return v === "linz" || v === "mapbox";
}

/** The credit line each provider requires. */
export const IMAGERY_CREDIT: Record<ImagerySource, string> = {
  linz: "Aerial imagery: LINZ Basemaps, CC BY 4.0",
  mapbox: "Aerial imagery: © Mapbox © Maxar",
};
