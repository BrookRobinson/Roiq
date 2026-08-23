// Viewing answers, kept per report in localStorage.
//
// localStorage rather than sessionStorage on purpose: the whole point of this
// list is that it's filled in AT the property, hours or days after the report
// was read, probably on a different device's tab and certainly after the
// browser was closed. Losing it would be losing the visit.
//
// Same shape as the persona preference (lib/report-store.ts) — keyed by report
// id, silently non-fatal, never blocks a render.

import { EMPTY_VIEWING, type ViewingAnswer, type ViewingState } from "./status";

const key = (reportId: string) => `roiq:report:${reportId}:viewing`;

export function loadViewing(reportId: string): ViewingState {
  try {
    const raw = localStorage.getItem(key(reportId));
    if (!raw) return EMPTY_VIEWING;
    const parsed = JSON.parse(raw) as Partial<ViewingState>;
    return {
      viewedOn: typeof parsed.viewedOn === "string" ? parsed.viewedOn : null,
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
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
