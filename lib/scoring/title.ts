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
import { crossLeaseDiscount, type CrossLeaseSharing } from "./cross-lease";

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
 * What we know about a cross-lease site, where we know anything.
 *
 * `coOwners` is the denominator of the LINZ share — the "2" in "Fee Simple,
 * 1/2". `sharing` is what the analysis could see of how separate the flats
 * are. Both optional: without them the tenure scores at its flat base, which is
 * what it has always done.
 */
export interface CrossLeaseContext {
  coOwners?: number | null;
  sharing?: CrossLeaseSharing | null;
}

/** Cross-lease can move within this range, and never outside it. */
const CROSS_LEASE_BEST = 6;
const CROSS_LEASE_WORST = 4;

/**
 * The cross-lease score, positioned by the SAME model that sizes the valuation
 * discount — deliberately, because they are two expressions of one finding and
 * had started telling different stories about the same house.
 *
 * The valuation already grades how entangled a site is: two flats side by side
 * with their own driveways discount at 5%, a rear flat up a shared right-of-way
 * at 8%. The score meanwhile handed every cross lease in the country a flat 5,
 * so the headline number — the one a buyer actually reads — was the LESS
 * informed of the two, off data already in hand.
 *
 * Reading the discount rather than re-deriving anything means they cannot
 * disagree. The mapping keeps 5 where it has always been for the ordinary case:
 *
 *   5%     the most separate arrangement a cross lease manages     → 6
 *   6%     two flats, nothing observed — today's default           → 5
 *   7.5%   the Property Institute's headline figure                → 5
 *   8–10%  shared drive, shared grounds, a rear flat               → 4
 *
 * It is FLOORED AT 4, above leasehold's 3. However tangled a cross lease is,
 * the owner still holds a share of the fee simple; a leaseholder owns no land
 * at all and faces ground-rent reviews that have moved by multiples. And capped
 * at 6, below unit title's 7: the flats plan can still be defective, and every
 * footprint change still needs the neighbours' signatures. Those restrictions
 * are the tenure and no amount of fencing removes them.
 */
function crossLeaseAssessment(ctx: CrossLeaseContext): TitleAssessment {
  const base = TITLES.cross_lease;
  if (!ctx.coOwners || ctx.coOwners < 2) return base;

  const d = crossLeaseDiscount(ctx.coOwners, ctx.sharing);
  const score = d.pct <= 5.5 ? CROSS_LEASE_BEST : d.pct <= 7.5 ? base.score : CROSS_LEASE_WORST;

  const flats = d.coOwners === 2 ? "two flats" : `${d.coOwners} flats`;
  const observed = d.factors.length
    ? ` Here the site is shared between ${flats}: ${d.factors.map((f) => f.label.toLowerCase()).join(", ")}.`
    : ` Here the site is shared between ${flats}, and the listing didn't show enough to tell how separate they really are.`;

  return { ...base, score, rationale: base.rationale + observed };
}

/**
 * Score the title from its tenure.
 *
 * Returns null when the tenure is genuinely unknown — the register did not
 * answer and the listing did not say. That leaves the item unscored, which is
 * correct: an unknown tenure is a real gap and belongs on the viewing checklist,
 * not scored as though it were freehold.
 *
 * A cross lease takes an optional second argument, because it is the one tenure
 * whose burden genuinely varies between properties. Everything else is the
 * category and nothing more.
 */
