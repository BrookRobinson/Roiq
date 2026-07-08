"use client";

import { Home, TrendingUp } from "lucide-react";
import type { MapMode } from "@/lib/map/types";

export function ModeToggle({ mode, onChange }: { mode: MapMode; onChange: (m: MapMode) => void }) {
  return (
    <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      {(["homebuyer", "investor"] as MapMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all"
          style={{
            background: mode === m ? "var(--brand-light)" : "transparent",
            color: mode === m ? "var(--brand)" : "var(--text-muted)",
            boxShadow: mode === m ? "0 0 8px var(--brand-glow)" : "none",
          }}
        >
          {m === "homebuyer" ? <Home size={12} /> : <TrendingUp size={12} />}
          {m === "homebuyer" ? "Homebuyer" : "Investor"}
        </button>
      ))}
    </div>
  );
}
