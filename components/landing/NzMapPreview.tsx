import Image from "next/image";
import { SEED_LISTINGS } from "@/lib/map/seed";
import { computeListing, DEAL_HEX } from "@/lib/map/calc";
import { DEFAULT_VARIABLES } from "@/lib/map/variables";
import type { DealColour } from "@/lib/map/types";

/**
 * The NZ map as the product actually renders it.
 *
 * A Mapbox Static Images render using the same style and framing as the live
 * map in components/map/PropertyMap (dark-v11, centred on New Zealand), with
 * markers driven by the real seeded listings and their real computed deal
 * colours. The geography and the verdicts are both the product's own output.
 *
 * Markers are CLUSTERED BY CITY rather than one pin per listing, which is what
 * the live map does at this zoom: 20 individual pins at national scale land on
 * top of each other, and the topmost one wins, so the map would show a single
 * arbitrary colour while the legend claimed three. One marker per city, carrying
 * its listing count and the cluster's dominant verdict, is both legible and true.
 *
 * Static rather than the live Mapbox GL map on purpose: the real map is ~800KB
 * of JS and would capture the page's scroll under the cursor, which is the wrong
 * trade for a landing section. The interactive version is one click away at /map.
 */

const MAP_STYLE = "dark-v11";
const CENTRE = { lng: 173.3, lat: -40.9, zoom: 4.55 };
const SIZE = { w: 1000, h: 820 };

type Cluster = { city: string; lat: number; lng: number; count: number; colour: DealColour };

/** Group the seeded listings the way the live map clusters them. */
function buildClusters(): Cluster[] {
  const byCity = new Map<string, { lat: number[]; lng: number[]; colours: DealColour[] }>();

  for (const l of SEED_LISTINGS) {
    const { colour } = computeListing(l, DEFAULT_VARIABLES, "investor");
    const city = l.city ?? l.region ?? "New Zealand";
    const g = byCity.get(city) ?? { lat: [], lng: [], colours: [] };
    g.lat.push(l.lat);
    g.lng.push(l.lng);
    g.colours.push(colour);
    byCity.set(city, g);
  }

  const mean = (n: number[]) => n.reduce((a, b) => a + b, 0) / n.length;

  return [...byCity.entries()].map(([city, g]) => {
    // Dominant verdict in the cluster, ties broken toward the worse outcome so
    // the map never flatters a group of listings.
    const order: DealColour[] = ["red", "orange", "green"];
    const counts = new Map<DealColour, number>();
    g.colours.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
    const colour = order.reduce((best, c) =>
      (counts.get(c) ?? 0) > (counts.get(best) ?? 0) ? c : best
    , order[0]);

    return { city, lat: mean(g.lat), lng: mean(g.lng), count: g.colours.length, colour };
  });
}

function buildStaticMapUrl(token: string, clusters: Cluster[]): string {
  const markers = clusters
    .map((c) => {
      const hex = DEAL_HEX[c.colour].replace("#", "");
      // Static markers take a single alphanumeric label, which covers counts
      // up to 9; anything larger drops the label rather than showing junk.
      const label = c.count <= 9 ? `-${c.count}` : "";
      return `pin-l${label}+${hex}(${c.lng.toFixed(4)},${c.lat.toFixed(4)})`;
    })
    .join(",");

  return (
    `https://api.mapbox.com/styles/v1/mapbox/${MAP_STYLE}/static/${markers}/` +
    `${CENTRE.lng},${CENTRE.lat},${CENTRE.zoom},0/${SIZE.w}x${SIZE.h}@2x` +
    `?access_token=${token}&logo=false&attribution=false`
  );
}

export function NzMapPreview() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <div
        className="flex h-full min-h-[320px] w-full items-center justify-center p-8 text-center"
        style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
      >
        <span className="text-sm">
          Map preview unavailable: NEXT_PUBLIC_MAPBOX_TOKEN is not set.
        </span>
      </div>
    );
  }

  const clusters = buildClusters();
  const total = SEED_LISTINGS.length;

  return (
    <div className="relative h-full min-h-[340px] w-full overflow-hidden">
      <Image
        src={buildStaticMapUrl(token, clusters)}
        alt={`Map of New Zealand with ${total} scored listings clustered across ${clusters
          .map((c) => c.city)
          .join(", ")}`}
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
      />

      {/* Legend. It sits on the map because it explains the markers, which is
          the one case where an overlay earns its place. */}
      <div
        className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3 sm:right-auto"
        style={{
          background: "rgba(10, 10, 12, 0.78)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: "var(--r-input)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {(
          [
            { c: DEAL_HEX.green, label: "Under valuation" },
            { c: DEAL_HEX.orange, label: "Near fair" },
            { c: DEAL_HEX.red, label: "Over the odds" },
          ] as const
        ).map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ background: row.c }}
              aria-hidden="true"
            />
            <span
              className="text-[12px] font-medium"
              style={{ color: "rgba(255,255,255,0.88)" }}
            >
              {row.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
