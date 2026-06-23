// Client-side draft for the multi-step post flow (sessionStorage — mirrors the
// app's report-store.ts pattern). Holds the in-progress job across the 3 steps.

export interface JobDraft {
  category?: string;
  material?: string;
  colour?: string; // roof colour id
  description?: string;
  address?: string;
  region?: string; // NZ region
  photos?: string[]; // data: URLs
}

const KEY = "roiq:mp:draft";

export function loadDraft(): JobDraft {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}") as JobDraft;
  } catch {
    return {};
  }
}

export function saveDraft(patch: JobDraft): JobDraft {
  const next = { ...loadDraft(), ...patch };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full / unavailable */
  }
  return next;
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
