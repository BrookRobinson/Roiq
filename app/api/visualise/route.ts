import { NextRequest, NextResponse } from "next/server";
import { toFile } from "openai";

import { getOpenAI, IMAGE_MODEL, isImageGenConfigured } from "@/lib/ai/openai";
import { VISUAL_KINDS, VISUAL_TIERS, editPromptFor, renderPromptFor, type VisualKind } from "@/lib/visualiser";
import type { Tier } from "@/lib/reno-costing/three-tier";

export const runtime = "nodejs";
export const maxDuration = 120; // 3 gpt-image-1 renders

// Load the listing/area photo as a buffer for image-to-image editing.
async function loadImageBuffer(photoUrl?: string, photoBase64?: string): Promise<{ buf: Buffer; type: string } | null> {
  if (photoBase64) {
    const m = photoBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
    const type = m?.[1] ?? "image/png";
    const data = m?.[2] ?? photoBase64;
    try { return { buf: Buffer.from(data, "base64"), type }; } catch { return null; }
  }
  if (photoUrl) {
    try {
      const r = await fetch(photoUrl);
      if (!r.ok) return null;
      const type = r.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      return { buf: Buffer.from(await r.arrayBuffer()), type };
    } catch { return null; }
  }
  return null;
}

/**
 * POST /api/visualise
 * Body: { kind: VisualKind, photoUrl?, photoBase64? }
 * Returns three gpt-image-1 renders — one per tier (Patch Up / Replace Budget /
 * Replace High End). With a photo it edits it (img2img); otherwise generates.
 */
export async function POST(req: NextRequest) {
  let body: { kind?: VisualKind; photoUrl?: string; photoBase64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const kind: VisualKind = body.kind && VISUAL_KINDS.includes(body.kind) ? body.kind : "cladding";

  if (!isImageGenConfigured()) {
    return NextResponse.json({ ok: true, kind, renders: [], imageGenAvailable: false, usedPhoto: false });
  }

  const openai = getOpenAI();
  const base = await loadImageBuffer(body.photoUrl, body.photoBase64);

  let renders: { tier: Tier; imageUrl: string | null }[] = [];
  let imageError: string | undefined;
  try {
    renders = await Promise.all(
      VISUAL_TIERS.map(async (tier) => {
        try {
          let b64: string | null | undefined;
          if (base) {
            const ext = base.type.split("/")[1] || "png";
            const file = await toFile(base.buf, `area.${ext}`, { type: base.type });
            const r = await openai.images.edit({ model: IMAGE_MODEL, image: file, prompt: editPromptFor(kind, tier), size: "1024x1024" });
            b64 = r.data?.[0]?.b64_json;
          } else {
            const r = await openai.images.generate({ model: IMAGE_MODEL, prompt: renderPromptFor(kind, tier), size: "1024x1024" });
            b64 = r.data?.[0]?.b64_json;
          }
          return { tier, imageUrl: b64 ? `data:image/png;base64,${b64}` : null };
        } catch (e) {
          console.warn(`[visualise] render ${tier} failed:`, (e as Error)?.message);
          return { tier, imageUrl: null };
        }
      })
    );
  } catch (e) {
    imageError = (e as Error)?.message;
  }

  return NextResponse.json({
    ok: true,
    kind,
    renders,
    imageGenAvailable: true,
    usedPhoto: Boolean(base),
    imageError,
    model: IMAGE_MODEL,
  });
}
