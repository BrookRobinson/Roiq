// ============================================================
// What can be bought, what each purchase grants, and how long it lasts.
//
// Pure and import-safe from client components — no Stripe SDK, no env secrets,
// no database. The server turns these into Stripe line items in ./stripe.ts.
//
// Three packages, because there are only three things a buyer actually wants
// more of: reports, the map, and a person on site.
//
//   Bronze   choose how many reports; the price per report falls as it rises
//   Silver   50 reports AND the map
//   Gold     75 reports, the map, and a building inspector on the property
//
// The map is never sold on its own, deliberately. Every coloured pin is a
// report somebody ran, so a map bought without reports is a map that never
// fills — the buyer gets less than they paid for and so does everybody after
// them. Bundling it with 50 reports is the flywheel, not a packaging trick.
// ============================================================

export type Package = "bronze" | "silver" | "gold";

export const PACKAGES: Package[] = ["bronze", "silver", "gold"];

export const PACKAGE_LABEL: Record<Package, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

export const PACKAGE_TAGLINE: Record<Package, string> = {
  bronze: "Pay for the houses you're actually looking at",
  silver: "The whole country on a map, and the reports to fill it",
  gold: "Everything, and an inspector on the one you choose",
};

export const PACKAGE_COLOUR: Record<Package, string> = {
  bronze: "#9A7B4F",
  silver: "#8A96A6",
  gold: "#C9A227",
};

/** Map access lasts this many days. Nothing auto-renews — see the migration. */
export const MAP_DAYS = 30;

// ── What a report costs, and why it gets cheaper ─────────────────────────────
//
// A report costs roughly NZ$1.45 to produce (the Claude vision pass plus the
// market lookups, measured September 2026). The curve below is a volume
// discount on top of that, not a margin cliff — every quantity clears the cost
// several times over, and the top of it still leaves more than the bottom of a
// single sale.
//
// A buyer looking at one house is not price-sensitive and buys once; somebody
// working through forty listings is, and comes back. Charging them the same
// per report would lose the second one.

/** The quantities offered. A dropdown, not a free-text box: the prices are a
 *  table, and a table can be checked. */
export const REPORT_QUANTITIES = [1, 3, 5, 10, 25, 50, 100] as const;
export type ReportQuantity = (typeof REPORT_QUANTITIES)[number];

/** Whole NZD for that many reports. */
export const REPORT_PRICE_NZD: Record<ReportQuantity, number> = {
  1: 19,
  3: 29,
  5: 39,
  10: 59,
  25: 99,
  50: 149,
  100: 229,
};

export const isReportQuantity = (v: unknown): v is ReportQuantity =>
  typeof v === "number" && (REPORT_QUANTITIES as readonly number[]).includes(v);

/** "$2.98" — what one report works out at, for the dropdown to show. */
export function perReport(n: ReportQuantity): string {
  return (REPORT_PRICE_NZD[n] / n).toFixed(2);
}

/**
 * What `n` reports would cost on the Bronze curve.
 *
 * The table above is not a set of arbitrary prices — it sits on `15.7·n^0.576`,
 * to within a dollar at every listed quantity, and this reproduces it. It
 * exists for the quantities that are NOT on sale: Gold grants 75, which nobody
 * can buy directly, and its card has to be able to say what those 75 are worth
 * without quoting the price of 50 and hoping nobody checks. That exact mistake
 * made Gold cost a dollar more than its own parts.
 */
export function reportsValue(n: number): number {
  return Math.round(15.7 * Math.pow(n, 0.576));
}

/**
 * What the map is worth on its own.
 *
 * Not a price anyone can pay — it is never sold separately, for the reason at
 * the top of this file. It exists so Silver and Gold can show their working:
 * Silver is 50 reports at $149 plus this, to the dollar.
 */
export const MAP_VALUE_NZD = 250;

/** The building inspection's share of Gold, for the same reason. */
export const INSPECTION_VALUE_NZD = 899;

// ── The packages ─────────────────────────────────────────────────────────────

export interface Grant {
  /** Report credits. */
  reports: number;
  /** Does this purchase carry map access? */
  map: boolean;
  /** Inspections owed. One per purchase, never one a month — see below. */
  inspections: number;
}

/** What Silver and Gold grant. Bronze's report count is chosen at checkout. */
export const PACKAGE_GRANT: Record<Exclude<Package, "bronze">, Grant> = {
  silver: { reports: 50, map: true, inspections: 0 },
  gold: { reports: 75, map: true, inspections: 1 },
};

export const PACKAGE_PRICE_NZD: Record<Exclude<Package, "bronze">, number> = {
  // 50 reports ($149) + the map ($250), to the dollar. Nothing hidden in it.
  silver: 399,
  // 75 reports ($189 on the curve) + the map ($250) + an inspection ($899) is
  // $1,338 bought separately. The $39 is a real bundle discount, and the round
  // number is worth more than the $39.
  gold: 1299,
};

