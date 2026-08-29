// ============================================================
// Scoring the title from the TENURE, not from the model's mood.
//
// `leg_title` was being scored by the AI reading a listing, and it was not
// consistent: on one Hokitika property it returned 9/10 tier 1 "Freehold, no
// restrictive covenants stated", and on another with the same, known, freehold
// tenure it returned "Not assessed — not visible in the listing" and no score at
// all. Both reports print "freehold" in their own header, taken from the LINZ
// register.
//
// So this follows the arrangement the foundation, topography, shape, aspect and
// frontage items already use (see lib/scoring/foundation.ts, land-quality.ts):
// the FACT is reported — here it comes from the register rather than the model —
// and the report does the arithmetic. A tenure is a category, not an opinion, so
// scoring it by lookup is both more honest and more stable than asking a
// language model how it feels about a word it may not have been shown.
//
// The ordering is the ordinary New Zealand one, and it is about what the buyer
// is actually acquiring — not about how nice the property is:
//
//   freehold (fee simple)  you own the land outright, nothing to renegotiate
//   unit title             you own a defined space; a body corporate, its levies
//                          and its long-term maintenance plan come with it
//   cross-lease            you own a share of the whole and lease your flat back;
//                          altering a footprint needs every other owner's consent,
//                          and a plan that no longer matches what is built is a
//                          defect that costs real money to put right
//   leasehold              you never own the land. Ground rent is reviewable and
//                          those reviews have moved by multiples in Auckland;
//                          the asset can be worth less as the term runs down
//   licence to occupy      not an estate in land at all — a contractual right,
//                          common in retirement villages, usually with no capital
//                          gain and an exit fee. Hardest of all to resell
//
// Dependency-free so scripts/verify-title.mjs can load it with plain node.
// ============================================================

import type { TitleType } from "@/lib/scraper/types";

export interface TitleAssessment {
  /** 1–10, the same scale every other sub-item uses. */
  score: number;
  /** 1 = from the register. Never 3: this is a fact or it is absent. */
  confidenceTier: 1 | 2 | 3;
  /** One-line status for the card. */
  finding: string;
  /** What the score is built from, in the buyer's terms. */
  rationale: string;
}

const TITLES: Record<Exclude<TitleType, "unknown">, TitleAssessment> = {
  freehold: {
    score: 10,
    confidenceTier: 1,
    finding: "Freehold — you own the land outright",
    rationale:
      "Freehold (fee simple) is the most complete ownership New Zealand offers: the land is yours, there is no ground rent, no body corporate and nobody whose consent you need to alter your own house. It is also the tenure the widest pool of buyers and lenders will accept, which matters when you come to sell.",
  },
  unit_title: {
    score: 7,
    confidenceTier: 1,
    finding: "Unit title — body corporate applies",
    rationale:
      "You own a defined space rather than the ground, and the common property is run by a body corporate. That brings levies, a long-term maintenance plan and decisions taken by vote rather than by you. None of it is a defect — it is how apartments and many townhouses work — but read the minutes, the levies and any pending special levy before you commit.",
  },
  cross_lease: {
    score: 5,
    confidenceTier: 1,
    finding: "Cross-lease — shared ownership, restricted alterations",
    rationale:
      "You own an undivided share of the whole site with all the other owners, and lease your own flat back from that group. Altering a footprint — a deck, a conservatory, an extension — needs every other owner to agree, and if what is built no longer matches the flats plan the title is defective. Fixing that means a new survey and every owner signing, which is slow and can be expensive. Compare the flats plan against what is actually there.",
  },
  leasehold: {
    score: 3,
    confidenceTier: 1,
    finding: "Leasehold — you do not own the land",
    rationale:
      "The building may be yours but the land underneath it is not, and you pay ground rent for it. Those rents are reviewed on a set cycle and Auckland reviews have moved by multiples, which can turn an affordable property into an unaffordable one without anything about the house changing. Value can also fall as the term shortens. Some lenders will not touch it. Have your solicitor read the lease — the review clause and the term remaining are the whole story.",
  },
  licence_to_occupy: {
    score: 2,
    confidenceTier: 1,
    finding: "Licence to occupy — a contractual right, not land ownership",
    rationale:
      "This is not an estate in land at all. It is a contractual right to occupy, most often in a retirement village, and it usually comes with a deferred management fee taken on exit and little or no share of any capital gain. It is the hardest tenure to resell and the most restrictive on what you may do. The occupation agreement, not the property, is what needs legal advice here.",
  },
};

/**
 * Score the title from its tenure.
 *
 * Returns null when the tenure is genuinely unknown — the register did not
 * answer and the listing did not say. That leaves the item unscored, which is
 * correct: an unknown tenure is a real gap and belongs on the viewing checklist,
 * not scored as though it were freehold.
 */
export function assessTitleType(titleType: TitleType | null | undefined): TitleAssessment | null {
  if (!titleType || titleType === "unknown") return null;
  return TITLES[titleType] ?? null;
}

/**
 * Which of three answers about the tenure to believe.
 *
 * The register used to LOSE this, and to the weakest source in the app. The
 * model's read was taken first, so a LINZ Record of Title saying cross lease
 * was overruled by a guess made from marketing photographs — and the resolved
 * tenure decides whether the cross-lease and body-corporate items are scored,
 * what the header prints, and (since a cross lease became a house) which
 * valuation method runs at all.
 *
 * In the order they deserve:
 *
 *   1. `register` — LINZ read the actual title. Nothing overrules it.
 *   2. `model` — it read the facts panel, the description and the photographs,
 *      and applied judgement to them.
 *   3. `page` — `detectTitleType` matches the word "freehold" ANYWHERE in the
 *      HTML, which a related listing or a line about the other sections this
 *      agency has for sale will satisfy. A last resort, and it must never
 *      outrank a model that actually read the page.
 *
 * Pure and dependency-light so verify:title can assert it with plain node.
 */
export function resolveTenure(sources: {
  register?: TitleType | null;
  model?: TitleType | null;
  page?: TitleType | null;
}): TitleType {
  const known = (t: TitleType | null | undefined): t is TitleType => !!t && t !== "unknown";
  if (known(sources.register)) return sources.register;
  if (known(sources.model)) return sources.model;
  if (known(sources.page)) return sources.page;
  return "unknown";
}
