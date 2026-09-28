import { NextRequest, NextResponse } from "next/server";

import { isAnalysisConfigured } from "@/lib/ai/client";
import { analyseRoomPhotos, type InlinePhoto } from "@/lib/ai/item-photos";
import { ROOM_ITEMS, type RoomKind } from "@/lib/viewing/rooms";

export const runtime = "nodejs";
export const maxDuration = 120;

const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
/** A room is several items, but still one set of photographs. */
const MAX_PHOTOS = 8;
const MAX_BASE64 = 7_000_000;

/**
 * POST /api/room-photos — score every item in a room the listing never
 * photographed, from the buyer's own photographs, in one read.
 *
 * Like /api/item-photos it fills a hole in an analysis already paid for, so
 * it touches nobody's allowance. Only the room items of the named kind can be
 * asked about: a bedroom photo is never asked about the roof.
 */
export async function POST(req: NextRequest) {
  if (!isAnalysisConfigured()) {
    return NextResponse.json(
      { ok: false, error: "analysis_unavailable", message: "Photo analysis isn't configured on this server." },
      { status: 503 }
    );
  }

  let body: {
    kind?: string;
    room?: string;
    itemIds?: string[];
    photos?: { base64?: string; mediaType?: string }[];
    buildYear?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const kind = body.kind as RoomKind;
  const room = (body.room ?? "").trim().slice(0, 60);
  if (!(kind in ROOM_ITEMS) || !room) {
    return NextResponse.json({ ok: false, error: "invalid_room", message: "Which room is this?" }, { status: 400 });
  }
  const itemIds = (body.itemIds ?? []).filter((id) => ROOM_ITEMS[kind].includes(id));
  if (itemIds.length === 0) {
    return NextResponse.json({ ok: false, error: "no_items", message: "Nothing in this room to assess." }, { status: 400 });
  }

  const photos: InlinePhoto[] = [];
  for (const p of body.photos ?? []) {
    const raw = (p.base64 ?? "").replace(/^data:image\/[a-z+]+;base64,/, "");
    const mediaType = (p.mediaType ?? "image/jpeg").toLowerCase();
    if (!raw) continue;
    if (!MEDIA_TYPES.has(mediaType)) {
      return NextResponse.json({ ok: false, error: "unsupported_format", message: "Photos must be JPEG, PNG, WebP or GIF." }, { status: 415 });
    }
    if (raw.length > MAX_BASE64) {
      return NextResponse.json({ ok: false, error: "file_too_large", message: "One of the photos is too large — try again and it'll be resized." }, { status: 413 });
    }
    photos.push({ base64: raw, mediaType: mediaType as InlinePhoto["mediaType"] });
  }
  if (photos.length === 0) return NextResponse.json({ ok: false, error: "no_photos", message: "No photos received." }, { status: 400 });
  if (photos.length > MAX_PHOTOS) {
    return NextResponse.json({ ok: false, error: "too_many_photos", message: `Up to ${MAX_PHOTOS} photos per room.` }, { status: 413 });
  }

  try {
    const analyses = await analyseRoomPhotos(room, itemIds, photos, { buildYear: body.buildYear ?? null });
    return NextResponse.json({ ok: true, analyses });
  } catch (err) {
    console.error("[room-photos]", err);
    const raw = err instanceof Error ? err.message : "Photo analysis failed.";
    const overloaded = /overloaded|rate.?limit|\b429\b|\b529\b/i.test(raw);
    const outOfCredit = /credit balance is too low|insufficient.?(credit|quota)/i.test(raw);
    return NextResponse.json(
      {
        ok: false,
        error: outOfCredit ? "analysis_unavailable" : overloaded ? "overloaded" : "analysis_failed",
        message: outOfCredit ? "Photo analysis is temporarily unavailable on this account. Your photos were fine — nothing is wrong with them." : raw,
      },
      { status: outOfCredit || overloaded ? 503 : 500 }
    );
  }
}