/** What a purchase of `pkg` grants, with Bronze's chosen quantity. */
export function grantFor(pkg: Package, quantity?: ReportQuantity): Grant {
  if (pkg === "bronze") {
    return { reports: quantity ?? 1, map: false, inspections: 0 };
  }
  return PACKAGE_GRANT[pkg];
}

/** What a purchase of `pkg` costs, in whole NZD. */
export function priceFor(pkg: Package, quantity?: ReportQuantity): number {
  if (pkg === "bronze") return REPORT_PRICE_NZD[quantity ?? 1];
  return PACKAGE_PRICE_NZD[pkg];
}

/** "50 reports and the map" — one phrasing, wherever a purchase is named. */
export function describeGrant(g: Grant): string {
  const bits = [`${g.reports} ${g.reports === 1 ? "report" : "reports"}`];
  if (g.map) bits.push("the map");
  if (g.inspections > 0) {
    bits.push(g.inspections === 1 ? "a building inspection" : `${g.inspections} building inspections`);
  }
  if (bits.length === 1) return bits[0];
  return `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;
}

export const isPackage = (v: unknown): v is Package =>
  typeof v === "string" && (PACKAGES as string[]).includes(v);

/**
 * Package names that were sold before this structure, and what they map to.
 *
 * The metals were a six-rung ladder; before that, Starter and Pro. A row still
 * carrying one of those names was paid for, so it has to keep resolving to
 * something — and to something that keeps what it was SOLD. Anything that had
 * the map keeps the map.
 */
const LEGACY_PACKAGES: Record<string, Package> = {
  starter: "bronze",
  copper: "bronze",
  pro: "silver",
  platinum: "silver",
  diamond: "gold",
};

export function normalisePackage(stored: string | null | undefined): Package | null {
  if (!stored) return null;
  if (isPackage(stored)) return stored;
  return LEGACY_PACKAGES[stored] ?? null;
}

// ── What somebody actually has right now ─────────────────────────────────────
//
// Three different clocks, on purpose, because the three things being sold are
// three different kinds of thing:
//
//   credits      are OWNED. They don't expire. A report costs the same $1.45 to
//                run in March as in January, and somebody buying a house over
//                six months should not lose what they paid for because they
//                took their time. A monthly allowance also made the free tier's
//                one-report taster incoherent beside it.
//   the map      is RENTED. It is access to a dataset that keeps changing, so
//                it runs for MAP_DAYS and stops.
//   an inspection is BOOKED. One per purchase — buying a second month must not
//                quietly owe a second visit to the same house.

export interface Entitlements {
  /** Report credits bought and not yet spent. */
  credits: number;
  /** Has ever bought anything. Unblurs the score and the valuation — and stays
   *  true once the credits run out, because revoking the reports somebody has
   *  already paid to read would be theft of what they bought. */
  paid: boolean;
  /** Map access still running. */
  map: boolean;
  /** When map access ends, or null when there is none. */
  mapUntil: string | null;
  /** Inspections bought and not yet carried out. */
  inspections: number;
}

export const NO_ENTITLEMENTS: Entitlements = {
  credits: 0,
  paid: false,
  map: false,
  mapUntil: null,
  inspections: 0,
};

/** The free report: one, ever. Not one a month — a monthly handout is a
 *  renewable cost and a reason to farm accounts. */
export const FREE_REPORTS = 1;

/** When map access bought now should end. Buying again EXTENDS rather than
 *  resets, or paying early throws away days already paid for. */
export function mapAccessUntil(
  currentExpiry: string | Date | null | undefined,
  now: Date = new Date()
): Date {
  const base =
    currentExpiry && new Date(currentExpiry).getTime() > now.getTime()
      ? new Date(currentExpiry)
      : now;
  return new Date(base.getTime() + MAP_DAYS * 86_400_000);
}

/** Is that map expiry still in the future? Anything unparseable fails closed. */
export function mapActive(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return false;
  const end = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() > now.getTime();
}

/** Whole days of map access left, floored at 0. */
export function daysRemaining(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): number {
  if (!expiresAt) return 0;
  const end = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

// ── Features ─────────────────────────────────────────────────────────────────
//
// One list, and everything reads from it: the gates in the app, the package
// cards, the comparison table, and the message someone gets at a wall. These
// were written twice once before and drifted — the pricing page sold CSV
// export, listing alerts, saved searches, compare mode and priority generation,
// none of which were ever built. A feature that isn't in this enum cannot
// appear on the pricing page, which is the point.

export type Feature =
  /** The valuation, unblurred. (Key kept from when there was a 1,000-point score.) */
  | "score"
  /** The Financial, Renovations and Healthy Homes tabs. */
  | "tools"
  /** PDF download, emailing the report, and the private share link. */
  | "share"
  /** Upload a LIM, consents, an EQC history or a title, and have it read. */
  | "documents"
  /** The NZ investment map, its filters and the watchlist. */
  | "map"
  /** Open any report on the map, not just your own. */
  | "mapReports";

export const FEATURE_LABEL: Record<Feature, string> = {
  score: "The full valuation, unblurred",
  tools: "Renovation planner, Financial tab, Healthy Homes check",
  share: "PDF, email and private share link",
  documents: "LIM, consents, EQC and title read for you",
  map: "NZ investment map, filters and watchlist",
  mapReports: "Every report on the map, not just your own",
};

/** What each feature needs. Everything a report contains comes with ANY
 *  purchase; only the map is separate, because only the map was sold
 *  separately. */
export const FEATURE_NEEDS: Record<Feature, "paid" | "map"> = {
  score: "paid",
  tools: "paid",
  share: "paid",
  documents: "paid",
  map: "map",
  mapReports: "map",
};

/** Does this account have this feature? The only question a gate should ask. */
export const includes = (ent: Entitlements, feature: Feature): boolean =>
  FEATURE_NEEDS[feature] === "map" ? ent.map : ent.paid;

/** Every feature a package carries, in list order. */
export function featuresOf(pkg: Package): Feature[] {
  const g = grantFor(pkg, 1);
  const ent: Entitlements = { ...NO_ENTITLEMENTS, paid: true, map: g.map };
  return (Object.keys(FEATURE_NEEDS) as Feature[]).filter((f) => includes(ent, f));
}

/** The cheapest package carrying `feature`, for "included from X" copy. */
export function packageFor(feature: Feature): Package {
  return PACKAGES.find((p) => featuresOf(p).includes(feature)) ?? "gold";
}

// ── The Gold inspection ──────────────────────────────────────────────────────
//
// Unlike everything else here, this one isn't code — it's a person driving to a
// house. A purchase that owes somebody a visit and nothing to flag it is a
// customer left waiting, so it is counted per purchase and stated plainly at
// checkout.

export const INSPECTIONS_PER_PURCHASE = 1;

export const INSPECTION_TERMS =
  "One pre-purchase inspection by a qualified New Zealand building inspector, on one property, " +
  "booked after purchase. Outside a serviced region we quote the travel before booking.";

/** Packages that owe a human something once the payment clears. */
export const NEEDS_FULFILMENT: Partial<Record<Package, string>> = {
  gold: INSPECTION_TERMS,
};

// ── Quota ────────────────────────────────────────────────────────────────────

export interface QuotaState {
  /** Credits bought, plus the free one. */
  granted: number;
  /** Complete reports run. */
  used: number;
  remaining: number;
  /** Has ever paid — a wall reads differently for someone who hasn't. */
  paid: boolean;
}

export function quotaFrom(granted: number, used: number, paid: boolean): QuotaState {
  const total = granted + FREE_REPORTS;
  return { granted: total, used, remaining: Math.max(0, total - used), paid };
}

/**
 * What to tell someone who has run out.
 *
 * Names the number they've used and the way out, because "quota exceeded" tells
 * a person nothing they can act on. There is no "wait until it refills" any
 * more — credits don't expire, so they haven't run out of time, only of
 * credits, and the honest answer is a price.
 */
export function quotaExhaustedMessage(q: QuotaState): string {
  if (!q.paid) {
    return `You've used your free report. ${REPORT_QUANTITIES[0]} more is $${REPORT_PRICE_NZD[1]}, including the full valuation — or ${REPORT_QUANTITIES[3]} for $${REPORT_PRICE_NZD[10]}.`;
  }
  return `You've used all ${q.granted} of your reports. Credits don't expire, so buying more adds to the account rather than replacing anything — ${REPORT_QUANTITIES[3]} is $${REPORT_PRICE_NZD[10]}, ${REPORT_QUANTITIES[5]} is $${REPORT_PRICE_NZD[50]}.`;
}

// ── Display helpers ──────────────────────────────────────────────────────────

/** "21 September 2026" — one date format across the billing UI. */
export function formatAccessDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
}

/** "$99.00" from 9900 — Stripe deals in cents, people don't. */
export function formatAmount(cents: number | null, currency = "nzd"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * One row of purchase history, as the account page reads it.
 *
 * Lives here rather than beside the route because a Next.js route file may only
 * export handlers, and the client component that renders the list needs the
 * shape too.
 */
export interface PurchaseSummary {
  id: string;
  pkg: Package;
  reports: number;
  map: boolean;
  inspections: number;
  amountCents: number | null;
  currency: string;
  status: "paid" | "refunded" | string;
  receiptUrl: string | null;
  mapUntil: string | null;
  createdAt: string;
}
