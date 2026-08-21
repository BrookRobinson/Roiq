"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import { Settings } from "lucide-react";
import { ModeToggle } from "@/components/map/ModeToggle";
import { MapLegend } from "@/components/map/MapLegend";
import { PropertySheet } from "@/components/map/PropertySheet";
import { VariablesScreen } from "@/components/map/VariablesScreen";
import { loadVariables } from "@/lib/map/variables";
import type { MapMode, UserVariables } from "@/lib/map/types";

// Mapbox GL touches `window` — load it client-side only.
const PropertyMap = dynamic(() => import("@/components/map/PropertyMap").then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Loading map…</div>
  ),
});

export default function MapPage() {
  const [ready, setReady] = useState(false);
  const [vars, setVars] = useState<UserVariables | null>(null);
  // Today's mortgage rate, fetched for first-time users — it drives every deal
  // colour, so starting from a stale constant would mis-colour the whole map.
  const [liveRatePct, setLiveRatePct] = useState<number | null>(null);
  const [rateNote, setRateNote] = useState<{ label: string; source: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<MapMode>("homebuyer");
  const [selected, setSelected] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const v = loadVariables();
    if (v) {
      setVars(v);
      setMode(v.defaultMode);
      setReady(true);
      return;
    }

    // No saved numbers yet. Render the setup screen straight away with its built-in
    // defaults, and fetch the current mortgage rate alongside it — the lookup is a
    // web search, and blanking the map for twenty seconds to pre-fill one field is
    // a bad trade. The screen adopts the rate when it lands.
    setReady(true);

    let live = true;
    fetch("/api/map/user-variables")
      .then((r) => r.json())
      .then((d) => {
        if (!live || !d?.interestRate || d.interestRate.isFallback) return;
        setRateNote({ label: d.interestRate.label as string, source: d.interestRate.source as string });
        setLiveRatePct(d.interestRate.ratePct as number);
      })
      .catch(() => {
        /* the screen keeps its own default rate */
      });

    return () => {
      live = false;
    };
  }, []);

  function handleSaved(v: UserVariables) {
    setVars(v);
    setMode(v.defaultMode);
    setEditing(false);
  }

  const showSetup = ready && (!vars || editing);

  return (
    <div className="flex flex-col" style={{ background: "var(--bg)", height: "100vh", overflow: "hidden" }}>
      <Navbar user={{ email: "jane@example.com" }} plan="pro" />

      {!ready ? (
        <div className="flex-1" />
      ) : showSetup ? (
        <div className="flex-1 overflow-y-auto">
          <VariablesScreen
            initial={vars}
            liveRatePct={liveRatePct}
            rateNote={rateNote?.label ?? null}
            rateSource={rateNote?.source ?? null}
            onSaved={handleSaved}
            onClose={vars ? () => setEditing(false) : undefined}
          />
        </div>
      ) : (
        vars && (
          <>
            {/* Mode toggle + settings */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <ModeToggle mode={mode} onChange={setMode} />
              <button
                onClick={() => setEditing(true)}
                className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                aria-label="Edit your variables"
              >
                <Settings size={13} /> Variables
              </button>
            </div>

            <MapLegend mode={mode} seeded={seeded} />

            <div className="flex-1 min-h-0 relative flex">
              <PropertyMap mode={mode} vars={vars} onSelect={setSelected} onSeeded={setSeeded} />
            </div>

            {selected && <PropertySheet id={selected} mode={mode} vars={vars} onClose={() => setSelected(null)} />}
          </>
        )
      )}
    </div>
  );
}
