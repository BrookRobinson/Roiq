// Downloads listing photo URLs, downscales them, and prepares them as base64
// image blocks for the Claude vision API.
//
// Two things matter here:
//  1. Photo numbers are 1-based on the ORIGINAL url order and stay stable even
//     when individual fetches fail, so the model's photo_references line up with
//     what the user sees in the listing.
//  2. Images are downscaled to <=1568px before upload. The Anthropic API
//     downscales anything larger server-side anyway (so token count / quality is
//     unchanged), but sending full-res originals made the request ~9x larger and
//     upload-bound — ~180s vs ~6s in testing. Resizing is the single biggest
//     latency win for report generation.

import type Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

export interface PreparedImage {
  number: number; // 1-based, matches original listing order
  media: Anthropic.Base64ImageSource["media_type"];
  buf: Buffer; // downscaled image bytes — base64-inline it, or upload once via the Files API
}

const ALLOWED_MEDIA: ReadonlyArray<Anthropic.Base64ImageSource["media_type"]> = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_IMAGES = 20; // keep token cost bounded; typical NZ listing has ~12-20 photos
const MAX_BYTES = 12 * 1024 * 1024; // skip absurdly large originals before downscaling
const MAX_TOTAL_BYTES = 18 * 1024 * 1024; // safety cap on cumulative payload (post-downscale this rarely binds)
const TARGET_MAX_DIM = 1568; // Anthropic downscales above this anyway
const JPEG_QUALITY = 80;

function mediaFromContentType(ct: string | null): Anthropic.Base64ImageSource["media_type"] | null {
  const base = (ct ?? "").split(";")[0]?.trim().toLowerCase();
  return (ALLOWED_MEDIA as string[]).includes(base)
    ? (base as Anthropic.Base64ImageSource["media_type"])
    : null;
}

function mediaFromUrl(url: string): Anthropic.Base64ImageSource["media_type"] | null {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  return null;
}

interface Fetched {
  number: number;
  media: Anthropic.Base64ImageSource["media_type"];
  buf: Buffer;
}

async function fetchAndDownscale(url: string, index: number): Promise<Fetched | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;

    const orig = Buffer.from(await res.arrayBuffer());
    if (orig.length === 0 || orig.length > MAX_BYTES) return null;

    try {
      const out = await sharp(orig)
        .rotate() // honour EXIF orientation
        .resize(TARGET_MAX_DIM, TARGET_MAX_DIM, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
      return { number: index + 1, media: "image/jpeg", buf: out };
    } catch {
      // sharp couldn't process this format — fall back to the original bytes
      const m = mediaFromContentType(res.headers.get("content-type")) ?? mediaFromUrl(url);
      return m ? { number: index + 1, media: m, buf: orig } : null;
    }
  } catch {
    // unreachable / malformed image — skip, numbering stays stable
    return null;
  }
}

export async function prepareImages(
  urls: string[],
  max: number = MAX_IMAGES
): Promise<PreparedImage[]> {
  const slice = urls.slice(0, max);

  // Fetch + downscale concurrently (network is the slow part); order is preserved.
  const fetched = (await Promise.all(slice.map((u, i) => fetchAndDownscale(u, i)))).filter(
    (x): x is Fetched => x !== null
  );

  const out: PreparedImage[] = [];
  let totalBytes = 0;
  for (const f of fetched) {
    if (totalBytes + f.buf.length > MAX_TOTAL_BYTES) break;
    totalBytes += f.buf.length;
    out.push({ number: f.number, media: f.media, buf: f.buf });
  }
  return out;
}
