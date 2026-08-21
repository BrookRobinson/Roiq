// The shape stored under a share token when the share is an agent document
// rather than a full report. Lives here rather than in the route because a
// Next.js route file may only export its handlers.

import type { NegotiationCase } from "./build";

/** Marks a shared_reports row as a negotiation document. */
export const NEGOTIATION_KIND = "negotiation";

export interface NegotiationPayload {
  kind: typeof NEGOTIATION_KIND;
  case: NegotiationCase;
  preparedBy?: string;
  note?: string;
}
