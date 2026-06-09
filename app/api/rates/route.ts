import { NextResponse } from "next/server";

import { isAnalysisConfigured } from "@/lib/ai/client";
import { fetchMortgageRates } from "@/lib/ai/rates";

export const runtime = "nodejs";
export const maxDuration = 60; // one web-search call

/** POST /api/rates — returns the current best NZ mortgage rate (web-searched). */
export async function POST() {
  if (!isAnalysisConfigured()) {
    return NextResponse.json({ ok: false, message: "ANTHROPIC_API_KEY is not configured." }, { status: 503 });
  }
  try {
    const rates = await fetchMortgageRates();
    if (!rates) return NextResponse.json({ ok: false, message: "Couldn't find current rates — enter manually." });
    return NextResponse.json({ ok: true, rates });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error)?.message ?? "Rate lookup failed." }, { status: 500 });
  }
}
