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
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<MapMode>("homebuyer");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const v = loadVariables();
    if (v) {
      setVars(v);
      setMode(v.defaultMode);
    }
    setReady(true);
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

            <MapLegend mode={mode} />

            <div className="flex-1 min-h-0 relative flex">
              <PropertyMap mode={mode} vars={vars} onSelect={setSelected} />
            </div>

            {selected && <PropertySheet id={selected} mode={mode} vars={vars} onClose={() => setSelected(null)} />}
          </>
        )
      )}
    </div>
  );
}
