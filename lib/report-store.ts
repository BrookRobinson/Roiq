// Transient client-side store for a freshly generated analysis, so /report/new
// can hand a real result to /report/[id] without a database yet.
//
// sessionStorage = per-tab, survives the navigation + a refresh within the
// session. This is NOT real persistence (that needs the Supabase reports table);
// it's enough to wire the real paste → analyse → full-report flow for now.

import type { SubItem, ExtraDwelling } from "@/lib/property-tab/types";
import type { PropertyContext, ScoreResult, PenaltyInput } from "@/lib/scoring/engine";
import type { Persona } from "@/lib/scoring/model";
import type { MarketRent, CapitalGrowth, SuburbValue } from "@/lib/scoring/investment";
import type { PhotoCoverage } from "@/lib/photo-categories";
import type { ScrapedListing } from "@/lib/scraper/types";

export interface StoredGap {
  gapType: string;
  area: string;
  description: string;
  includedInAgentLetter: boolean;
  includedInLimLetter: boolean;
}

/** Result of Claude reading an uploaded legal document (LIM / consent / EQC / title). */
export interface DocAnalysis {
  itemId: string;
  docType: string;
  docTypeConfirmed: boolean;
  fileName: string;
  score: number | null; // 1–10 verified score, null if the doc was the wrong type
  summary: string;
  keyFindings: string[];
  redFlags: string[];
  analysedAt: string;
}

export interface StoredReport {
  id: string;
  createdAt: string;
  listing: ScrapedListing;
  /** Whole-property facts that resolve conditional scoring items. */
  context: PropertyContext;
  /** Persona-independent rich assessments (raw 1–10 scores + detail), v3.1 ids. */
  subItems: SubItem[];
  extraDwellings: ExtraDwelling[];
  /** Objective location negatives (persona-independent); re-applied on the toggle. */
  penalties?: PenaltyInput[];
  /** Both personas, precomputed at generation time; the toggle reads these. */
  scores: { buyer: ScoreResult; investor: ScoreResult };
  gaps: StoredGap[];
  photosAnalysed: number;
  model: string;
  /** Verified document analyses keyed by sub-item id (leg_lim / leg_consents / leg_eqc / leg_title). */
  verifiedDocs?: Record<string, DocAnalysis>;
  /** Web-sourced (or AI-estimated) market rent for the yield calc. */
  marketRent?: MarketRent;
  /** Suburb capital-growth signal for the predicted price + growth panel. */
  capitalGrowth?: CapitalGrowth;
  /** Scraped suburb median $/m² (recent comparable sales) for the Value Verdict. */
  suburbValue?: SuburbValue;
  /** Which photo areas were provided in a manual upload (coverage indicator). */
  photoCoverage?: PhotoCoverage;
  /** Set when this report reuses an earlier analysis of the same listing rather
   *  than running a new one. The report must say so — it is not a live read. */
  reusedFrom?: { analysedAt: string };
  /**
   * Bare land — no building on the property, so only the Land and Legal
   * inspections were assessed.
   *
   * The report MUST read this before showing a score or a valuation. The engine
   * normalises whatever it scored back to 1,000, so a land report would
   * otherwise print a number that looks directly comparable to a house's and
   * isn't. Improvements and Renovations have nothing to describe either.
   */
  landOnly?: boolean;
}

const key = (id: string) => `roiq:report:${id}`;
const personaKey = (id: string) => `roiq:report:${id}:persona`;

export function saveReport(report: StoredReport): boolean {
  try {
    // Manual-upload photos arrive as base64 `data:` URLs — storing them inflates the
    // report past the ~5MB sessionStorage quota, so the write throws and the viewer
    // falls back to the DEMO report. The analysis is already done (the model saw the
    // photos server-side), so we don't need them client-side; drop only the data:
    // URLs (scraped http URLs are small and stay, so the visualiser still works).
    const slim: StoredReport = {
      ...report,
      listing: { ...report.listing, photoUrls: (report.listing.photoUrls ?? []).filter((u) => typeof u === "string" && !u.startsWith("data:")) },
    };
    sessionStorage.setItem(key(slim.id), JSON.stringify(slim));
    // Track the most recent id as a convenience fallback.
    sessionStorage.setItem("roiq:report:last", slim.id);
    return true;
  } catch {
    /* storage full / unavailable */
    return false;
  }
}

export function loadReport(id: string): StoredReport | null {
  try {
    const raw = sessionStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as StoredReport) : null;
  } catch {
    return null;
  }
}

/** Persist verified document analyses onto a stored report (survives reload). */
export function saveReportDocs(id: string, verifiedDocs: Record<string, DocAnalysis>): void {
  try {
    const raw = sessionStorage.getItem(key(id));
    if (!raw) return; // demo reports aren't in sessionStorage — state lives in memory only
    const report = JSON.parse(raw) as StoredReport;
    report.verifiedDocs = verifiedDocs;
    sessionStorage.setItem(key(id), JSON.stringify(report));
  } catch {
    /* non-fatal */
  }
}

// ── Persona preference (persisted per report across sessions) ────────────────

export function saveReportPersona(id: string, persona: Persona): void {
  try {
    localStorage.setItem(personaKey(id), persona);
  } catch {
    /* non-fatal */
  }
}

export function loadReportPersona(id: string): Persona | null {
  try {
    const v = localStorage.getItem(personaKey(id));
    return v === "buyer" || v === "investor" ? v : null;
  } catch {
    return null;
  }
}
