import { NextRequest, NextResponse } from "next/server";

import { isAnalysisConfigured } from "@/lib/ai/client";
import { analyseItemPhotos, isPhotoAssessable, type InlinePhoto } from "@/lib/ai/item-photos";

export const runtime = "nodejs";
export const maxDuration = 120;

const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Six is plenty for one item, and it caps what a single request can cost. */
const MAX_PHOTOS = 6;
/** ~5MB of base64 each, well inside the API's per-request limit. */
const MAX_BASE64 = 7_000_000;

/**
 * POST /api/item-photos — assess one scoring item from photographs the buyer
 * took at the property.
 *
 * This is the other half of the viewing checklist: the report says "nobody has
 * seen the subfloor", the buyer photographs it, and the item stops being a gap.
 * It does NOT re-run the report and does not touch anyone's allowance — the
 * analysis is already bought and paid for; this fills in a hole in it.
 */
export async function POST(req: NextRequest) {
  if (!isAnalysisConfigured()) {
    return NextResponse.json(
      { ok: false, error: "analysis_unavailable", message: "Photo analysis isn't configured on this server." },
      { status: 503 }
    );
  }

  let body: {
    itemId?: string;
    photos?: { base64?: string; mediaType?: string }[];
    buildYear?: number | null;
    floorAreaSqm?: number | null;
    propertyType?: string | null;
    priorSummary?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const itemId = body.itemId ?? "";
  if (!isPhotoAssessable(itemId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "unsupported_item",
        message: "A photograph can't settle this one — it needs a document or a question to the agent.",
      },
      { status: 422 }
    );
  }

  const photos: InlinePhoto[] = [];
  for (const p of body.photos ?? []) {
    // Accept a full data: URL or bare base64; the browser sends the former.
    const raw = (p.base64 ?? "").replace(/^data:image\/[a-z+]+;base64,/, "");
    const mediaType = (p.mediaType ?? "image/jpeg").toLowerCase();
    if (!raw) continue;
    if (!MEDIA_TYPES.has(mediaType)) {
      return NextResponse.json(
        { ok: false, error: "unsupported_format", message: "Photos must be JPEG, PNG, WebP or GIF." },
        { status: 415 }
      );
    }
    if (raw.length > MAX_BASE64) {
      return NextResponse.json(
        { ok: false, error: "file_too_large", message: "One of the photos is too large — try again and it'll be resized." },
        { status: 413 }
      );
    }
    photos.push({ base64: raw, mediaType: mediaType as InlinePhoto["mediaType"] });
  }

  if (photos.length === 0) {
    return NextResponse.json({ ok: false, error: "no_photos", message: "No photos received." }, { status: 400 });
  }
  if (photos.length > MAX_PHOTOS) {
    return NextResponse.json(
      { ok: false, error: "too_many_photos", message: `Up to ${MAX_PHOTOS} photos per item.` },
      { status: 413 }
    );
  }

  try {
    const analysis = await analyseItemPhotos(itemId, photos, {
      buildYear: body.buildYear ?? null,
      floorAreaSqm: body.floorAreaSqm ?? null,
      propertyType: body.propertyType ?? null,
      priorSummary: body.priorSummary ?? null,
    });
    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    console.error("[item-photos]", err);
    const raw = err instanceof Error ? err.message : "Photo analysis failed.";
    const overloaded = /overloaded|rate.?limit|\b429\b|\b529\b/i.test(raw);
    // An empty account returns a 400 with the billing message in it. Left raw it
    // reads to the buyer as "your photo was rejected", which sends them off
    // retaking a picture that was fine.
    const outOfCredit = /credit balance is too low|insufficient.?(credit|quota)/i.test(raw);
    const message = outOfCredit
      ? "Photo analysis is temporarily unavailable on this account. Your photo was fine — nothing is wrong with it."
      : raw;
    return NextResponse.json(
      {
        ok: false,
        error: outOfCredit ? "analysis_unavailable" : overloaded ? "overloaded" : "analysis_failed",
        message,
      },
      { status: outOfCredit || overloaded ? 503 : 500 }
    );
  }
}
