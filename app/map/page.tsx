"use client";

import Navbar from "@/components/Navbar";
import { useState, useMemo } from "react";
import { Filter, X, Bell, Bookmark, ChevronRight, TrendingUp, Home, Users } from "lucide-react";

type MapMode = "buyer" | "investor";
type RentalType = "longterm" | "shortterm" | "compare";

const MOCK_LISTINGS = [
  { id: 1, address: "14 Ferndale Rd, Remuera", price: 1_150_000, score: 724, vfmGrade: "B+", weeklyRent: 1_060, airbnbMonthly: 4_200, growthRate: 0.045, beds: 3, type: "House",     x: 35, y: 42 },
  { id: 2, address: "7 Orakei Rd, Orakei",     price:   980_000, score: 811, vfmGrade: "A+", weeklyRent:   900, airbnbMonthly: 3_800, growthRate: 0.042, beds: 4, type: "House",     x: 55, y: 30 },
  { id: 3, address: "Unit 4/22 Willis St, Wgtn",price:  495_000, score: 541, vfmGrade: "C+", weeklyRent:   580, airbnbMonthly: 2_800, growthRate: 0.038, beds: 2, type: "Apartment", x: 25, y: 60 },
  { id: 4, address: "88 Beach Rd, Sumner",      price:   720_000, score: 612, vfmGrade: "A",  weeklyRent:   700, airbnbMonthly: 3_200, growthRate: 0.041, beds: 4, type: "House",     x: 70, y: 65 },
  { id: 5, address: "37 Victoria St W, CBD",    price:   680_000, score: 438, vfmGrade: "D",  weeklyRent:   600, airbnbMonthly: 3_800, growthRate: 0.035, beds: 1, type: "Apartment", x: 80, y: 25 },
  { id: 6, address: "12 Marine Pde, Napier",    price:   545_000, score: 668, vfmGrade: "B",  weeklyRent:   520, airbnbMonthly: 2_100, growthRate: 0.040, beds: 3, type: "House",     x: 60, y: 50 },
  { id: 7, address: "3 Rata St, Hamilton",      price:   625_000, score: 724, vfmGrade: "A+", weeklyRent:   620, airbnbMonthly: 2_400, growthRate: 0.044, beds: 4, type: "House",     x: 45, y: 38 },
];

const DEPOSIT_PCT   = 0.30;
const VACANCY       = 0.03;
const MGMT_FEE      = 0.09;
const RATES_ANNUAL  = 3_500;
const INSURANCE_ANN = 2_000;
const MAINTENANCE_PCT = 0.01;

function calcProfit(listing: typeof MOCK_LISTINGS[0], holdYears: number, rentalType: RentalType): number {
  const deposit = listing.price * DEPOSIT_PCT;
  const loan    = listing.price - deposit;
  const rate    = 0.063;
  const capitalGain = listing.price * (Math.pow(1 + listing.growthRate, holdYears) - 1);

  const annualRent = rentalType === "shortterm"
    ? listing.airbnbMonthly * 12 * 0.72  // ~72% occupancy assumed
    : listing.weeklyRent * 52;

  const netRent      = annualRent * (1 - VACANCY) * (1 - MGMT_FEE);
  const totalRent    = netRent * holdYears;
  const annualCosts  = RATES_ANNUAL + INSURANCE_ANN + listing.price * MAINTENANCE_PCT;
  const totalCosts   = annualCosts * holdYears;
  const totalInterest= loan * rate * holdYears * 0.55; // rough interest
  return Math.round(capitalGain + totalRent - totalCosts - totalInterest);
}

function calcGrossYield(listing: typeof MOCK_LISTINGS[0], rentalType: RentalType): number {
  const annualRent = rentalType === "shortterm"
    ? listing.airbnbMonthly * 12 * 0.72
    : listing.weeklyRent * 52;
  return (annualRent / listing.price) * 100;
}

