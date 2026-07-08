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
}: {
  mode: MapMode;
  vars: UserVariables;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  // Keep the latest mode/vars in refs so map event handlers read current values.
  const modeRef = useRef(mode);
  const varsRef = useRef(vars);
  modeRef.current = mode;
  varsRef.current = vars;

  async function refresh() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const b = map.getBounds();
    if (!b) return;
    const bounds = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
    const q = encodeURIComponent(JSON.stringify(varsRef.current));
    try {
      const res = await fetch(`/api/map/listings?mode=${modeRef.current}&bounds=${bounds}&vars=${q}`);
      const data = await res.json();
      if (!data.ok) return;
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
    });
    mapRef.current = map;
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
          "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 15, 30],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#050d0d",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "listings",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
        paint: { "text-color": "#050d0d" },
      });

      // Unclustered marker — coloured dot with its %.
      map.addLayer({
        id: "point",
        type: "circle",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": POINT_COLOUR,
          "circle-radius": 15,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#050d0d",
        },
      });
      map.addLayer({
        id: "point-label",
        type: "symbol",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        layout: { "text-field": ["get", "label"], "text-size": 10, "text-allow-overlap": true },
        paint: { "text-color": "#050d0d" },
      });

      // Interactions.
      map.on("click", "clusters", (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        if (!f) return;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom: Math.min(map.getZoom() + 2, 14) });
      });
      const openPoint = (e: mapboxgl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelect(String(id));
      };
      map.on("click", "point", openPoint);
      map.on("click", "point-label", openPoint);
      for (const layer of ["clusters", "point", "point-label"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }

      loadedRef.current = true;
      refresh();
      map.on("moveend", refresh);
    });

    return () => {
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
