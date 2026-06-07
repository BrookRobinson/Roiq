"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { PropertyTab } from "@/components/PropertyTab/PropertyTab";
import { HoldPeriodProvider } from "@/lib/hold-period/context";
import { improvementsCategories } from "@/lib/scoring/report";
import type { PropertyContext, ScoreResult } from "@/lib/scoring/engine";
import type { SubItem, ExtraDwelling, PropertyTabData } from "@/lib/property-tab/types";
import { Sparkles, AlertTriangle, ExternalLink, Loader2, ImageIcon } from "lucide-react";

interface GapFinding {
  gapType: string;
  area: string;
  description: string;
  includedInAgentLetter: boolean;
  includedInLimLetter: boolean;
}

interface ScrapedListing {
  url: string;
  portal: string;
  address: string | null;
  suburb: string | null;
  region: string | null;
  city: string | null;
  askingPrice: number | null;
  priceText: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floorAreaSqm: number | null;
  buildYear: number | null;
  photoUrls: string[];
  scrapedOk: boolean;
}

interface AnalyzeResponse {
  ok?: boolean;
  listing?: ScrapedListing;
  context?: PropertyContext;
  subItems?: SubItem[];
  extraDwellings?: ExtraDwelling[];
  scores?: { buyer: ScoreResult; investor: ScoreResult };
  gaps?: GapFinding[];
  photosAnalysed?: number;
  model?: string;
  error?: string;
  message?: string;
}

const EXAMPLE = "https://www.trademe.co.nz/a/property/residential/sale/...";

export default function AnalyzePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  async function run() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const json: AnalyzeResponse = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          setError({
            title: "Claude API key not configured",
            detail:
              "Add a funded ANTHROPIC_API_KEY to roiq/.env.local (the ANTHROPIC_API_KEY= line), then restart the dev server.",
          });
        } else {
          setError({ title: json.error ?? "Analysis failed", detail: json.message ?? `HTTP ${res.status}` });
        }
        return;
      }
      setResult(json);
    } catch (e) {
      setError({ title: "Request failed", detail: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  const listing = result?.listing;
  const scores = result?.scores;
  const tabData: PropertyTabData | null = result?.subItems
    ? {
        categories: improvementsCategories(result.subItems),
        extraDwellings: result.extraDwellings ?? [],
        overallScore: scores?.buyer.total ?? 0,
      }
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} style={{ color: "var(--brand)" }} />
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Live property analysis
          </h1>
          <span
            className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "var(--brand-light)", color: "var(--brand)" }}
          >
            beta
          </span>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Paste a NZ listing URL. RoiQ scrapes it, sends the photos to Claude vision, and returns a real
          condition report and 1,000-point score. This is the actual pipeline — not the demo.
        </p>

        {/* Input */}
        <div className="card p-4">
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            Listing URL (Trade Me, realestate.co.nz, Ray White, Harcourts, Bayleys, Barfoot, OneRoof…)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && run()}
              placeholder={EXAMPLE}
              className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none mono"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <button onClick={run} disabled={loading || !url.trim()} className="btn-primary px-5 whitespace-nowrap">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin" /> Analysing…
                </span>
              ) : (
                "Analyse listing"
              )}
            </button>
          </div>
          {loading && (
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              Scraping the listing and running Claude vision over the photos — this usually takes 30–60 seconds.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-xl p-4 mt-4 flex items-start gap-3"
            style={{ background: "rgba(255,95,95,0.06)", border: "1px solid rgba(255,95,95,0.25)" }}
          >
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#ff5f5f" }} />
            <div>
              <div className="font-semibold text-sm" style={{ color: "#ff5f5f" }}>
                {error.title}
              </div>
              <div className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {error.detail}
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {tabData && listing && (
          <div className="mt-6 space-y-6">
            {/* Scrape + score header */}
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
                    {listing.address ?? "Address not found"}
                  </div>
                  <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {[listing.suburb, listing.region ?? listing.city].filter(Boolean).join(", ") || "—"}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span>{listing.askingPrice ? `$${listing.askingPrice.toLocaleString("en-NZ")}` : listing.priceText ?? "Price n/a"}</span>
                    {listing.bedrooms != null && <span>{listing.bedrooms} bed</span>}
                    {listing.bathrooms != null && <span>{listing.bathrooms} bath</span>}
                    {listing.floorAreaSqm != null && <span>{listing.floorAreaSqm} m²</span>}
                    {listing.buildYear != null && <span>built {listing.buildYear}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="flex items-center gap-1">
                      <ImageIcon size={12} /> {listing.photoUrls.length} found · {result.photosAnalysed} analysed
                    </span>
                    <span className="mono">{result.model}</span>
                    {!listing.scrapedOk && (
                      <span style={{ color: "#fb923c" }}>⚠ scrape was partial — results lean Tier 3</span>
                    )}
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      original <ExternalLink size={11} />
                    </a>
                  </div>
                </div>

                {/* Score dials — both personas, proving the persona-aware engine */}
                {scores && (
                  <div className="flex gap-5 text-right">
                    {(["buyer", "investor"] as const).map((p) => (
                      <div key={p}>
                        <div className="text-3xl font-bold mono" style={{ color: "var(--brand)" }}>
                          {scores[p].total}
                          <span className="text-sm" style={{ color: "var(--text-muted)" }}>/1000</span>
                        </div>
                        <div className="text-xs mt-1 capitalize" style={{ color: "var(--text-muted)" }}>
                          {p} · base {scores[p].base}
                          {scores[p].dwellingBonus > 0 ? ` + ${scores[p].dwellingBonus}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Real Property tab with live data (Improvements inspection) */}
            <HoldPeriodProvider>
              <PropertyTab data={tabData} />
            </HoldPeriodProvider>

            {/* Gaps */}
            {result.gaps && result.gaps.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                  Information gaps ({result.gaps.length})
                </h3>
                <ul className="space-y-2">
                  {result.gaps.map((g, i) => (
                    <li key={i} className="text-sm flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--brand)" }} />
                      <span>
                        <strong style={{ color: "var(--text-primary)" }}>{g.area}</strong> — {g.description}
                        <span className="ml-1 text-xs" style={{ color: "var(--text-muted)" }}>
                          ({g.includedInLimLetter ? "LIM request" : "agent request"})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              AI analysis of publicly available listing data and photos. Not a registered valuation or
              building inspection. Conditions not visible in photos may differ materially. Verify all
              material facts before making an offer.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