function profitColor(profit: number): string {
  if (profit > 100_000) return "#00e676";
  if (profit > 50_000)  return "#00d4c8";
  if (profit > 20_000)  return "#38bdf8";
  if (profit > 0)       return "#fbbf24";
  return "#ff5f5f";
}

const vfmColor: Record<string, string> = {
  "A+": "#00e676", "A": "#2dd4bf", "B+": "#00d4c8",
  "B":  "#38bdf8", "C+": "#fbbf24", "C": "#fb923c", "D": "#ff5f5f",
};

export default function MapPage() {
  const [mode, setMode]           = useState<MapMode>("investor");
  const [holdYears, setHoldYears] = useState(10);
  const [rentalType, setRentalType] = useState<RentalType>("longterm");
  const [selected, setSelected]   = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [minYield, setMinYield]   = useState(0);
  const [maxPrice, setMaxPrice]   = useState(2_000_000);

  const filtered = useMemo(() =>
    MOCK_LISTINGS.filter((l) => {
      if (l.price > maxPrice) return false;
      if (calcGrossYield(l, rentalType) < minYield) return false;
      return true;
    }),
    [maxPrice, minYield, rentalType]
  );

  const selectedListing = MOCK_LISTINGS.find((l) => l.id === selected);

  function pinColor(l: typeof MOCK_LISTINGS[0]): string {
    if (mode === "buyer") return vfmColor[l.vfmGrade] ?? "#fbbf24";
    return profitColor(calcProfit(l, holdYears, rentalType));
  }

  function pinLabel(l: typeof MOCK_LISTINGS[0]): string {
    if (mode === "buyer") return l.vfmGrade;
    const profit = calcProfit(l, holdYears, rentalType);
    return profit >= 0 ? `+$${Math.round(profit / 1000)}k` : `-$${Math.round(Math.abs(profit) / 1000)}k`;
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar user={{ email: "jane@example.com" }} plan="pro" />

      {/* Mode toggle bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {(["buyer", "investor"] as MapMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all capitalize"
              style={{
                background: mode === m ? "var(--brand-light)" : "transparent",
                color:      mode === m ? "var(--brand)"       : "var(--text-muted)",
                boxShadow:  mode === m ? "0 0 8px var(--brand-glow)" : "none",
              }}
            >
              {m === "buyer" ? <Home size={12} /> : <TrendingUp size={12} />}
              {m === "buyer" ? "Home Buyer Map" : "Investor Map"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Investor: hold period + rental type */}
          {mode === "investor" && (
            <>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Hold:</span>
                <input
                  type="range" min={1} max={40} value={holdYears}
                  onChange={(e) => setHoldYears(Number(e.target.value))}
                  style={{ accentColor: "var(--brand)", width: 100 }}
                  className="cursor-pointer"
                />
                <span className="text-xs font-bold mono" style={{ color: "var(--brand)", minWidth: 28 }}>
                  {holdYears}yr
                </span>
              </div>

              <div className="hidden sm:flex rounded-lg p-0.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                {(["longterm", "shortterm", "compare"] as RentalType[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRentalType(r)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                    style={{
                      background: rentalType === r ? "var(--surface)" : "transparent",
                      color:      rentalType === r ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                  >
                    {r === "longterm" ? "Long-term" : r === "shortterm" ? "Airbnb" : "Compare"}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
          >
            <Filter size={12} />
            Filters
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div
          className="px-4 py-3 border-b flex flex-wrap items-center gap-4"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Max price:
            </label>
            <select
              className="input text-xs py-1 px-2"
              style={{ width: 120 }}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            >
              {[500_000, 750_000, 1_000_000, 1_500_000, 2_000_000].map((v) => (
                <option key={v} value={v}>${(v / 1_000)}k</option>
              ))}
            </select>
          </div>
          {mode === "investor" && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Min yield:
              </label>
              <select
                className="input text-xs py-1 px-2"
                style={{ width: 90 }}
                value={minYield}
                onChange={(e) => setMinYield(Number(e.target.value))}
              >
                {[0, 3, 4, 5, 6].map((v) => (
                  <option key={v} value={v}>{v === 0 ? "Any" : `${v}%+`}</option>
                ))}
              </select>
            </div>
          )}
          <button className="text-xs cursor-pointer" style={{ color: "var(--text-muted)" }} onClick={() => { setMaxPrice(2_000_000); setMinYield(0); }}>
            Clear filters
          </button>
        </div>
      )}

      <div className="flex h-[calc(100vh-130px)]">
        {/* Sidebar */}
        <div
          className="w-80 flex-shrink-0 flex flex-col overflow-hidden hidden lg:flex"
          style={{ borderRight: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <div className="p-3 text-xs font-medium" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
            {filtered.length} listings ·{" "}
            {mode === "investor"
              ? `Profit shown at ${holdYears}-year hold · ${rentalType === "shortterm" ? "Airbnb" : "Long-term"}`
              : "Colour by VFM grade"}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((l) => {
              const profit = calcProfit(l, holdYears, rentalType);
              const yld    = calcGrossYield(l, rentalType);
              const color  = pinColor(l);
              return (
                <button
                  key={l.id}
                  onClick={() => setSelected(l.id === selected ? null : l.id)}
                  className="w-full text-left p-4 transition-colors cursor-pointer"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: selected === l.id ? "var(--brand-light)" : "transparent",
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {l.address}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mono"
                      style={{ background: `${color}18`, color }}>
                      {mode === "buyer" ? l.vfmGrade : (profit >= 0 ? "+" : "") + "$" + Math.round(profit / 1000) + "k"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>${(l.price / 1000).toFixed(0)}k</span>
                    <span>·</span>
                    <span>{l.beds}bd</span>
                    <span>·</span>
                    <span className="font-medium" style={{ color: "var(--green)" }}>
                      {yld.toFixed(1)}% yield
                    </span>
                    {mode === "investor" && rentalType !== "longterm" && (
                      <>
                        <span>·</span>
                        <span style={{ color: "#fbbf24" }}>
                          Airbnb ${Math.round(l.airbnbMonthly / 100) * 100}/mo
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative overflow-hidden">
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #050d0d 0%, #091e1c 50%, #050d0d 100%)" }}>
            {/* Grid */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.05]" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="mapgrid" width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M 8 0 L 0 0 0 8" fill="none" stroke="var(--brand)" strokeWidth="0.3" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#mapgrid)" />
            </svg>

            {/* NZ outline */}
            <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              <path d="M55 20 Q60 18 63 22 Q67 28 65 38 Q62 50 60 55 Q57 62 55 65 Q52 60 50 55 Q48 45 50 35 Q52 25 55 20Z"
                fill="none" stroke="var(--brand)" strokeWidth="0.6" />
              <path d="M52 68 Q56 66 60 70 Q63 74 62 82 Q60 88 57 90 Q53 92 50 88 Q47 82 48 76 Q50 70 52 68Z"
                fill="none" stroke="var(--brand)" strokeWidth="0.6" />
            </svg>

            {/* Pins */}
            {filtered.map((l) => {
              const color  = pinColor(l);
              const label  = pinLabel(l);
              return (
                <div key={l.id} className="absolute cursor-pointer group"
                  style={{ left: `${l.x}%`, top: `${l.y}%`, transform: "translate(-50%, -100%)", zIndex: selected === l.id ? 20 : 10 }}
                  onClick={() => setSelected(l.id === selected ? null : l.id)}>
                  <div
                    className="px-2 py-1 rounded-full text-xs font-bold transition-transform group-hover:scale-110 mono"
                    style={{
                      background: color, color: "#050d0d",
                      boxShadow: `0 2px 12px ${color}88`,
                      fontSize: mode === "investor" ? 10 : 12,
                      transform: selected === l.id ? "scale(1.15)" : "",
                    }}
                  >
                    {label}
                  </div>
                  <div className="w-px h-2.5 mx-auto" style={{ background: color, opacity: 0.6 }} />
                  <div className="w-1.5 h-1.5 rounded-full mx-auto" style={{ background: color }} />

                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 12px", boxShadow: "0 0 0 1px var(--glass-border)" }}>
                    <div className="text-xs font-bold mono" style={{ color: "var(--text-primary)" }}>
                      ${(l.price / 1000).toFixed(0)}k · {calcGrossYield(l, rentalType).toFixed(1)}% yield
                    </div>
                    {mode === "investor" && (
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {holdYears}yr profit: {calcProfit(l, holdYears, rentalType) >= 0 ? "+" : ""}
                        ${Math.round(calcProfit(l, holdYears, rentalType) / 1000)}k
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 rounded-xl p-3 text-xs"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", backdropFilter: "blur(12px)" }}>
              <div className="font-semibold mb-2" style={{ color: "var(--brand)" }}>
                {mode === "buyer" ? "VFM Grade" : `Profit at ${holdYears} years`}
              </div>
              <div className="flex items-center gap-3">
                {mode === "buyer" ? (
                  [["A+/A", "#00e676"], ["B+/B", "#00d4c8"], ["C+", "#fbbf24"], ["D", "#ff5f5f"]].map(([l, c]) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                      <span style={{ color: "var(--text-secondary)" }}>{l}</span>
                    </div>
                  ))
                ) : (
                  [[">$100k", "#00e676"], ["$50k–$100k", "#00d4c8"], ["$0–$50k", "#fbbf24"], ["<$0", "#ff5f5f"]].map(([l, c]) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                      <span style={{ color: "var(--text-secondary)" }}>{l}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Selected listing card */}
          {selectedListing && (
            <div className="absolute top-4 right-4 w-80 rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      {selectedListing.address}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      ${(selectedListing.price / 1000).toFixed(0)}k · {selectedListing.beds}bd · {selectedListing.type}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="cursor-pointer" style={{ color: "var(--text-muted)" }}>
                    <X size={16} />
                  </button>
                </div>

                {mode === "investor" ? (
                  <div className="space-y-3 mb-4">
                    {/* Hold period profit */}
                    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      <div className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
                        At your {holdYears}-year hold:
                      </div>
                      <div
                        className="text-xl font-bold mono"
                        style={{ color: profitColor(calcProfit(selectedListing, holdYears, rentalType)) }}
                      >
                        {calcProfit(selectedListing, holdYears, rentalType) >= 0 ? "+" : ""}
                        ${Math.round(calcProfit(selectedListing, holdYears, rentalType) / 1000)}k estimated profit
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Long-term yield", value: `${calcGrossYield(selectedListing, "longterm").toFixed(1)}%` },
                        { label: "Airbnb est.", value: `$${Math.round(selectedListing.airbnbMonthly / 100) * 100}/mo` },
                        { label: "Score", value: `${selectedListing.score}/1000` },
                        { label: "VFM", value: selectedListing.vfmGrade },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: "var(--surface-2)" }}>
                          <div className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                          <div className="text-sm font-bold mono" style={{ color: "var(--text-primary)" }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Score",    value: String(selectedListing.score) },
                      { label: "VFM",      value: selectedListing.vfmGrade },
                      { label: "Yield",    value: `${calcGrossYield(selectedListing, "longterm").toFixed(1)}%` },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: "var(--surface-2)" }}>
                        <div className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                        <div className="text-sm font-bold mono" style={{ color: "var(--text-primary)" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <a href={`/report/${selectedListing.id === 1 ? "rpt_001" : `rpt_00${selectedListing.id}`}`} className="btn-primary flex-1 justify-center py-2 text-xs">
                    Full report <ChevronRight size={13} />
                  </a>
                  <button className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    aria-label="Watchlist">
                    <Bookmark size={14} />
                  </button>
                  <button className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    aria-label="Alert">
                    <Bell size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
