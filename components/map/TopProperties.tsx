"use client";

import { useEffect, useState } from "react";
import { Trophy, ChevronDown } from "lucide-react";
import { DEAL_HEX } from "@/lib/map/calc";
import type { DealColour, MapMode, UserVariables } from "@/lib/map/types";

/** One row of /api/map/top. */
export interface TopItem {
  id: string;
  lat: number;
  lng: number;
  address: string;
  suburb: string | null;
  city: string | null;
  askingPrice: number;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  photo: string | null;
  colour: DealColour;
  pct: number;
  valuation: number | null;
  netProfit: number;
  annualCashflow: number;
  weeklyRent: number;
}

type Scope = "view" | "all";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const signedMoney = (n: number) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`;

/**
 * "Best deals for you", along the bottom of the map: the best analysed properties, ranked by the same figure
 * that colours each pin against the reader's own numbers. Clicking one flies
 * the map to it and opens its sheet.
 *
 * The ranking lives on the server (/api/map/top), which is also where the map
 * tier is enforced — this list names addresses, which blurred pins don't.
 */
export function TopProperties({
  mode,
  vars,
  types,
  demo,
  bounds,
  onPick,
}: {
  mode: MapMode;
  vars: UserVariables;
  types: string[];
  demo: boolean;
  /** The map's visible area, for "In view". */
  bounds: string | null;
  onPick: (item: TopItem) => void;
}) {
  const [scope, setScope] = useState<Scope>("view");
  const [items, setItems] = useState<TopItem[] | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In view follows the map as it moves; debounced so a pan isn't ten requests.
  const scopeBounds = scope === "view" ? bounds : null;
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      const q = new URLSearchParams({ mode, vars: JSON.stringify(vars) });
      if (scopeBounds) q.set("bounds", scopeBounds);
      if (types.length) q.set("types", types.join(","));
      if (demo) q.set("demo", "1");
      fetch(`/api/map/top?${q}`)
        .then((r) => r.json())
        .then((d) => {
          if (!live) return;
          if (!d.ok) {
            setError(d.message ?? "Couldn't load the list.");
            setItems([]);
            return;
          }
          setError(null);
          setSeeded(!!d.seeded);
          setItems(d.top as TopItem[]);
        })
        .catch(() => live && setError("Couldn't load the list."));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [mode, vars, types.join(","), demo, scopeBounds]); // eslint-disable-line react-hooks/exhaustive-deps

  const [open, setOpen] = useState(true);
  const how =
    mode === "homebuyer"
      ? "Ranked by how far our valuation sits above the asking price"
      : `Ranked by profit over your ${vars.holdPeriodYears}-year hold, as a share of the cash you put in`;

  return (
    <section
      aria-label="Best deals for you"
      // Below the map, not over it: an overlay hid the pins along the bottom
      // and the Mapbox logo and credit, which have to stay visible.
      className="flex-shrink-0"
      style={{ background: "var(--surface)", borderTop: "1px solid var(--rule-strong)" }}
    >
      {/* Header: always visible, even folded, so the list is never hidden behind a button. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Trophy size={15} style={{ color: "var(--brand)" }} />
          <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Best deals for you
          </span>
          {items && items.length > 0 && (
            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{items.length}</span>
          )}
          <ChevronDown
            size={15}
            style={{ color: "var(--text-muted)", transform: open ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}
          />
        </button>
        <span className="hidden md:inline text-[12px]" style={{ color: "var(--text-muted)" }}>
          {how}, within your {money(vars.budget)} budget.
        </span>
        <div className="ml-auto inline-flex gap-1 p-0.5" role="group" aria-label="Where to rank" style={{ background: "var(--surface-2)", borderRadius: "var(--r-pill)" }}>
          {(
            [
              ["view", "In view"],
              ["all", "All of NZ"],
            ] as const
          ).map(([sc, label]) => (
            <button
              key={sc}
              onClick={() => setScope(sc)}
              aria-pressed={scope === sc}
              className="cursor-pointer px-3 py-1 text-[12px] font-semibold"
              style={{
                borderRadius: "var(--r-pill)",
                background: scope === sc ? "var(--accent)" : "transparent",
                color: scope === sc ? "var(--on-accent)" : "var(--text-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="pb-3">
          {seeded && !demo && (
            <p className="px-4 pb-2 text-[11px]" style={{ color: "var(--warn)" }}>
              Sample properties until real reports fill the map.
            </p>
          )}
          {items === null ? (
            <p className="px-4 py-3 text-[13px]" style={{ color: "var(--text-muted)" }}>Ranking…</p>
          ) : error ? (
            <p className="px-4 py-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>{error}</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              No analysed properties {scope === "view" ? "in this part of the map" : "yet"} within your budget and property types.
              {scope === "view" && " Zoom out, or switch to All of NZ."}
            </p>
          ) : (
            // One row of cards, scrolled sideways — the map stays visible above it.
            <ol className="flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollSnapType: "x proximity" }}>
              {items.map((it, i) => (
                <li key={it.id} className="flex-shrink-0 w-[250px]" style={{ scrollSnapAlign: "start" }}>
                  <button
                    onClick={() => onPick(it)}
                    className="card h-full w-full cursor-pointer text-left p-3 hover:opacity-90"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="mono text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>#{i + 1}</span>
                      <span
                        className="mono text-[12px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: DEAL_HEX[it.colour], color: "#050d0d" }}
                      >
                        {it.pct >= 0 ? "+" : "−"}
                        {Math.abs(it.pct)}%
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {it.address}
                    </span>
                    <span className="block truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {[it.suburb, it.city].filter(Boolean).join(", ")}
                      {it.bedrooms ? ` · ${it.bedrooms} bed` : ""}
                      {it.bathrooms ? ` · ${it.bathrooms} bath` : ""}
                    </span>
                    <span className="mt-1.5 block text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      <span className="mono">{money(it.askingPrice)}</span> asking
                    </span>
                    <span className="block text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      {mode === "homebuyer" && it.valuation != null && (
                        <>
                          Worth <span className="mono">{money(it.valuation)}</span>
                        </>
                      )}
                      {mode === "investor" && (
                        <>
                          <span className="mono">{signedMoney(it.netProfit)}</span> over {vars.holdPeriodYears} yrs
                        </>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
