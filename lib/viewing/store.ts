// Viewing answers: on the device first, on the server after.
//
// The order matters and is not an implementation detail. This list gets filled
// in AT the property — on a phone, in someone else's driveway, on whatever
// signal is going. So every answer is written to localStorage synchronously and
// is safe the instant it's tapped; the server sync is a background nicety that
// makes it follow the buyer to another device, and it is allowed to fail
// silently as often as it likes.
//
// The two copies are merged once, on load (./merge.ts), because the night-before
// laptop and the open-home phone both hold real answers.

import { EMPTY_VIEWING, type ViewingAnswer, type ViewingState } from "./status";
import type { ItemPhotoAnalysis } from "./photo-types";
import { mergeViewing } from "./merge";

const key = (reportId: string) => `roiq:report:${reportId}:viewing`;

export function loadViewing(reportId: string): ViewingState {
  try {
    const raw = localStorage.getItem(key(reportId));
    if (!raw) return EMPTY_VIEWING;
    const parsed = JSON.parse(raw) as Partial<ViewingState>;
    return {
      viewedOn: typeof parsed.viewedOn === "string" ? parsed.viewedOn : null,
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
      photos: parsed.photos && typeof parsed.photos === "object" ? parsed.photos : {},
    };
  } catch {
    return EMPTY_VIEWING;
  }
}

export function saveViewing(reportId: string, state: ViewingState): void {
  try {
    localStorage.setItem(key(reportId), JSON.stringify(state));
  } catch {
    /* storage full / unavailable — the answers stay in memory for this session */
  }
  queueSync(reportId, state);
}

// ── Server sync ──────────────────────────────────────────────────────────────

/**
 * A report id the server could actually know about.
 *
 * The demo and the map's sample reports aren't rows in anyone's database, so
 * syncing them is a request that can only 404. Same uuid test the report view
 * uses to decide whether a report is real.
 */
const isRealReport = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Debounced, because a note commits on every keystroke pause and a whole
 * checklist gets answered in a fast run of taps. The device's copy is already
 * written; this only decides how soon another device sees it.
 */
function queueSync(reportId: string, state: ViewingState): void {
  if (typeof window === "undefined" || !isRealReport(reportId)) return;
  const existing = timers.get(reportId);
  if (existing) clearTimeout(existing);
  timers.set(
    reportId,
    setTimeout(() => {
      timers.delete(reportId);
      void pushViewing(reportId, state);
    }, 1200)
  );
}

/** Send the WHOLE state. See the note on deletions in ./merge.ts. */
async function pushViewing(reportId: string, state: ViewingState): Promise<void> {
  try {
    await fetch(`/api/reports/${reportId}/viewing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewing: state }),
      keepalive: true, // survives the tab being closed mid-write
    });
  } catch {
    /* No signal at the property. The device's copy stands and the next
       change re-sends everything, so nothing needs retrying here. */
  }
}

/**
 * What the server holds for this report, folded into what this device holds.
 *
 * Returns the local state unchanged on any failure — including no network and
 * "not your report" — so a signed-out reader or a Pro subscriber looking at
 * somebody else's report simply keeps their own copy.
 */
export async function syncViewing(reportId: string, local: ViewingState): Promise<ViewingState> {
  if (!isRealReport(reportId)) return local;
  try {
    const res = await fetch(`/api/reports/${reportId}/viewing`);
    if (!res.ok) return local;
    const j = await res.json();
    const remote = j?.viewing;
    if (!remote || typeof remote !== "object") return local;
    const merged = mergeViewing(
      {
        viewedOn: typeof remote.viewedOn === "string" ? remote.viewedOn : null,
        answers: remote.answers && typeof remote.answers === "object" ? remote.answers : {},
        photos: remote.photos && typeof remote.photos === "object" ? remote.photos : {},
      },
      local
    );
    // Write the merge back both ways so the two copies agree from here on.
    try {
      localStorage.setItem(key(reportId), JSON.stringify(merged));
    } catch {
      /* non-fatal */
    }
    void pushViewing(reportId, merged);
    return merged;
  } catch {
    return local;
  }
}

/** Record (or clear, with `null`) one line's answer. Returns the new state. */
export function setAnswer(
  state: ViewingState,
  itemKey: string,
  answer: ViewingAnswer | null,
  note?: string
): ViewingState {
  const answers = { ...state.answers };
  if (answer === null) {
    delete answers[itemKey];
  } else {
    answers[itemKey] = {
      answer,
      note: note?.trim() ? note.trim() : undefined,
      answeredAt: new Date().toISOString(),
    };
  }
  return { ...state, answers };
}

export function setNote(state: ViewingState, itemKey: string, note: string): ViewingState {
  const existing = state.answers[itemKey];
  if (!existing) return state;
  return {
    ...state,
    answers: { ...state.answers, [itemKey]: { ...existing, note: note.trim() || undefined } },
  };
}

export function setViewedOn(state: ViewingState, iso: string | null): ViewingState {
  return { ...state, viewedOn: iso };
}

/**
 * File an analysed photograph against an item — and drop any answer that item
 * had.
 *
 * The answer is superseded, not merged. Somebody who ticked "couldn't inspect"
 * on the subfloor and then got under the house with a torch has settled it; if
 * the stale answer survived, the letter would still report the item as one
 * nobody could reach while the report shows a photo-confirmed score for it.
 */
export function setItemPhoto(
  state: ViewingState,
  itemId: string,
  analysis: ItemPhotoAnalysis
): ViewingState {
  const answers = { ...state.answers };
  delete answers[itemId];
  return { ...state, answers, photos: { ...(state.photos ?? {}), [itemId]: analysis } };
}

/** Remove a photo assessment — the item goes back to being an open question. */
export function clearItemPhoto(state: ViewingState, itemId: string): ViewingState {
  const photos = { ...(state.photos ?? {}) };
  delete photos[itemId];
  return { ...state, photos };
}
