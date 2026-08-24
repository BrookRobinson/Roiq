// ============================================================
// Reconciling two copies of a viewing.
//
// The buyer answers the checklist standing at a property, on a phone, quite
// possibly with no signal. So the device writes locally first and syncs when it
// can — which means there are routinely two copies: what this browser has, and
// what the server was last told, possibly by a different device.
//
// Neither copy is authoritative. Somebody can start the list on a laptop the
// night before and finish it at the open home on their phone, and both halves
// have to survive. So this merges per ANSWER rather than per state, keeping
// whichever record was recorded later — losing an answer means sending someone
// back to a house they've already been to.
//
// Dependency-free, like ./status, so verify:viewing can assert it.
// ============================================================

import type { ViewingState } from "./status";

const at = (v: { answeredAt?: string } | undefined) => v?.answeredAt ?? "";
const shot = (v: { analysedAt?: string } | undefined) => v?.analysedAt ?? "";

/**
 * @param remote what the server holds (possibly from another device)
 * @param local  what this browser holds
 *
 * Ties go to `local`: it is the device in the buyer's hand, and it is the copy
 * that may hold something typed seconds ago and not yet sent.
 */
export function mergeViewing(remote: ViewingState, local: ViewingState): ViewingState {
  const answers = { ...remote.answers };
  for (const [k, v] of Object.entries(local.answers ?? {})) {
    if (!answers[k] || at(v) >= at(answers[k])) answers[k] = v;
  }

  const photos = { ...(remote.photos ?? {}) };
  for (const [k, v] of Object.entries(local.photos ?? {})) {
    if (!photos[k] || shot(v) >= shot(photos[k])) photos[k] = v;
  }

  return {
    // The date they went is a fact about the property visit, not about the edit,
    // so a recorded one never loses to a blank one on the other side.
    viewedOn: local.viewedOn ?? remote.viewedOn ?? null,
    answers,
    photos,
  };
}

/**
 * A deletion is the one thing a merge can't see.
 *
 * Clearing an answer removes the key, and a key absent on one side looks exactly
 * like a key that side has never seen — so the merge puts it straight back. This
 * is why the sync sends the WHOLE state on every write and the server takes it
 * verbatim: the merge runs once on load, to fold in whatever another device did
 * while this one was away, and never again.
 */
export const MERGE_ON_LOAD_ONLY = true;
