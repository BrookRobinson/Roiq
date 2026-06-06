"use client";

import Navbar from "@/components/Navbar";
import { useState } from "react";
import { ArrowRight, Upload, Link2, Loader2, CheckCircle2, Home } from "lucide-react";

type Step = "input" | "scraping" | "analysing" | "done";

const PORTALS = [
  "trademe.co.nz/property",
  "realestate.co.nz",
  "rwmetro.co.nz",
  "harcourts.net/nz",
  "bayleys.co.nz",
  "barfoot.co.nz",
  "propertybrokers.co.nz",
  "oneroof.co.nz",
];

const PIPELINE_STEPS = [
  { id: "scrape", label: "Scraping listing data", sub: "Fetching photos, details, price" },
  { id: "photos", label: "Analysing photos with AI", sub: "Claude vision — scoring each photo" },
  { id: "market", label: "Pulling suburb market data", sub: "Avg values, yield, comparable sales" },
  { id: "hazard", label: "Checking hazard database", sub: "TC zones, flood, coastal risk" },
  { id: "score", label: "Calculating quality score", sub: "6 categories, 1,000 point rubric" },
  { id: "report", label: "Building your report", sub: "Compiling findings and financials" },
];

export default function NewReportPage() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [pipelineStep, setPipelineStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scrapedData, setScrapedData] = useState<Record<string, unknown> | null>(null);

  async function startAnalysis() {
    if (!url.trim()) return;
    setError(null);
    setStep("scraping");
    setPipelineStep(0);

    // Step 1 — real scrape
    let listing: Record<string, unknown> | null = null;
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok && res.status !== 206) {
        setError(data.message ?? data.error ?? "Scrape failed. Try uploading photos manually.");
        setStep("input");
        return;
      }

      listing = data.listing ?? null;
      setScrapedData(listing);
    } catch {
      setError("Network error — check your connection and try again.");
      setStep("input");
      return;
    }

    setPipelineStep(1); // scrape done

    // Steps 2–6 — remaining pipeline (AI analysis etc. — simulated until Claude API is wired)
    for (let i = 1; i < PIPELINE_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 600));
      setPipelineStep(i + 1);
    }

    setStep("done");
    await new Promise((r) => setTimeout(r, 600));
    // TODO: once reports API is wired, navigate to the real report ID
    window.location.href = "/report/rpt_001";
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar user={{ email: "jane@example.com" }} plan="starter" />
      <div className="max-w-2xl mx-auto px-4 py-12">
        {step === "input" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Analyse a property
              </h1>
              <p className="text-base" style={{ color: "var(--text-secondary)" }}>
                Paste a listing URL from any supported NZ property portal.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid rgba(255,95,95,0.2)" }}>
                {error}
              </div>
            )}

            {/* URL input */}
            <div
              className="rounded-2xl p-6 mb-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <label className="label text-sm font-semibold mb-3 block" style={{ color: "var(--text-primary)", marginBottom: 10 }}>
                <Link2 size={14} className="inline mr-2" style={{ color: "var(--brand)" }} />
                Listing URL
              </label>
              <input
                className="input text-base mb-4"
                placeholder="https://www.trademe.co.nz/property/residential/sale/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startAnalysis()}
              />
              <button
                onClick={startAnalysis}
                disabled={!url.trim()}
                className="btn-primary w-full justify-center py-3 text-base"
                style={{ opacity: url.trim() ? 1 : 0.5 }}
              >
                Analyse property
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Supported portals */}
            <div className="mb-6">
              <p className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>
                Supported portals
              </p>
              <div className="flex flex-wrap gap-2">
                {PORTALS.map((p) => (
                  <span
                    key={p}
                    className="text-xs px-2.5 py-1 rounded-full"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>or upload manually</span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            </div>

            {/* Manual upload */}
            <div
              className="rounded-2xl p-6 text-center cursor-pointer transition-colors"
              style={{
                border: "2px dashed var(--border)",
                background: "var(--surface)",
              }}
            >
              <Upload size={28} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="font-medium text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                Upload listing photos
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Use if the listing URL can&apos;t be scraped. Drag and drop or click to browse.
              </p>
              <button
                className="btn-secondary mt-4 text-sm"
                onClick={() => {}}
              >
                Browse files
              </button>
            </div>
          </>
        )}

        {(step === "scraping" || step === "analysing") && (
          <AnalysisPipeline pipelineStep={pipelineStep} url={url} />
        )}

        {step === "done" && (
          <div className="text-center py-12">
            <CheckCircle2 size={56} className="mx-auto mb-4" style={{ color: "var(--success)" }} />
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Report ready
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Redirecting to your report…
            </p>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: "var(--brand)" }} />
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisPipeline({ pipelineStep, url }: { pipelineStep: number; url: string }) {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Analysing property…
        </h2>
        <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
          {url}
        </p>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-2 rounded-full mb-8 overflow-hidden"
        style={{ background: "var(--surface-2)" }}
      >
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{
            width: `${(pipelineStep / PIPELINE_STEPS.length) * 100}%`,
            background: "var(--brand)",
          }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {PIPELINE_STEPS.map((s, i) => {
          const done = i < pipelineStep;
          const active = i === pipelineStep;
          return (
            <div
              key={s.id}
              className="flex items-center gap-4 p-4 rounded-xl transition-all"
              style={{
                background: active ? "var(--brand-light)" : done ? "var(--surface)" : "transparent",
                border: `1px solid ${active ? "var(--brand)" : done ? "var(--border)" : "transparent"}`,
                opacity: !done && !active ? 0.4 : 1,
              }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: done ? "var(--success)" : active ? "var(--brand)" : "var(--surface-2)",
                }}
              >
                {done ? (
                  <CheckCircle2 size={14} color="white" />
                ) : active ? (
                  <Loader2 size={14} color="white" className="animate-spin" />
                ) : (
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                    {i + 1}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {s.label}
                </div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {s.sub}
                </div>
              </div>
              {done && (
                <span className="text-xs font-medium" style={{ color: "var(--success)" }}>
                  Done
                </span>
              )}
              {active && (
                <span className="text-xs font-medium" style={{ color: "var(--brand)" }}>
                  Running…
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs mt-8" style={{ color: "var(--text-muted)" }}>
        Typically 30–90 seconds · Powered by Claude AI
      </p>
    </div>
  );
}
