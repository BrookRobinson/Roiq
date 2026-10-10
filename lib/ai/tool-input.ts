// ============================================================
// Reading the analysis tool's input when the model has stringified part of it.
//
// The tool input should be { edited_photos: [...], sub_items: [...], ... }.
// On 11 October 2026 a real run (172 Park Street, Hokitika) came back as
//   { sub_items: "{\"sub_items\":[ …60 complete findings… ]}" }
// — the whole answer, correctly written, as ONE STRING inside the field that
// should have held the list. Nothing threw. The code iterated a string looking
// for objects with an id, found none, and handed the reader sixty "the analysis
// didn't return a finding" placeholders: a four-minute, fully paid-for analysis
// shown as an empty report. From outside it was indistinguishable from the
// truncation failure and from unreadable photographs.
//
// So this unwraps what can be unwrapped, and the caller refuses to treat an
// answer with no findings as a report (see `assertHasFindings` in analyze.ts).
//
// Pure, no imports — scripts/verify-edited-photos.mjs loads it directly.
// ============================================================

const LIST_FIELDS = ["sub_items", "edited_photos", "extra_dwellings", "information_gaps", "location_penalties"] as const;
const OBJECT_FIELDS = ["property_context"] as const;

function parse(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Returns the input with any stringified field parsed, and a whole answer
 * nested inside `sub_items` lifted back to the top level. A field that still
 * isn't the right shape afterwards is DROPPED rather than passed on, so nothing
 * downstream iterates a string.
 */
export function normaliseToolInput(input: unknown): Record<string, unknown> {
  let out: Record<string, unknown> = isObject(input) ? { ...input } : {};

  // The whole answer inside sub_items: { sub_items: "{\"sub_items\":[…], …}" }
  // (or the same without the stringifying). Outer fields win over inner ones.
  const inner = parse(out.sub_items);
  if (isObject(inner) && "sub_items" in inner) {
    out = { ...inner, ...out, sub_items: inner.sub_items };
  } else {
    out.sub_items = inner;
  }

  for (const f of LIST_FIELDS) {
    const v = parse(out[f]);
    if (Array.isArray(v)) out[f] = v;
    else delete out[f];
  }
  for (const f of OBJECT_FIELDS) {
    const v = parse(out[f]);
    if (isObject(v)) out[f] = v;
    else delete out[f];
  }
  return out;
}
