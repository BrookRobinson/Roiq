"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapMode, UserVariables } from "@/lib/map/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// Dominant-colour expression for a cluster from the g/o/r counts (green > orange > red on ties).
const CLUSTER_COLOUR: mapboxgl.Expression = [
  "case",
  [">=", ["get", "g"], ["max", ["get", "o"], ["get", "r"]]], "#00e676",
  [">=", ["get", "o"], ["get", "r"]], "#fbbf24",
  "#ff5f5f",
];
const POINT_COLOUR: mapboxgl.Expression = [
  "match", ["get", "colour"], "green", "#00e676", "orange", "#fbbf24", "red", "#ff5f5f", "#fbbf24",
];

export function PropertyMap({
  mode,
  vars,
  onSelect,
  onSeeded,
  onLocked,
  teaser = false,
  demo = false,
  embedded = false,
}: {
  mode: MapMode;
  vars: UserVariables;
  onSelect: (id: string) => void;
  /** Reports whether the pins on screen are the demo set rather than real ones. */
  onSeeded?: (seeded: boolean) => void;
  /**
   * Locked preview: real pins, but softened and unlabelled, and clicking one asks
   * for an upgrade instead of opening it. Enough to show the map is alive and
   * where the activity is, without giving away the readings that are the product.
   * Must be settled before mount — the layers are built once.
   */
  teaser?: boolean;
  /** Called when a locked pin is clicked. */
  onLocked?: () => void;
  /** Pin the map to the seeded demo listings, never the database. */
  demo?: boolean;
  /**
   * Embedded in a scrolling page rather than filling a dedicated route.
   * Turns on Mapbox cooperative gestures, so a plain wheel scroll moves the
   * PAGE and only ctrl/cmd + wheel zooms the map. Without this an embedded
   * map swallows the scroll as soon as the cursor crosses it.
   */
  embedded?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  // Keep the latest mode/vars in refs so map event handlers read current values.
  const modeRef = useRef(mode);
  const varsRef = useRef(vars);
  const demoRef = useRef(demo);
  modeRef.current = mode;
  varsRef.current = vars;
  demoRef.current = demo;
  const teaserRef = useRef(teaser);
  teaserRef.current = teaser;
  const onLockedRef = useRef(onLocked);
  onLockedRef.current = onLocked;

  async function refresh() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const b = map.getBounds();
    if (!b) return;
    const bounds = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
    const q = encodeURIComponent(JSON.stringify(varsRef.current));
    try {
      const res = await fetch(
        `/api/map/listings?mode=${modeRef.current}&bounds=${bounds}&vars=${q}${demoRef.current ? "&demo=1" : ""}`
      );
      const data = await res.json();
      if (!data.ok) return;
      onSeeded?.(!!data.seeded);
      const fc = {
        type: "FeatureCollection" as const,
        features: data.listings.map((l: { id: string; lat: number; lng: number; colour: string; pct: number }) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
          properties: { id: l.id, colour: l.colour, label: `${l.pct >= 0 ? "+" : "−"}${Math.abs(l.pct)}%` },
        })),
      };
      const src = map.getSource("listings") as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(fc);
    } catch {
      /* transient — next moveend retries */
    }
  }

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [173.5, -41.2],
      zoom: 4.6,
      attributionControl: false,
      cooperativeGestures: embedded,
    });
    mapRef.current = map;

    // Keep the canvas matched to its (flex / dynamically-loaded) container.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("listings", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 12,
        clusterProperties: {
          g: ["+", ["case", ["==", ["get", "colour"], "green"], 1, 0]],
          o: ["+", ["case", ["==", ["get", "colour"], "orange"], 1, 0]],
          r: ["+", ["case", ["==", ["get", "colour"], "red"], 1, 0]],
        },
      });

      // Cluster bubble — dominant colour, size by count.
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "listings",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": CLUSTER_COLOUR,
          "circle-opacity": 0.9,
          ...(teaser ? { "circle-blur": 0.45 } : {}),
          "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 15, 30],
          "circle-stroke-width": teaser ? 0 : 2,
          "circle-stroke-color": "#050d0d",
        },
      });
      // The counts and the deal % ARE the product — a locked map shows where the
      // activity is, not what it says.
      if (!teaser) {
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "listings",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
          paint: { "text-color": "#050d0d" },
        });
      }

      // Unclustered marker — coloured dot with its %.
      map.addLayer({
        id: "point",
        type: "circle",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": POINT_COLOUR,
          "circle-radius": 15,
          ...(teaser ? { "circle-blur": 0.55 } : {}),
          "circle-stroke-width": teaser ? 0 : 1.5,
          "circle-stroke-color": "#050d0d",
        },
      });
      if (!teaser) {
        map.addLayer({
          id: "point-label",
          type: "symbol",
          source: "listings",
          filter: ["!", ["has", "point_count"]],
          layout: { "text-field": ["get", "label"], "text-size": 10, "text-allow-overlap": true },
          paint: { "text-color": "#050d0d" },
        });
      }

      // Interactions.
      map.on("click", "clusters", (e) => {
        // Zooming into a cluster is how you'd find the individual pins, so a
        // locked map asks for the upgrade here too rather than letting someone
        // drill down to the detail it's meant to be withholding.
        if (teaserRef.current) {
          onLockedRef.current?.();
          return;
        }
        const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        if (!f) return;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom: Math.min(map.getZoom() + 2, 14) });
      });
      const openPoint = (e: mapboxgl.MapLayerMouseEvent) => {
        if (teaserRef.current) {
          onLockedRef.current?.();
          return;
        }
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelect(String(id));
      };
      map.on("click", "point", openPoint);
      if (!teaser) map.on("click", "point-label", openPoint);
      for (const layer of teaser ? ["clusters", "point"] : ["clusters", "point", "point-label"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }

      map.resize();
      loadedRef.current = true;
      refresh();
      map.on("moveend", refresh);
    });

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-colour when the mode or the user's variables change.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, vars]);

  if (!TOKEN) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8" style={{ color: "var(--text-muted)" }}>
        <p className="text-sm">Map unavailable — set <code className="mono">NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code className="mono">.env.local</code>.</p>
      </div>
    );
  }

  return <div ref={containerRef} className="flex-1 w-full h-full" />;
}
