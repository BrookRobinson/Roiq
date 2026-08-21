"use client";

import { useEffect, useState } from "react";
import { X, ChevronRight, Bookmark, BookmarkCheck, Bed, Bath } from "lucide-react";
import type { MapListing, ComputedListing, MapMode, UserVariables } from "@/lib/map/types";
import { DEAL_HEX, pctLabel } from "@/lib/map/calc";
import { loadReport } from "@/lib/report-store";
import { useSession } from "@/lib/auth/session";

interface Detail {
  listing: MapListing;
  homebuyer: ComputedListing;
  investor: ComputedListing;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`;

const WL_KEY = "roiq:map:watchlist";
function readWatchlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WL_KEY) || "[]");
  } catch {
    return [];
  }
}

export function PropertySheet({
  id,
  mode,
  vars,
  onClose,
  demo = false,
}: {
  id: string;
  mode: MapMode;
  vars: UserVariables;
  onClose: () => void;
  /** Resolve from the seeded demo set, matching a demo map. */
  demo?: boolean;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [saved, setSaved] = useState(false);
  const { isPro } = useSession();

  useEffect(() => {
    setData(null);
    const q = encodeURIComponent(JSON.stringify(vars));
    fetch(`/api/map/listings/${id}?vars=${q}${demo ? "&demo=1" : ""}`)
      .then((r) => r.json())
      .then((d) => d.ok && setData(d))
      .catch(() => {});
    setSaved(readWatchlist().includes(id));
  }, [id, vars]);

  async function save() {
    setSaved(true);
    const wl = readWatchlist();
    if (!wl.includes(id)) localStorage.setItem(WL_KEY, JSON.stringify([...wl, id]));
    try {
      await fetch("/api/map/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapListingId: id }),
      });
    } catch {
      /* saved locally regardless */
    }
  }

  const l = data?.listing;
  const c = data ? (mode === "homebuyer" ? data.homebuyer : data.investor) : null;
  // Every pin came from a real report. You can open it if you ran it, or if
  // you're on Pro — reading everyone else's analyses is what Pro is for.
  const ownReport = !!l?.fullReportId && !!loadReport(l.fullReportId);
  const hasReport = !!l?.fullReportId && (ownReport || isPro);
  const hex = c ? DEAL_HEX[c.colour] : "var(--brand)";

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 mx-auto rounded-t-2xl overflow-hidden animate-slide-up"
        style={{ maxWidth: 520, background: "var(--surface)", borderTop: "1px solid var(--border)", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)", maxHeight: "85vh" }}
      >
        {!l || !c ? (
          <div className="p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: "85vh" }}>
            {/* Photo */}
            <div className="relative h-44 w-full" style={{ background: "var(--surface-2)" }}>
              {l.photos[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.photos[0]} alt={l.address} className="w-full h-full object-cover" />
              )}
              <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }} aria-label="Close">
                <X size={16} />
              </button>
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-sm font-bold mono" style={{ background: hex, color: "#050d0d", boxShadow: `0 2px 12px ${hex}99` }}>
                {pctLabel(c.pct)}
              </div>
            </div>

            <div className="p-5">
              {/* Address + asking */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{l.address}</div>
                  <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                    {l.suburb}{l.city ? `, ${l.city}` : ""}
                    {l.bedrooms != null && <span className="flex items-center gap-1"><Bed size={11} />{l.bedrooms}</span>}
                    {l.bathrooms != null && <span className="flex items-center gap-1"><Bath size={11} />{l.bathrooms}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold mono" style={{ color: "var(--text-primary)" }}>{money(l.askingPrice)}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Asking</div>
                </div>
              </div>

              <div className="my-4 h-px" style={{ background: "var(--border)" }} />

              {mode === "homebuyer" ? (
                <div className="space-y-2.5">
                  <Row label="BDR Score" value={`${l.roiqScore}/1000`} />
                  <Row label="BDR Valuation" value={money(c.roiqValuation)} />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>vs Asking Price</span>
                    <span className="text-sm font-bold mono px-2 py-0.5 rounded-md" style={{ color: hex, background: `${hex}1a` }}>
                      {pctLabel(c.valuationGapPct)}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{homebuyerNote(c.valuationGapPct)}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <Row label="BDR Score" value={`${l.roiqScore}/1000`} />
                  <Row label="Adjusted buy-in" value={money(c.adjustedBuyIn)} hint="asking + repairs" />
                  <Row label="Est. weekly rent" value={`${money(c.weeklyRent)}/wk`} />
                  <Row label="Annual cashflow" value={signed(c.annualCashflow)} valueColor={c.annualCashflow >= 0 ? "var(--good)" : "var(--bad)"} />
                  <Row label={`${c.holdYears}-year capital gain`} value={signed(c.capitalGain)} />
                  <Row label={`${c.holdYears}-year net profit`} value={signed(c.netProfit)} valueColor={hex} bold />
                  <Row label={`${c.holdYears}-yr return on deposit`} value={`${Math.round(c.returnOnDepositPct)}%`} valueColor={hex} />

                  {Object.keys(l.repairBreakdown).length > 0 && (
                    <div className="mt-3 rounded-lg p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      <div className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Repair allowances added to buy-in</div>
                      <div className="space-y-1">
                        {Object.entries(l.repairBreakdown).map(([name, cost]) => (
                          <div key={name} className="flex items-center justify-between text-xs">
                            <span style={{ color: "var(--text-muted)" }}>{name}</span>
                            <span className="mono" style={{ color: "var(--text-secondary)" }}>{signed(cost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-5">
                {/* The demo map is a showcase, so its pins open the sample report
                    rather than dead-ending. Otherwise: it's yours or you're Pro
                    (open it), it exists but you're not Pro (sell the upgrade), or
                    there's no report behind this pin (offer to run one). Never link
                    to a report the viewer can't open — /report/[id] would fall
                    through to the DEMO report and present it as this property. */}
                <a
                  href={
                    demo
                      ? "/report/rpt_001"
                      : hasReport
                        ? `/report/${l.fullReportId}`
                        : l.fullReportId
                          ? "/pricing?plan=pro"
                          : "/report/new"
                  }
                  className="btn-primary flex-1 justify-center py-2 text-sm"
                >
                  {demo
                    ? "View sample report"
                    : hasReport
                      ? "View full report"
                      : l.fullReportId
                        ? "Unlock with Pro"
                        : "Run this report"}{" "}
                  <ChevronRight size={14} />
                </a>
                <button onClick={save} className="btn-secondary py-2 px-3 text-sm gap-1.5" style={saved ? { color: "var(--green)", borderColor: "var(--good-wash)" } : undefined}>
                  {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                  {saved ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ label, value, hint, valueColor, bold }: { label: string; value: string; hint?: string; valueColor?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label} {hint && <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {hint}</span>}
      </span>
      <span className={`mono ${bold ? "text-base font-bold" : "text-sm font-semibold"}`} style={{ color: valueColor ?? "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function homebuyerNote(gap: number): string {
  const g = Math.round(gap);
  if (g > 15) return `Great deal — BDR values it ${g}% above the asking price.`;
  if (g < -15) return `Overpriced — BDR values it ${Math.abs(g)}% below the asking price.`;
  return "Fair price — close to BDR Report's estimated value.";
}
