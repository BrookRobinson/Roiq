import { NextResponse } from "next/server";
import { IMAGERY_SOURCE_HEADER } from "@/lib/imagery/source";

// ============================================================
// LINZ aerial imagery, proxied.
//
// The site plan draws a section over an aerial photograph so a reader can check
// the surveyed boundary against their own fences. LINZ Basemaps serves that
// imagery free under CC BY 4.0 — but the key we hold is a SERVER key, and
// putting it in a tile URL would publish it to every browser that loads a
// report.
//
// So the tiles come through here. The browser asks this route, this route asks
// LINZ with the key, and the key stays where it belongs. It also gives one place
// to fail quietly: a missing tile returns 404 and the plan falls back to its
// plain drawing, rather than the whole card erroring over a photograph.
// ============================================================

/** Tiles are immutable for a given z/x/y — aerial capture changes yearly at best. */
const CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z, x, y } = await params;

  // Whole numbers only, and inside the pyramid. Anything else is either a bug
  // or someone using us as an open proxy for arbitrary paths.
  const zi = Number(z), xi = Number(x), yi = Number(y);
  const max = 2 ** zi;
  if (
    !Number.isInteger(zi) || !Number.isInteger(xi) || !Number.isInteger(yi) ||
    zi < 0 || zi > 22 || xi < 0 || yi < 0 || xi >= max || yi >= max
  ) {
    return new NextResponse("bad tile", { status: 400 });
  }

  // TWO SOURCES, in order of how good the picture is.
  //
  // LINZ Basemaps is the better imagery for New Zealand by a distance — urban
  // areas are flown at 5–10cm where Mapbox's global satellite layer is nearer
  // 50cm — and it is free under CC BY. But it needs its OWN key, registered at
  // basemaps.linz.govt.nz, which is NOT the LINZ Data Service key the rest of
  // this app uses for titles and parcels. Passing the data key returns
  // "API Key Invalid: malformed", and it took a cached tile to notice, because
  // some tiles also serve anonymously and looked like the key working.
  //
  // So: LINZ where a basemap key is configured, Mapbox where it isn't, and the
  // plan falls back to its plain drawing when neither answers.
  const linz = process.env.LINZ_BASEMAP_KEY?.trim();
  const mapbox = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();

  const sources = [
    linz && { name: "linz", url: `https://basemaps.linz.govt.nz/v1/tiles/aerial/EPSG:3857/${zi}/${xi}/${yi}.webp?api=${linz}` },
    mapbox && { name: "mapbox", url: `https://api.mapbox.com/v4/mapbox.satellite/${zi}/${xi}/${yi}@2x.jpg90?access_token=${mapbox}` },
  ].filter((s): s is { name: string; url: string } => !!s);

  if (sources.length === 0) return new NextResponse("no imagery source", { status: 404 });

  for (const { name, url } of sources) {
    try {
      const upstream = await fetch(url, { next: { revalidate: 604800 } });
      if (!upstream.ok) continue;
      return new NextResponse(await upstream.arrayBuffer(), {
        status: 200,
        headers: {
          "Content-Type": upstream.headers.get("content-type") ?? "image/webp",
          "Cache-Control": CACHE,
          // WHICH source answered, so the page can credit that one and not the
          // other. Two providers on different licences serve this route — LINZ
          // Basemaps under CC BY 4.0, Mapbox/Maxar under their own terms — and
          // which one a given reader got depends on config AND on whether the
          // first choice was reachable at the time. A caption naming both with
          // an "or" is a guess; crediting the wrong one is a licensing problem,
          // not a wording one. The client reads this and prints one credit.
          [IMAGERY_SOURCE_HEADER]: name,
        },
      });
    } catch {
      // Try the next source rather than failing the tile.
    }
  }
  return new NextResponse("no tile", { status: 404 });
}
