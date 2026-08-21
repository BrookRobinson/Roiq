"use client";

// ============================================================
// Landing-page map — a working tester.
//
// Fully interactive on purpose: pan it, switch between Homebuyer and Investor,
// open a pin, read a sample report. Showing what the product does beats
// describing it, and a locked preview on the landing page would ask people to
// buy something they've never seen working.
//
// It runs on the DEMO set (`demo` pins the API to the seed listings), so nothing
// here is a real person's analysis — the real map is /map, and opening those
// reports is Pro.
// ============================================================

import dynamic from "next/dynamic";
import { useState } from "react";
import Link from "next/link";

import { ModeToggle } from "@/components/map/ModeToggle";
import { MapLegend } from "@/components/map/MapLegend";
import { PropertySheet } from "@/components/map/PropertySheet";
import { DEFAULT_VARIABLES } from "@/lib/map/variables";
import type { MapMode } from "@/lib/map/types";

// Mapbox GL touches `window` — client-side only.
const PropertyMap = dynamic(() => import("@/components/map/PropertyMap").then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
      Loading map…
    </div>
  ),
});

export function MapShowcase() {
  const [mode, setMode] = useState<MapMode>("homebuyer");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <section id="the-map" className="border-b py-24 lg:py-28" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <p className="section-label">The map</p>
        <h2 className="section-heading max-w-[18ch]">See every property at a glance.</h2>
        <p className="mt-4 max-w-[62ch] text-[15px]" style={{ color: "var(--text-secondary)" }}>
          Green is under-priced, red is over. Switch to Investor and the same properties re-colour by
          five-year return instead. Have a play — these are sample properties, and every pin opens.
        </p>

        <div className="mt-10" style={{ border: "1px solid var(--rule)" }}>
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
          >
            <ModeToggle mode={mode} onChange={setMode} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sample properties
            </span>
          </div>

          <MapLegend mode={mode} />

          <div className="relative" style={{ height: "clamp(340px, 60vh, 560px)" }}>
            <PropertyMap
              mode={mode}
              vars={DEFAULT_VARIABLES}
              demo
              embedded
              onSelect={setSelected}
            />
            {selected && (
              <PropertySheet
                id={selected}
                mode={mode}
                vars={DEFAULT_VARIABLES}
                demo
                onClose={() => setSelected(null)}
              />
            )}
          </div>
        </div>

        <p className="mt-5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          The real map carries every property anyone has analysed, priced against your own deposit,
          rate and hold period.{" "}
          <Link href="/map" style={{ color: "var(--brand)" }}>
            See the live map
          </Link>{" "}
          — opening its reports is part of Pro.
        </p>
      </div>
    </section>
  );
}
