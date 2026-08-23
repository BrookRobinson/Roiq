// ============================================================
// The gate itself, and the rule that decides what the letter may say about each
// item once the buyer has been to the property.
//
// Deliberately dependency-free — no imports at all — so `npm run verify:viewing`
// can load it with plain node and assert both rules exhaustively. A mistake here
// either lets an unviewed property's letter go to a vendor's agent, or puts a
// dollar figure against something nobody could look at. Neither throws.
// ============================================================

/** What the buyer found. There is no "skip" — "no_access" IS the answer when
 *  the thing genuinely couldn't be reached, and the letter then says so. */
export type ViewingAnswer = "ok" | "problem" | "no_access";

export interface ViewingRecord {
  answer: ViewingAnswer;
  /** The buyer's own words. Carried into the letter for `problem` / `no_access`. */
  note?: string;
  answeredAt: string;
}

export interface ViewingState {
  /** ISO date the property was actually walked through. The letter states it. */
  viewedOn: string | null;
  answers: Record<string, ViewingRecord>;
}

export const EMPTY_VIEWING: ViewingState = { viewedOn: null, answers: {} };

export const ANSWER_LABEL: Record<ViewingAnswer, string> = {
  ok: "No issue",
  problem: "Problem confirmed",
  no_access: "Couldn't inspect",
};

// ── The gate ─────────────────────────────────────────────────────────────────

export interface ChecklistStatus {
  total: number;
  answered: number;
  outstanding: number;
  /** Every line answered AND a viewing date recorded. */
  complete: boolean;
  /** Answered, but nobody has said they actually went. */
  missingViewingDate: boolean;
  problems: number;
  noAccess: number;
}

/**
 * Both halves are required. Answering every line without recording a date would
 * let someone fill the form in at their desk, and the date is the one sentence
 * in the letter that says a person stood in the house.
 */
export function checklistStatus(items: { key: string }[], state: ViewingState): ChecklistStatus {
  let answered = 0;
  let problems = 0;
  let noAccess = 0;
  for (const it of items) {
    const rec = state.answers[it.key];
    if (!rec) continue;
    answered++;
    if (rec.answer === "problem") problems++;
    if (rec.answer === "no_access") noAccess++;
  }
  const allAnswered = answered === items.length;
  return {
    total: items.length,
    answered,
    outstanding: items.length - answered,
    complete: allAnswered && Boolean(state.viewedOn),
    missingViewingDate: allAnswered && !state.viewedOn,
    problems,
    noAccess,
  };
}

// ── What the letter may do with one item ─────────────────────────────────────

export type Disposition =
  /** Goes in the schedule with its cost — the case being put to the vendor. */
  | "claim"
  /** Checked on site and sound. Removed, and the letter says how many were. */
  | "drop"
  /** The buyer's own observation of something the analysis never scored. Listed,
   *  attributed to them, never costed. */
  | "observe"
  /** Nobody could look at it. Listed as an open question, never costed. */
  | "unverified";

/**
 * The whole rule, in one place.
 *
 * `scored` means the analysis put a critical/urgent grade on it. The two
 * dangerous cells are the ones that used to be the only behaviour: a scored item
 * with no answer, and a scored item the buyer couldn't reach — both went to the
 * agent as costed claims about a house nobody had walked through.
 */
export function dispositionFor(answer: ViewingAnswer | undefined, scored: boolean): Disposition {
  if (answer === "ok") return "drop";
  if (answer === "no_access") return "unverified";
  if (answer === "problem") return scored ? "claim" : "observe";
  // No answer. Only reachable for an item that was never on the checklist —
  // a Tier 1 finding confirmed from a photograph — because the letter is locked
  // until every checklist line is answered.
  return scored ? "claim" : "drop";
}
