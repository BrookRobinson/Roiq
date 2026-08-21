"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PropertySheet } from "@/components/map/PropertySheet";
import { DEAL_HEX } from "@/lib/map/calc";
import { DEFAULT_VARIABLES } from "@/lib/map/variables";
import type { MapMode } from "@/lib/map/types";
import { ArrowRight } from "lucide-react";

/**
 * The live map, embedded on the landing page.
 *
 * This is the same PropertyMap that runs at /map: real clustering, real deal
 * colours, real property sheets. Pan it, zoom it, click a cluster to drill in,
 * click a pin to open the property.
 *
 * Two things are deliberately constrained for a landing context:
 *
 *  1. `demo` pins every request to the seeded demo listings via `&demo=1`, so
 *     the public preview shows the curated set and never real inventory, even
 *     once the database is carrying live listings.
 *  2. `embedded` turns on Mapbox cooperative gestures: a plain wheel scroll
 *     moves the page, and only ctrl/cmd + wheel zooms the map. An embedded map
 *     that swallows the scroll the moment the cursor crosses it is one of the
 *     most reliable ways to make a landing page infuriating.
 */
/**
 * mapbox-gl touches `window` at module scope and cannot be server-rendered,
 * so the map is loaded client-side only. This mirrors how /map imports it;
 * a plain static import throws "Cannot read properties of undefined" during
 * SSR and takes the whole landing page down with it.
 */
const PropertyMap = dynamic(
  () => import("@/components/map/PropertyMap").then((m) => m.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full" style={{ background: "var(--surface-2)" }} />
    ),
  }
);

export function LiveMapSection() {
  const [mode, setMode] = useState<MapMode>("homebuyer");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    // Anchored: the locked map at /map links back here with "play with the sample map".
    <section id="the-map" className="border-b" style={{ borderColor: "var(--border)" }}>
      <div className="grid lg:grid-cols-2">
        <div className="flex items-center px-4 py-20 sm:px-6 lg:px-16 lg:py-24">
          <div>
            <h2 className="section-heading max-w-[16ch]">Every listing, on one map</h2>
            <p className="section-sub mt-5">
              Filter the country by budget and by what you are optimising for,
              then read the ten year position on any pin before you shortlist it.
            </p>

            <p
              className="mt-6 text-[13px] font-semibold"
              style={{ color: "var(--accent-text)" }}
            >
              Try it: click a cluster to zoom in, then a pin to open the property.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <ModeToggle mode={mode} onChange={setMode} />
            </div>

            {/* Goes to the demo map, not the real one: the same experience end to
                end — including setting your own deposit, rate and hold period —
                but on demo listings, so it's driveable without an account. */}
            <Link href="/map/demo" className="btn-secondary mt-7 px-5 py-3 text-[15px]">
              Open Demo Map
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[420px] lg:min-h-[600px]">
          <PropertyMap
            mode={mode}
            vars={DEFAULT_VARIABLES}
            onSelect={setSelected}
            demo
            embedded
          />

          <Legend />

          <span
            className="pointer-events-none absolute left-4 top-4 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{
              background: "rgba(10,10,12,0.72)",
              color: "rgba(255,255,255,0.82)",
              borderRadius: "var(--r-pill)",
              border: "1px solid rgba(255,255,255,0.14)",
            }}
          >
            Demo listings
          </span>
        </div>
      </div>

      {selected && (
        <PropertySheet
          id={selected}
          mode={mode}
          vars={DEFAULT_VARIABLES}
          onClose={() => setSelected(null)}
          demo
        />
      )}
    </section>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: MapMode;
  onChange: (m: MapMode) => void;
}) {
  return (
    <div
      className="flex gap-1 p-1"
      role="group"
      aria-label="Map scoring mode"
      style={{ background: "var(--surface-2)", borderRadius: "var(--r-pill)" }}
    >
      {(
        [
          ["homebuyer", "Home buyer"],
          ["investor", "Investor"],
        ] as const
      ).map(([m, label]) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            aria-pressed={active}
            className="cursor-pointer px-4 py-2 text-[13px] font-bold transition-all"
            style={{
              borderRadius: "var(--r-pill)",
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--on-accent)" : "var(--text-muted)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div
      className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3"
      style={{
        background: "rgba(10,10,12,0.78)",
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
  );
}
