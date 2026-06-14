// Photo categories for the manual upload flow. Mandatory photos block the report
// from running; optional photos only soften the warning. Shared by the upload UI,
// the analyze pipeline (photo labels → the vision prompt) and the report (coverage
// indicator + per-area "not assessed" notes).

export interface PhotoCategory {
  id: string;
  label: string;
  mandatory: boolean;
  hint?: string;
}

export const PHOTO_CATEGORIES: PhotoCategory[] = [
  // ── Mandatory — the report cannot run without these ──
  { id: "front_exterior", label: "Front exterior", mandatory: true, hint: "Street-facing elevation" },
  { id: "front_yard", label: "Front yard", mandatory: true },
  { id: "backyard", label: "Backyard", mandatory: true },
  { id: "rear_exterior", label: "Rear exterior", mandatory: true },
  { id: "roof", label: "Roof", mandatory: true, hint: "From the ground or drone" },
  { id: "kitchen", label: "Kitchen", mandatory: true },
  { id: "bathroom", label: "Bathroom", mandatory: true },
  { id: "living", label: "Living room / lounge", mandatory: true },
  { id: "bedroom1", label: "Bedroom 1", mandatory: true },
  // ── Optional — report runs, but accuracy improves with these ──
  { id: "hallway", label: "Hallway", mandatory: false },
  { id: "bedroom2", label: "Bedroom 2", mandatory: false },
  { id: "bedroom3", label: "Bedroom 3", mandatory: false },
  { id: "laundry", label: "Laundry", mandatory: false },
  { id: "garage", label: "Garage / carport", mandatory: false },
  { id: "subfloor", label: "Subfloor", mandatory: false },
];

export const MANDATORY_CATEGORIES = PHOTO_CATEGORIES.filter((c) => c.mandatory);
export const OPTIONAL_CATEGORIES = PHOTO_CATEGORIES.filter((c) => !c.mandatory);

const BY_ID = new Map(PHOTO_CATEGORIES.map((c) => [c.id, c]));
export const categoryLabel = (id: string): string => BY_ID.get(id)?.label ?? id;

/** Coverage summary used by the report header + warnings. */
export interface PhotoCoverage {
  provided: string[]; // category ids that have a photo
  missingMandatory: string[]; // mandatory ids with no photo
  missingOptional: string[]; // optional ids with no photo
}

export function coverageFor(providedIds: string[]): PhotoCoverage {
  const set = new Set(providedIds);
  return {
    provided: PHOTO_CATEGORIES.filter((c) => set.has(c.id)).map((c) => c.id),
    missingMandatory: MANDATORY_CATEGORIES.filter((c) => !set.has(c.id)).map((c) => c.id),
    missingOptional: OPTIONAL_CATEGORIES.filter((c) => !set.has(c.id)).map((c) => c.id),
  };
}
