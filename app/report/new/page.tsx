"use client";
import { CopyUrlHelp } from "@/components/CopyUrlHelp";

import Navbar from "@/components/Navbar";
import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Upload, Link2, Loader2, CheckCircle2, Trees } from "lucide-react";
import { saveReport, saveReportPersona } from "@/lib/report-store";
import type { Persona } from "@/lib/scoring/model";
import { PersonaChoice, PersonaRequiredDialog } from "@/components/report/PersonaChoice";
import { useSession } from "@/lib/auth/session";
import { describeAllowance, PLAN_LABEL } from "@/lib/billing/plans";
import Link from "next/link";
import { Lock } from "lucide-react";
import { contributeToMap } from "@/lib/map/contribution";
import { persistReport } from "@/lib/reports/client";
import { useRequireAuth } from "@/lib/auth/useRequireAuth";
import { PRODUCT_NAME } from "@/lib/brand";
import { AnalysedAddressSearch } from "@/components/report/AnalysedAddressSearch";
import type { AnalysedMatch } from "@/lib/reports/search-shared";

type Step = "input" | "scraping" | "analysing" | "done";

const PORTALS = [
  "propertybrokers.co.nz",
  "realestate.co.nz",
  "oneroof.co.nz",
  "harcourts.net/nz",
  "bayleys.co.nz",
  "barfoot.co.nz",
  "raywhite.co.nz",
];

const PIPELINE_STEPS = [
  { id: "scrape", label: "Scraping the listing", sub: "Address, price, details, photos" },
  { id: "photos", label: "Downloading & resizing photos", sub: "Preparing images for Claude" },
  { id: "vision", label: "Analysing with Claude vision", sub: "Scoring every visible element" },
  { id: "score", label: "Calculating quality score", sub: "Persona-aware 1,000-point rubric" },
  { id: "report", label: "Building your report", sub: "Compiling findings and gaps" },
];

// Trade Me blocks automated access AND its listing URLs don't contain the street
// address — so the link alone can't reliably identify the property (auto-recovery
// risks analysing the wrong house). For Trade Me we ask the user to confirm the
// address, then find the property on OneRoof / realestate / homes.
const isTradeMeUrl = (u: string) => /(^|\/\/|\.)trademe\.co\.nz/i.test(u);

function NewReportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Deep-link support: /report/new?url=<listing> pre-fills the box so a shared
  // link lands ready to analyse. The query is preserved through the account gate
  // so first-time visitors return here (with the URL intact) after signing up.
  const prefillUrl = searchParams.get("url")?.trim() || "";
  const nextPath = prefillUrl ? `/report/new?url=${encodeURIComponent(prefillUrl)}` : "/report/new";
  const acctReady = useRequireAuth(nextPath);
  const [url, setUrl] = useState(prefillUrl);
  const [addressInput, setAddressInput] = useState("");
  const [needAddress, setNeedAddress] = useState(false);
  const [addressReason, setAddressReason] = useState<"trademe" | "failed">("failed");
  const [target, setTarget] = useState("");
  // Null until they actually pick — deliberately not defaulted and deliberately
  // not remembered from last time, or the choice stops being a choice.
  const [persona, setPersona] = useState<Persona | null>(null);
  const [askPersona, setAskPersona] = useState(false);
  const { plan, loading: planLoading } = useSession();
  const [step, setStep] = useState<Step>("input");
  const [pipelineStep, setPipelineStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outOfReports, setOutOfReports] = useState(false);
  // A bare section. Not an error — the listing is fine, there is just no
  // building to score — so it gets an explanation rather than a red box.
  const [noDwelling, setNoDwelling] = useState<string | null>(null);
  // An address picked from the search, parked while the persona dialog is up so
  // the choice survives it and they don't have to find the property again.
  const [pendingMatch, setPendingMatch] = useState<AnalysedMatch | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const focusUrlInput = () => {
    urlInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    urlInputRef.current?.focus({ preventScroll: true });
  };

  async function runAnalysis(payload: { url?: string; address?: string }, forPersona: Persona) {
    const label = (payload.url ?? payload.address ?? "").trim();
    if (!label) return;
    setError(null);
    setOutOfReports(false);
    setNoDwelling(null);
    setTarget(label);
    setStep("analysing");
    setPipelineStep(0);

    // Advance the visual pipeline while the one real request runs. We can't get
    // true per-step progress from a single call, so this is indicative — it holds
    // at the last step until the real result actually arrives.
    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(p + 1, PIPELINE_STEPS.length - 1);
      setPipelineStep(p);
    }, 9000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      clearInterval(timer);

      if (!res.ok) {
        // URL couldn't be scraped or recovered → offer manual address entry.
        // Bare land. Nothing is broken and nothing was charged — say what the
        // listing is and stop, rather than scoring a house that isn't there.
        if (res.status === 422 && data.error === "no_dwelling") {
          setNoDwelling(data.message ?? "This listing has no building on it.");
          setStep("input");
          return;
        }
        if (res.status === 422 && data.error === "listing_not_found") {
          setAddressReason("failed");
          setNeedAddress(true);
          setStep("input");
          return;
        }
        setError(
          res.status === 503
            ? "Claude isn't configured — add a funded ANTHROPIC_API_KEY to .env.local and restart the server."
            : data.message ?? data.error ?? `Analysis failed (HTTP ${res.status}).`
        );
        // 402 means they're out of reports, not that anything broke — show the
        // way forward rather than a red error box.
        setOutOfReports(res.status === 402);
        setStep("input");
        return;
      }

      // Already in their account, unchanged since. Open it rather than making a
      // second identical row — and no allowance was spent finding that out.
      if (data.existingReportId) {
        setStep("done");
        router.push(`/report/${data.existingReportId}`);
        return;
      }

      const id = crypto.randomUUID();
      const report = {
        id,
        createdAt: new Date().toISOString(),
        listing: data.listing,
        context: data.context,
        subItems: data.subItems ?? [],
        extraDwellings: data.extraDwellings ?? [],
        penalties: data.penalties ?? [],
        scores: data.scores,
        gaps: data.gaps ?? [],
        marketRent: data.marketRent,
        capitalGrowth: data.capitalGrowth,
        suburbValue: data.suburbValue,
        photosAnalysed: data.photosAnalysed ?? 0,
        model: data.model,
        // This property had already been analysed — the report says so rather than
        // passing a month-old read off as fresh.
        reusedFrom: data.reused ? { analysedAt: data.analysedAt as string } : undefined,
      };
      // The report view reads this on mount, so the report opens in the lens they
      // asked for instead of the "buyer" default.
      saveReportPersona(id, forPersona);

      const saved = saveReport(report);
      if (!saved) {
        setError("Your report was generated but couldn't be saved in this browser. Please try again.");
        setStep("input");
        return;
      }

      // Outlive the tab: sessionStorage above is the fast path, this is the
      // durable copy that puts the report on the dashboard tomorrow.
      persistReport(report);

      // Every pin on the map comes from a report someone ran — there is no
      // listings feed. Fire-and-forget, and only for properties that are
      // publicly for sale (the helper drops uploads).
      contributeToMap(report);

      setPipelineStep(PIPELINE_STEPS.length);
      setStep("done");
      router.push(`/report/${id}`);
    } catch {
      clearInterval(timer);
      setError("Network error — check your connection and try again.");
      setStep("input");
    }
  }

  /**
   * Open a property picked from the address search.
   *
   * Their own report opens directly — it is already theirs and already paid
   * for, exactly as it does from the dashboard. Anyone else's goes through the
   * normal analyse flow instead of straight to the id, and that is deliberate:
   * that flow re-scrapes first, which is the only thing that can tell whether
   * the price or the photos have moved since, and it charges an allowance like
   * any other report. Linking to a stranger's id would skip both.
   */
  const openAnalysed = (match: AnalysedMatch, withPersona: Persona | null = persona) => {
    if (match.mine && match.id) {
      setPendingMatch(null);
      router.push(`/report/${match.id}`);
      return;
    }
    if (!withPersona) {
      setPendingMatch(match);
      setAskPersona(true);
      return;
    }
    setPendingMatch(null);
    if (match.listingUrl) setUrl(match.listingUrl);
    runAnalysis(
      match.listingUrl ? { url: match.listingUrl } : { address: match.address },
      withPersona
    );
  };

  const startAnalysis = (withPersona: Persona | null = persona) => {
    const u = url.trim();
    if (!u) return;
    // Trade Me data can't be scraped → the address prompt is already on screen
    // (shown automatically the moment a Trade Me link is detected). Don't hit the
    // API with the URL; the user finds the property by address instead.
    if (isTradeMeUrl(u)) return;
    if (!withPersona) {
      setAskPersona(true);
      return;
    }
    runAnalysis({ url: u }, withPersona);
  };
  // The fallback box accepts EITHER a link or an address. A link (no spaces, has a
  // domain) → scrape it directly (reliable — this is how a OneRoof/realestate link
  // gets every photo). Anything with spaces → treat as an address and search.
  const findByInput = (withPersona: Persona | null = persona) => {
    const v = addressInput.trim();
    if (!v) return;
    if (!withPersona) {
      setAskPersona(true);
      return;
    }
    const looksLikeUrl = /^https?:\/\//i.test(v) || (!/\s/.test(v) && /[a-z0-9.-]+\.[a-z]{2,}/i.test(v));
    if (looksLikeUrl) {
      const u = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      if (isTradeMeUrl(u)) {
        setError("That's another Trade Me link, which we can't scrape. Paste the OneRoof or realestate.co.nz link for this property, or type the address.");
        return;
      }
      runAnalysis({ url: u }, withPersona);
    } else {
      runAnalysis({ address: v }, withPersona);
    }
  };

  // The moment a Trade Me link is in the box, surface the address prompt — Trade Me
  // blocks scraping, so we need the address to find the property on OneRoof etc.
  const tradeMeDetected = isTradeMeUrl(url.trim());
  const showAddressPrompt = needAddress || tradeMeDetected;
  const addressPromptReason: "trademe" | "failed" = tradeMeDetected ? "trademe" : addressReason;

  // Must have a (free) account to run a report.
  if (!acctReady) return <div style={{ background: "var(--bg)", minHeight: "100vh" }} />;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar />
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
            {error && !outOfReports && (
              <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid rgba(255,95,95,0.2)" }}>
                {error}
              </div>
            )}

            {outOfReports && (
              <div className="card p-5 mb-4" style={{ border: "1px solid var(--brand)", background: "var(--accent-wash)" }}>
                <div className="flex items-start gap-3">
                  <Lock size={18} style={{ color: "var(--brand)", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                      You&apos;re out of reports
                    </div>
                    <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>{error}</p>
                    <Link href="/pricing?plan=starter" className="btn-primary text-sm px-4 py-2">
                      See plans <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {noDwelling && (
              <div className="card p-5 mb-4" style={{ border: "1px solid var(--brand)", background: "var(--accent-wash)" }}>
                <div className="flex items-start gap-3">
                  <Trees size={18} style={{ color: "var(--brand)", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                      That&apos;s bare land, not a house
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{noDwelling}</p>
                    <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                      None of your reports were used. Paste a listing with a house on it to run one.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Manual address fallback — shown automatically for Trade Me links (data
                can't be scraped) or when any other URL can't be scraped/recovered. */}
            {showAddressPrompt && (
              <div className="rounded-2xl p-6 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--brand)" }}>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  {addressPromptReason === "trademe"
                    ? "Trade Me can't be read — paste a OneRoof or realestate.co.nz link"
                    : "We couldn't access this listing automatically."}
                </p>
                <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                  {addressPromptReason === "trademe"
                    ? "Trade Me blocks automated access, so we can't pull this listing's photos or details. Please find this exact property on OneRoof or realestate.co.nz and copy/paste that listing's URL into the box below — we'll grab every photo and the full details."
                    : "Paste the property's OneRoof or realestate.co.nz link (most reliable), or type the address and we'll search OneRoof, realestate.co.nz and homes.co.nz."}
                </p>
                <div className="flex gap-2">
                  <input
                    className="input text-base flex-1"
                    placeholder={addressPromptReason === "trademe" ? "Paste the OneRoof or realestate.co.nz listing URL" : "OneRoof / realestate link — or the street address"}
                    value={addressInput}
                    autoFocus
                    onChange={(e) => setAddressInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && findByInput()}
                  />
                  <button
                    onClick={() => findByInput()}
                    disabled={!addressInput.trim()}
                    className="btn-primary px-5 flex-shrink-0"
                    style={{ opacity: addressInput.trim() ? 1 : 0.5 }}
                  >
                    Find property
                  </button>
                </div>
              </div>
            )}

            {/* Ask the cheap question first: this property may already have been
                analysed, in which case there is nothing to generate. */}
            <AnalysedAddressSearch onSelect={(m) => openAnalysed(m)} onPasteUrl={focusUrlInput} />

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
                ref={urlInputRef}
                className="input text-base mb-5"
                placeholder="Paste a OneRoof, realestate.co.nz or agency listing URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startAnalysis()}
              />

              <div className="mb-5">
                <PersonaChoice value={persona} onChange={setPersona} />
              </div>

              {/* What a free report includes, said before it's used rather than
                  discovered afterwards. There is only one, and it doesn't come back. */}
              {!planLoading && plan === "free" && (
                <div
                  className="rounded-xl px-4 py-3 mb-5 text-xs"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)", lineHeight: 1.6 }}
                >
                  <strong style={{ color: "var(--text-primary)" }}>This uses your free report</strong> — you get{" "}
                  {describeAllowance("free")}, and it doesn&apos;t reset. Every photo is analysed and every finding
                  shown, but the <strong style={{ color: "var(--text-primary)" }}>score</strong> and{" "}
                  <strong style={{ color: "var(--text-primary)" }}>valuation</strong> stay locked until you upgrade.{" "}
                  <Link href="/pricing" className="hover:underline" style={{ color: "var(--brand)" }}>
                    {PLAN_LABEL.starter} is {describeAllowance("starter")} →
                  </Link>
                </div>
              )}

              <button
                onClick={() => startAnalysis()}
                disabled={!url.trim()}
                className="btn-primary w-full justify-center py-3 text-base"
                style={{ opacity: !url.trim() ? 0.5 : persona ? 1 : 0.75 }}
              >
                Analyse property
                <ArrowRight size={18} />
              </button>
            </div>

            {/* How to copy a link — collapsed, for anyone who needs it */}
            <CopyUrlHelp />

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

            {/* Manual upload — address + categorised photos, for a property you can't link to */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push("/report/upload")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/report/upload"); } }}
              className="rounded-2xl p-6 text-center cursor-pointer transition-colors"
              style={{
                border: "2px dashed var(--border)",
                background: "var(--surface)",
              }}
            >
              <Upload size={28} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="font-medium text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                Upload property photos
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                For a property you can&apos;t link to. Enter the address and upload a photo of each area — {PRODUCT_NAME} runs the full analysis.
              </p>
              <button
                className="btn-secondary mt-4 text-sm"
                onClick={(e) => { e.stopPropagation(); router.push("/report/upload"); }}
              >
                Upload photos
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {askPersona && (
          <PersonaRequiredDialog
            onClose={() => {
              setAskPersona(false);
              setPendingMatch(null);
            }}
            onChoose={(chosen) => {
              setPersona(chosen);
              setAskPersona(false);
              // Carry on with the run they already asked for, rather than making
              // them find the button again.
              if (pendingMatch) openAnalysed(pendingMatch, chosen);
              else if (showAddressPrompt && addressInput.trim()) findByInput(chosen);
              else startAnalysis(chosen);
            }}
          />
        )}

        {(step === "scraping" || step === "analysing") && (
          <AnalysisPipeline pipelineStep={pipelineStep} url={target || url} />
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

export default function NewReportPage() {
  return (
    <Suspense fallback={<div style={{ background: "var(--bg)", minHeight: "100vh" }} />}>
      <NewReportInner />
    </Suspense>
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
        Real Claude vision analysis · this can take 1–3 minutes on the current API tier
      </p>
    </div>
  );
}
