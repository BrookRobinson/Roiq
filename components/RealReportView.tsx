"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { PropertyTab } from "@/components/PropertyTab/PropertyTab";
import { HoldPeriodProvider } from "@/lib/hold-period/context";
import { HoldPeriodSlider } from "@/components/HoldPeriodSlider";
import { ReportGapBanner } from "@/components/ReportGapBanner";
import type { ReportGap } from "@/lib/property-tab/gaps";
import { calcCategoryScore, urgencyColor } from "@/lib/property-tab/types";
import type { StoredReport } from "@/lib/report-store";
import {
  Home, Building2, Wrench, Calculator, Map as MapIcon, Shield,
  ExternalLink, AlertTriangle, ImageIcon, Info, Sparkles,
} from "lucide-react";

type Tab = "overview" | "property" | "renovations" | "financial" | "hazard" | "healthyhomes";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "property", label: "Property", icon: Building2 },
  { id: "renovations", label: "Renovations", icon: Wrench },
  { id: "financial", label: "Financial", icon: Calculator },
  { id: "hazard", label: "Hazard", icon: MapIcon },
  { id: "healthyhomes", label: "Healthy Homes", icon: Shield },
];

function indicativeGrade(score: number): string {
  if (score >= 850) return "A+";
  if (score >= 750) return "A";
  if (score >= 650) return "B+";
  if (score >= 550) return "B";
  if (score >= 450) return "C+";
  if (score >= 350) return "C";
  return "D";
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

export function RealReportView({ report }: { report: StoredReport }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [mode, setMode] = useState<"buyer" | "investor">("buyer");

  const { listing, data, score, gaps, photosAnalysed, model } = report;
  const allSubs = data.categories.flatMap((c) => c.subItems);

  const bannerGaps: ReportGap[] = gaps.map((g, i) => ({
    id: `gap_${i}`,
    gapType: /photo/i.test(g.gapType) ? "missing_photo" : "missing_data",
    area: g.area,
    label: g.area,
    description: g.description,
    inAgentLetter: g.includedInAgentLetter,
    inLimLetter: g.includedInLimLetter,
    resolved: false,
  }));

  const facts = [
    listing.askingPrice ? fmt(listing.askingPrice) : listing.priceText,
    [listing.bedrooms && `${listing.bedrooms} bed`, listing.bathrooms && `${listing.bathrooms} bath`, listing.carParks && `${listing.carParks} car`].filter(Boolean).join(" · "),
    [listing.propertyType !== "unknown" ? listing.propertyType : null, listing.floorAreaSqm && `${listing.floorAreaSqm}m² floor`, listing.landAreaSqm && `${listing.landAreaSqm}m² land`].filter(Boolean).join(" · "),
    [listing.buildYear && `c.${listing.buildYear}`, listing.titleType !== "unknown" ? listing.titleType : null].filter(Boolean).join(" · "),
  ].filter(Boolean);

  return (
    <HoldPeriodProvider defaultYears={10}>
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <Navbar user={{ email: "jane@example.com" }} plan="starter" />

        {/* Header */}
        <div className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                  <a href="/dashboard" className="hover:underline" style={{ color: "var(--text-muted)" }}>← Dashboard</a>
                  <span>·</span>
                  <a href={listing.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: "var(--brand)" }}>
                    {listing.portal} <ExternalLink size={11} />
                  </a>
                  <span>·</span>
                  <span className="flex items-center gap-1" style={{ color: "var(--brand)" }}>
                    <Sparkles size={11} /> live analysis
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  {listing.address ?? "Address not found"}
                </h1>
                <div className="flex items-center flex-wrap gap-2 mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {[listing.suburb, listing.region ?? listing.city].filter(Boolean).join(", ")}
                  {facts.map((f, i) => (<span key={i}><span className="mx-1">·</span>{f}</span>))}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1"><ImageIcon size={12} /> {listing.photoUrls.length} found · {photosAnalysed} analysed</span>
                  <span className="mono">{model}</span>
                  {(!listing.scrapedOk || photosAnalysed === 0) && (
                    <span style={{ color: "#fb923c" }}>⚠ scrape partial — leans Tier 3</span>
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                <div className="text-4xl font-bold mono" style={{ color: "var(--brand)" }}>
                  {data.overallScore}<span className="text-base" style={{ color: "var(--text-muted)" }}>/1000</span>
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Grade <strong style={{ color: "var(--text-secondary)" }}>{indicativeGrade(data.overallScore)}</strong> · base {score.baseScore} + bonus {score.dwellingBonus}
                </div>
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Mode:</span>
              <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                {(["buyer", "investor"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className="px-4 py-1.5 rounded-md text-xs font-semibold capitalize cursor-pointer transition-all"
                    style={{ background: mode === m ? "var(--bg)" : "transparent", color: mode === m ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4"><HoldPeriodSlider /></div>
            {bannerGaps.length > 0 && <ReportGapBanner gaps={bannerGaps} />}

            {/* Tabs */}
            <div className="flex gap-0 overflow-x-auto -mb-px">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap cursor-pointer border-b-2 transition-colors"
                  style={{ color: tab === t.id ? "var(--brand)" : "var(--text-secondary)", borderBottomColor: tab === t.id ? "var(--brand)" : "transparent" }}>
                  <t.icon size={14} />{t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {tab === "overview" && <OverviewReal report={report} allSubs={allSubs} />}
          {tab === "property" && <PropertyTab data={data} />}
          {tab === "renovations" && <RenovationsReal allSubs={allSubs} />}
          {tab === "financial" && <FinancialReal listing={listing} mode={mode} />}
          {tab === "hazard" && <HazardReal region={listing.region ?? listing.city ?? ""} />}
          {tab === "healthyhomes" && <HealthyHomesReal buildYear={listing.buildYear} allSubs={allSubs} />}
        </div>

        <Disclaimer url={listing.url} />
      </div>
    </HoldPeriodProvider>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function OverviewReal({ report, allSubs }: { report: StoredReport; allSubs: ReturnType<typeof Array.prototype.flat> }) {
  const subs = allSubs as StoredReport["data"]["categories"][number]["subItems"];
  const tally = {
    critical: subs.filter((s) => s.score !== null && s.score <= 2).length,
    urgent: subs.filter((s) => s.score !== null && s.score >= 3 && s.score <= 4).length,
    monitor: subs.filter((s) => s.score !== null && s.score >= 5 && s.score <= 7).length,
    good: subs.filter((s) => s.score !== null && s.score >= 8).length,
    unscored: subs.filter((s) => s.score === null).length,
  };
  const flags = subs.filter((s) => s.score !== null && s.score <= 4).sort((a, b) => (a.score ?? 9) - (b.score ?? 9));

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-5 gap-3">
        {[
          { label: "Critical", v: tally.critical, c: "#ff5f5f" },
          { label: "Urgent", v: tally.urgent, c: "#fb923c" },
          { label: "Monitor", v: tally.monitor, c: "#fbbf24" },
          { label: "Good", v: tally.good, c: "#00e676" },
          { label: "Not assessed", v: tally.unscored, c: "var(--text-muted)" },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl font-bold mono" style={{ color: s.c }}>{s.v}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Category bars */}
      <div className="card p-5">
        <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Category scores</h3>
        <div className="space-y-3">
          {report.data.categories.map((c) => {
            const pct = Math.round(calcCategoryScore(c.subItems) * 100);
            const col = pct >= 80 ? "#00e676" : pct >= 50 ? "#fbbf24" : "#ff5f5f";
            return (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-40 text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                  <span>{c.icon}</span>{c.name}
                </div>
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                </div>
                <div className="w-10 text-right text-xs mono" style={{ color: "var(--text-secondary)" }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Red flags */}
      {flags.length > 0 && (
        <div className="card p-5" style={{ border: "1px solid rgba(255,95,95,0.2)" }}>
          <div className="flex items-center gap-2 font-semibold text-sm mb-3" style={{ color: "#ff5f5f" }}>
            <AlertTriangle size={15} /> Priority items — act before making an offer
          </div>
          <div className="space-y-2">
            {flags.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                  <span style={{ color: "var(--text-secondary)" }}> — {s.urgencyLabel}</span>
                </div>
                {s.estimatedReplacementCost && (
                  <span className="text-xs mono flex-shrink-0" style={{ color: "var(--brand)" }}>
                    {fmt(s.estimatedReplacementCost.low)}–{fmt(s.estimatedReplacementCost.high)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.data.extraDwellings.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Extra dwellings ({report.data.extraDwellings.length})</h3>
          {report.data.extraDwellings.map((d) => (
            <p key={d.id} className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>{d.type}</strong> — {d.condition} · {fmt(d.estimatedReplacementCost.low)}–{fmt(d.estimatedReplacementCost.high)} ({d.consentStatus})
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Renovations ──────────────────────────────────────────────────────────────
function RenovationsReal({ allSubs }: { allSubs: ReturnType<typeof Array.prototype.flat> }) {
  const subs = allSubs as StoredReport["data"]["categories"][number]["subItems"];
  const items = subs.filter((s) => (s.renovationLink || (s.score !== null && s.score <= 6)) && s.estimatedReplacementCost);
  const total = items.reduce((sum, s) => sum + (s.estimatedReplacementCost ? (s.estimatedReplacementCost.low + s.estimatedReplacementCost.high) / 2 : 0), 0);

  if (items.length === 0) {
    return <div className="card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>No renovation items flagged from the analysis — the property scored well across assessed elements.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 flex items-center justify-between">
        <div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Flagged renovation items</div>
          <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{items.length}</div>
        </div>
        <div className="text-right">
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Estimated total (mid)</div>
          <div className="text-2xl font-bold mono" style={{ color: "var(--brand)" }}>{fmt(total)}</div>
        </div>
      </div>
      {items.map((s) => {
        const col = urgencyColor(s.score);
        const colHex = col === "red" ? "#ff5f5f" : col === "amber" ? "#fbbf24" : "#00e676";
        return (
          <div key={s.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{s.name}</div>
                <div className="text-xs mt-0.5" style={{ color: colHex }}>{s.urgencyLabel}</div>
              </div>
              {s.estimatedReplacementCost && (
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold mono" style={{ color: "var(--brand)" }}>
                    {fmt(s.estimatedReplacementCost.low)}–{fmt(s.estimatedReplacementCost.high)}
                  </div>
                </div>
              )}
            </div>
            {s.estimatedReplacementCost?.notes && (
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{s.estimatedReplacementCost.notes}</p>
            )}
          </div>
        );
      })}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Costs are AI estimates from the analysis. A toggleable planner with regional pricing and equity/rent-uplift impact is the next build.
      </p>
    </div>
  );
}

// ── Financial (basic, from real price) ───────────────────────────────────────
function FinancialReal({ listing, mode }: { listing: StoredReport["listing"]; mode: "buyer" | "investor" }) {
  const price = listing.askingPrice;
  if (!price) {
    return <div className="card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>The listing price wasn&apos;t available ({listing.priceText ?? "price by negotiation"}), so financials can&apos;t be calculated. Enter a price manually once the full calculator is wired.</div>;
  }
  const deposit = price * 0.2;
  const loan = price - deposit;
  const r = 0.065 / 52, n = 30 * 52;
  const weekly = (loan * r) / (1 - Math.pow(1 + r, -n));
  const years = 10, growth = 0.05;
  const futureValue = price * Math.pow(1 + growth, years);
  const equity = futureValue - loan;

  const rows = [
    ["Purchase price", fmt(price)],
    ["Deposit (20%)", fmt(deposit)],
    ["Loan", fmt(loan)],
    ["Weekly mortgage (P&I, 6.5%, 30yr)", fmt(weekly) + "/wk"],
    [`Projected value at ${years}yr (5% p.a.)`, fmt(futureValue)],
    ["Indicative equity at hold", fmt(equity)],
  ];

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Quick numbers — {mode}</h3>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2.5 text-sm">
              <span style={{ color: "var(--text-secondary)" }}>{k}</span>
              <span className="font-semibold mono" style={{ color: "var(--text-primary)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      {mode === "investor" && (
        <div className="card p-4 text-sm flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
          <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          Rental yield and cashflow need suburb median-rent data, which isn&apos;t wired yet — coming with the market-data integration.
        </div>
      )}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Indicative only, using default assumptions (20% deposit, 6.5% rate, 30-year P&I, 5% growth). The full adjustable calculator with renovation integration is a later build.
      </p>
    </div>
  );
}

// ── Hazard (indicative, location-based) ──────────────────────────────────────
function HazardReal({ region }: { region: string }) {
  const r = region.toLowerCase();
  const notes: { t: string; d: string }[] = [];
  if (r.includes("christ") || r.includes("canterbury")) notes.push({ t: "Liquefaction (Canterbury TC zones)", d: "TC2/TC3 land carries liquefaction risk. Confirm the technical category and any post-earthquake foundation remediation." });
  if (r.includes("west coast") || r.includes("westland") || r.includes("hokitika") || r.includes("greymouth") || r.includes("buller")) notes.push({ t: "High rainfall (~2,900mm/yr)", d: "West Coast rainfall accelerates wear on roofs, cladding, and drainage — prioritise those at inspection." });
  notes.push({ t: "Order a LIM", d: "A LIM from the local council confirms flood, coastal-erosion, and natural-hazard overlays for this exact address." });

  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm flex items-start gap-2" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
        <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
        Indicative location-based notes. A live hazard overlay (flood/coastal/liquefaction by geometry) is not yet integrated — this is the next data source to add.
      </div>
      {notes.map((nf) => (
        <div key={nf.t} className="card p-4">
          <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{nf.t}</div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{nf.d}</p>
        </div>
      ))}
    </div>
  );
}

// ── Healthy Homes (indicative, build-era) ────────────────────────────────────
function HealthyHomesReal({ buildYear, allSubs }: { buildYear: number | null; allSubs: ReturnType<typeof Array.prototype.flat> }) {
  const subs = allSubs as StoredReport["data"]["categories"][number]["subItems"];
  const hhFlagged = subs.filter((s) => s.healthyHomesLink);
  const era = !buildYear
    ? { v: "Unknown", d: "Build year unconfirmed — a certified Healthy Homes assessment is recommended before tenanting." }
    : buildYear >= 2019 ? { v: "Likely compliant", d: "Built to modern code — confirm heating capacity and R-values." }
    : buildYear >= 2008 ? { v: "Probably compliant", d: "Confirm insulation R-values and extractor ducting." }
    : buildYear >= 2000 ? { v: "Risk — verify", d: "May be below current standard; assessment recommended." }
    : buildYear >= 1978 ? { v: "Risk — verify", d: "Likely below current insulation/heating standard." }
    : { v: "Likely non-compliant", d: "Pre-1978 — budget for insulation, fixed heating, ventilation, and draught-stopping remediation." };

  const standards = ["Heating (fixed, ≥1.5kW, main living room)", "Insulation (ceiling + underfloor)", "Ventilation (extractors ducted outside)", "Moisture & drainage (gutters, ground barrier)", "Draught stopping"];

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Build-era indication</h3>
          <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: "var(--brand-light)", color: "var(--brand)" }}>{era.v}</span>
        </div>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>{era.d}</p>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>The 5 standards</h3>
        <ul className="space-y-2">
          {standards.map((s) => (
            <li key={s} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <Shield size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />{s}
            </li>
          ))}
        </ul>
        {hhFlagged.length > 0 && (
          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            Items the analysis flagged as Healthy-Homes relevant: {hhFlagged.map((s) => s.name).join(", ")}.
          </p>
        )}
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Indicative only — a full per-standard assessment with remediation costs is a later build. Engage a certified assessor before renting.
      </p>
    </div>
  );
}

function Disclaimer({ url }: { url: string }) {
  return (
    <div className="border-t px-4 py-4 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>
      AI analysis of publicly available listing data and photos. Not a registered valuation or building inspection. Verify all material facts before making an offer.{" "}
      <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>View original listing →</a>
    </div>
  );
}
