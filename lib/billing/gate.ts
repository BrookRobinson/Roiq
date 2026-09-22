// ============================================================
// Refusing work a plan doesn't include — SERVER ONLY.
//
// One refusal, in one shape, so the browser can treat every gate the same way:
// 402 Payment Required, the feature that was missing, and the cheapest tier
// that carries it. 403 would be wrong — nothing here is forbidden, it just
// hasn't been paid for, and the client already reads 402 as "show the upsell".
// ============================================================

import { NextResponse } from "next/server";

import {
  FEATURE_FROM,
  FEATURE_LABEL,
  PLAN_LABEL,
  PLAN_PRICE_NZD,
  type Feature,
} from "@/lib/billing/plans";
import { hasFeature } from "@/lib/supabase/auth";

/**
 * Null when the caller may proceed, or the response to return when they can't.
 *
 * Fails CLOSED: a plan lookup that throws is treated as not having the feature.
 * The alternative gives paid work away whenever the database hiccups, and
 * unlike a wrongly-refused customer — who complains — that one is silent.
 */
export async function featureGate(feature: Feature): Promise<NextResponse | null> {
  const allowed = await hasFeature(feature).catch(() => false);
  if (allowed) return null;

  const needs = FEATURE_FROM[feature];
  return NextResponse.json(
    {
      ok: false,
      error: "upgrade_required",
      feature,
      needs,
      message: `${FEATURE_LABEL[feature]} is included from ${PLAN_LABEL[needs]}, $${PLAN_PRICE_NZD[needs].toLocaleString("en-NZ")}.`,
    },
    { status: 402 }
  );
}
