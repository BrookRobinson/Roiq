"use client";

import { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";
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
 * "Top for you": the map's best analysed properties, ranked by the same figure
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
  onClose,
}: {
  mode: MapMode;
  vars: UserVariables;
  types: string[];
  demo: boolean;
  /** The map's visible area, for "In view". */
  bounds: string | null;
  onPick: (item: TopItem) => void;
  onClose: () => void;
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

  const how =
    mode === "homebuyer"
      ? "Ranked by how far our valuation sits above the asking price."
      : `Ranked by profit over your ${vars.holdPeriodYears}-year hold, as a share of the cash you put in — using your deposit, rate and costs.`;

  return (
    <aside
      aria-label="Top properties for you"
      className="absolute z-10 flex flex-col inset-x-2 bottom-2 max-h-[60%] sm:inset-x-auto sm:left-3 sm:top-3 sm:bottom-3 sm:max-h-none sm:w-[360px]"
      style={{ background: "var(--surface)", border: "1px solid var(--rule-strong)", boxShadow: "0 12px 32px rgba(0,0,0,0.28)" }}
    >
      <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy size={15} style={{ color: "var(--brand)" }} />
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Top for you
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close the list" className="cursor-pointer p-1" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
          {how} Within your {money(vars.budget)} budget.
        </p>
        <div className="mt-2.5 inline-flex gap-1 p-0.5" role="group" aria-label="Where to rank" style={{ background: "var(--surface-2)", borderRadius: "var(--r-pill)" }}>
          {(
            [
              ["view", "In view"],
              ["all", "All of NZ"],
            ] as const
          ).map(([s, label]) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className="cursor-pointer px-3 py-1 text-[12px] font-semibold"
              style={{
                borderRadius: "var(--r-pill)",
                background: scope === s ? "var(--accent)" : "transparent",
                color: scope === s ? "var(--on-accent)" : "var(--text-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {seeded && !demo && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--warn)" }}>
            Sample properties until real reports fill the map.
          </p>
        )}
      </div>

      <ol className="flex-1 overflow-y-auto">
        {items === null ? (
          <li className="px-4 py-6 text-[13px]" style={{ color: "var(--text-muted)" }}>Ranking…</li>
        ) : error ? (
          <li className="px-4 py-6 text-[13px]" style={{ color: "var(--text-secondary)" }}>{error}</li>
        ) : items.length === 0 ? (
          <li className="px-4 py-6 text-[13px]" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
            No analysed properties {scope === "view" ? "in this part of the map" : "yet"} within your budget.
            {scope === "view" && " Zoom out, or switch to All of NZ."}
          </li>
        ) : (
          items.map((it, i) => (
            <li key={it.id}>
              <button
                onClick={() => onPick(it)}
                className="w-full cursor-pointer text-left px-4 py-3 flex items-start gap-3 hover:opacity-80"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <span className="mono text-[13px] font-semibold w-5 flex-shrink-0 pt-0.5" style={{ color: "var(--text-muted)" }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {it.address}
                  </span>
                  <span className="block truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {[it.suburb, it.city].filter(Boolean).join(", ")}
                    {it.bedrooms ? ` · ${it.bedrooms} bed` : ""}
                    {it.bathrooms ? ` · ${it.bathrooms} bath` : ""}
                  </span>
                  <span className="mt-1 block text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    <span className="mono">{money(it.askingPrice)}</span> asking
                    {mode === "homebuyer" && it.valuation != null && (
                      <>
                        {" · worth "}
                        <span className="mono">{money(it.valuation)}</span>
                      </>
                    )}
                    {mode === "investor" && (
                      <>
                        {" · "}
                        <span className="mono">{signedMoney(it.netProfit)}</span> over {vars.holdPeriodYears} yrs
                      </>
                    )}
                  </span>
                </span>
                <span
                  className="mono flex-shrink-0 text-[12px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: DEAL_HEX[it.colour], color: "#050d0d" }}
                >
                  {it.pct >= 0 ? "+" : "−"}
                  {Math.abs(it.pct)}%
                </span>
              </button>
            </li>
          ))
        )}
      </ol>
    </aside>
  );
}
