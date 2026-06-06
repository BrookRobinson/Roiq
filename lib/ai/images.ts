// Downloads listing photo URLs and prepares them as base64 image blocks for the
// Claude vision API. Photo numbers are 1-based on the ORIGINAL url order and stay
// stable even when individual fetches fail, so the model's photo_references line
// up with what the user sees in the listing.

import type Anthropic from "@anthropic-ai/sdk";

export interface PreparedImage {
  number: number; // 1-based, matches original listing order
  block: Anthropic.ImageBlockParam;
}

const ALLOWED_MEDIA: ReadonlyArray<Anthropic.Base64ImageSource["media_type"]> = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_IMAGES = 20; // keep token cost bounded; typical NZ listing has ~12-20 photos
const MAX_BYTES = 5 * 1024 * 1024; // skip anything over 5MB (API per-image limit territory)

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

export async function prepareImages(
  urls: string[],
  max: number = MAX_IMAGES
): Promise<PreparedImage[]> {
  const out: PreparedImage[] = [];

  for (let i = 0; i < urls.length && out.length < max; i++) {
    const url = urls[i];
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) continue;

      const media = mediaFromContentType(res.headers.get("content-type")) ?? mediaFromUrl(url);
      if (!media) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_BYTES) continue;

      out.push({
        number: i + 1,
        block: {
          type: "image",
          source: { type: "base64", media_type: media, data: buf.toString("base64") },
        },
      });
    } catch {
      // skip unreachable / malformed images, keep numbering stable
    }
  }

  return out;
}
