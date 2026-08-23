// Shrink a photo in the browser before it's sent for analysis.
//
// These come off a phone at the property — 12 megapixels and 4MB each, several
// at a time, over whatever signal is outside the house. The vision model gains
// nothing above ~1568px on the long edge, so sending the original spends the
// buyer's data allowance and their patience for no extra accuracy.

/** Anthropic's long-edge sweet spot: bigger costs more tokens and reads no better. */
const MAX_EDGE = 1568;
const QUALITY = 0.82;

export interface ResizedPhoto {
  /** Bare base64, no data: prefix. */
  base64: string;
  mediaType: "image/jpeg";
  /** For the preview thumbnail, before it's discarded. */
  dataUrl: string;
}

export async function resizePhoto(file: File): Promise<ResizedPhoto> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read that photo.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  // JPEG regardless of what came in: HEIC arrives from iPhones already decoded
  // by createImageBitmap, and PNG screenshots of a photo are needlessly large.
  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  return { base64: dataUrl.split(",")[1] ?? "", mediaType: "image/jpeg", dataUrl };
}