export function assessTitleType(
  titleType: TitleType | null | undefined,
  crossLease?: CrossLeaseContext | null
): TitleAssessment | null {
  if (!titleType || titleType === "unknown") return null;
  if (titleType === "cross_lease" && crossLease) return crossLeaseAssessment(crossLease);
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

// ── What is registered against the title ────────────────────────────────────
//
// These two items — "Encumbrances / caveats" and "Easements & covenants on
// title" — were the model's to guess at, and it guessed 2/2 "Low concern",
// badged "Confirmed from the public record", against a record nobody had read.
// LINZ publishes the instruments (lib/linz/encumbrances.ts), so they are scored
// from them here, the same arrangement the tenure and the foundation use: the
// fact comes from the register, the report does the arithmetic.
//
// THE LIMIT IS LOAD-BEARING. We get an instrument's TYPE, number and date. We do
// NOT get its TEXT — the wording of a covenant is inside the instrument
// document, a paid Landonline download. So we know a land covenant exists and
// cannot know whether it bans a minor dwelling or specifies a letterbox.
//
// That is why there is no severity staircase here. Grading "3 covenants = 4/10"
// would be inventing weight for documents nobody has read, which is the same
// mistake as the condition multiplier this codebase has already deleted twice.
// What IS knowable is presence and absence, and absence is the strong finding:
// a title with nothing registered against it is a real, checkable result.

/** One instrument, as far as scoring cares. */
export interface RegisteredInstrument {
  kind: "easement" | "covenant" | "caveat" | "lease" | "mortgage" | "statutory" | "other";
}

/**
 * "Encumbrances / caveats" — a live caveat, or a charge imposed by statute.
 *
 * A caveat is the one thing here that is unambiguously serious without reading
 * a word of it: somebody has registered a claim against this land and nothing
 * can be dealt with until it is removed or lapses. On a property being actively
 * marketed that is a dispute, a debt or a deal that fell over.
 */
export function assessEncumbrances(instruments: RegisteredInstrument[]): TitleAssessment | null {
  const caveats = instruments.filter((i) => i.kind === "caveat").length;
  const statutory = instruments.filter((i) => i.kind === "statutory").length;

  if (caveats > 0) {
    return {
      score: 2,
      confidenceTier: 1,
      finding: `${caveats === 1 ? "A caveat is" : `${caveats} caveats are`} registered against this title`,
      rationale:
        "A caveat is a formal claim by somebody other than the owner, and while it stands nothing can be registered against the title that conflicts with it — including the transfer to you. It has to be removed or lapse before settlement. It usually means a dispute, an unregistered lender, a relationship-property claim or a deal that fell through. Your solicitor needs the caveat and the vendor's plan for removing it before you go unconditional.",
    };
  }
  if (statutory > 0) {
    return {
      score: 6,
      confidenceTier: 1,
      finding: `${statutory === 1 ? "A statutory charge or notice is" : `${statutory} statutory charges or notices are`} registered`,
      rationale:
        "Something imposed by legislation is noted against this title — a statutory land charge, a settlement-act certificate or similar. It stays with the land and binds you. We can name the instrument and its number but not read its terms, because the wording sits inside the instrument document rather than on the register. Give the number to your solicitor.",
    };
  }
  return {
    score: 10,
    confidenceTier: 1,
    finding: "No caveats or statutory charges on the title",
    rationale:
      "We read the current memorials on the record of title and found no caveat and no statutory charge. Mortgages and, on a cross lease, the flat leases are not counted here: a mortgage is discharged on settlement and the lease IS the tenure. This is what the register says today; a caveat can be lodged at any time, so your solicitor will check it again immediately before settlement.",
  };
}

/**
 * "Easements & covenants on title" — the burdens that stay with the land.
 *
 * Scored on presence, never on severity. One easement is the ordinary case for
 * a suburban section (drainage, power, a shared accessway) and is not a defect;
 * several is a reason to read them all. Floored at 6, because "there is a
 * covenant here and we cannot read it" is a caution and not a fault — the
 * covenant might ban a second dwelling or it might require a letterbox, and
 * scoring it as though we knew which would be invention.
 */
export function assessEasements(instruments: RegisteredInstrument[]): TitleAssessment | null {
  const items = instruments.filter((i) => i.kind === "easement" || i.kind === "covenant");
  const easements = items.filter((i) => i.kind === "easement").length;
  const covenants = items.filter((i) => i.kind === "covenant").length;

  if (items.length === 0) {
    return {
      score: 10,
      confidenceTier: 1,
      finding: "No easements or covenants registered",
      rationale:
        "We read the current memorials on the record of title and found no easement and no covenant. Nobody else holds a registered right over this land, and nothing on the register restricts what you may build on it. Any restriction therefore comes from the district plan rather than the title.",
    };
  }

  const parts: string[] = [];
  if (easements) parts.push(`${easements} easement${easements > 1 ? "s" : ""}`);
  if (covenants) parts.push(`${covenants} covenant${covenants > 1 ? "s" : ""}`);
  const score = items.length === 1 ? 8 : items.length === 2 ? 7 : 6;

  return {
    score,
    confidenceTier: 1,
    finding: `${parts.join(" and ")} registered against this title`,
    rationale:
      `The register carries ${parts.join(" and ")}, and they stay with the land — you inherit them. An easement is somebody else's right over your property, most often drainage, power or a shared accessway; a covenant restricts what may be built or done here, and can rule out a second dwelling, a particular cladding or a further subdivision. ` +
      "We can name each instrument and its number, but NOT its terms: the wording is inside the instrument document, which is a paid download from Landonline and not on the register itself. So this score reflects that they exist, not how heavy they are. Give the instrument numbers to your solicitor and ask specifically whether anything blocks what you intend to do with the place.",
  };
}
