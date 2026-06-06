// Transient client-side store for a freshly generated analysis, so /report/new
// can hand a real result to /report/[id] without a database yet.
//
// sessionStorage = per-tab, survives the navigation + a refresh within the
// session. This is NOT real persistence (that needs the Supabase reports table);
// it's enough to wire the real paste → analyse → full-report flow for now.

import type { PropertyTabData } from "@/lib/property-tab/types";
import type { ScrapedListing } from "@/lib/scraper/types";

export interface StoredGap {
  gapType: string;
  area: string;
  description: string;
  includedInAgentLetter: boolean;
  includedInLimLetter: boolean;
}

export interface StoredReport {
  id: string;
  createdAt: string;
  listing: ScrapedListing;
  data: PropertyTabData;
  score: { baseScore: number; dwellingBonus: number; totalScore: number };
  gaps: StoredGap[];
  photosAnalysed: number;
  model: string;
}

const key = (id: string) => `roiq:report:${id}`;

export function saveReport(report: StoredReport): void {
  try {
    sessionStorage.setItem(key(report.id), JSON.stringify(report));
    // Track the most recent id as a convenience fallback.
    sessionStorage.setItem("roiq:report:last", report.id);
  } catch {
    /* storage full / unavailable — non-fatal */
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
