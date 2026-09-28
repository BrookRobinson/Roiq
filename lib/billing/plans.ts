// ============================================================
// What can be bought, what each purchase grants, and how long it lasts.
//
// Pure and import-safe from client components — no Stripe SDK, no env secrets,
// no database. The server turns these into Stripe line items in ./stripe.ts.
//
// Two things are sold, and a checkout can carry either or both:
//
//   Reports   $29 for one, falling to $10 each at 20. Credits never expire.
//   The map   $249 for 12 months — every analysed property, the Best deals
//             list, and every report on the map, not just your own.
//
// (Bronze / Silver / Gold were retired 2026-09-29. Purchases made under them
// keep exactly what they granted — each row stores its own grant — and still
// display under their old names; see LEGACY_PLAN_LABEL.)
// ============================================================

/** Map access lasts this many days. Nothing auto-renews. */
export const MAP_DAYS = 365;

/** "12 months" — how the map's length is said everywhere. */
export const MAP_TERM = "12 months";

// ── Reports ──────────────────────────────────────────────────────────────────
//
// A report costs roughly NZ$1.45 to produce (the Claude vision pass plus the
// market lookups, measured September 2026). Every price below clears that many
// times over; the fall from $29 to $10 each is a volume discount for somebody
// working through a shortlist, who comes back, rather than a buyer looking at
// one house, who doesn't.

/** The quantities offered. A dropdown, not a free-text box: the prices are a
 *  table, and a table can be checked. */
export const REPORT_QUANTITIES = [1, 3, 5, 10, 20] as const;
export type ReportQuantity = (typeof REPORT_QUANTITIES)[number];

/** Whole NZD for that many reports: $29, $23, $19, $15, then $10 each. */
export const REPORT_PRICE_NZD: Record<ReportQuantity, number> = {
  1: 29,
  3: 69,
  5: 95,
  10: 150,
  20: 200,
};

export const isReportQuantity = (v: unknown): v is ReportQuantity =>
  typeof v === "number" && (REPORT_QUANTITIES as readonly number[]).includes(v);

/** "23" — what one report works out at, for the dropdown to show. */
export function perReport(n: ReportQuantity): string {
  const each = REPORT_PRICE_NZD[n] / n;
  return Number.isInteger(each) ? String(each) : each.toFixed(2);
}

// ── The map ──────────────────────────────────────────────────────────────────

/** The map, for MAP_DAYS. Bought on its own or added to a report purchase. */
export const MAP_PRICE_NZD = 249;

// ── An order: reports, the map, or both ──────────────────────────────────────

export interface Order {
  /** How many reports, or 0 for none. */
  reports: 0 | ReportQuantity;
  /** Add the map. */
  map: boolean;
}

export const isOrder = (v: unknown): v is Order => {
  if (!v || typeof v !== "object") return false;
  const o = v as Partial<Order>;
  const reportsOk = o.reports === 0 || isReportQuantity(o.reports);
  return reportsOk && typeof o.map === "boolean" && (o.reports !== 0 || o.map === true);
};

/** What an order costs, in whole NZD. */
export function orderPrice(o: Order): number {
  return (o.reports ? REPORT_PRICE_NZD[o.reports] : 0) + (o.map ? MAP_PRICE_NZD : 0);
}

export interface Grant {
  /** Report credits. */
  reports: number;
  /** Does this purchase carry map access? */
  map: boolean;
  /** Inspections owed. Nothing sells one now; kept for purchases that did. */
  inspections: number;
}

/** What an order grants. */
export function grantFor(o: Order): Grant {
  return { reports: o.reports, map: o.map, inspections: 0 };
}

/** "10 reports and the map" — one phrasing, wherever a purchase is named. */
export function describeGrant(g: Grant): string {
  const bits: string[] = [];
  if (g.reports > 0) bits.push(`${g.reports} ${g.reports === 1 ? "report" : "reports"}`);
  if (g.map) bits.push(`the map for ${MAP_TERM}`);
  if (g.inspections > 0) {
    bits.push(g.inspections === 1 ? "a building inspection" : `${g.inspections} building inspections`);
  }
  if (bits.length === 0) return "nothing";
  if (bits.length === 1) return bits[0];
  return `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;
}

/** What goes in `purchases.plan` / `users.plan`: "reports-10", "map", "reports-10+map". */
export function planKey(o: Order): string {
  return [o.reports ? `reports-${o.reports}` : null, o.map ? "map" : null].filter(Boolean).join("+");
}

/** The package names sold before this structure. Their rows keep their grants. */
const LEGACY_PLAN_LABEL: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  starter: "Starter",
  copper: "Copper",
  pro: "Pro",
  platinum: "Platinum",
  diamond: "Diamond",
};

/** A stored plan, said the way the account page should say it. */
export function planLabel(stored: string | null | undefined): string {
  if (!stored) return "Purchase";
  if (LEGACY_PLAN_LABEL[stored]) return LEGACY_PLAN_LABEL[stored];
  const m = /^(?:reports-(\d+))?(?:\+?(map))?$/.exec(stored);
  if (!m) return stored;
  const reports = m[1] ? Number(m[1]) : 0;
  const parts = [reports ? `${reports} ${reports === 1 ? "report" : "reports"}` : null, m[2] ? "Map" : null].filter(Boolean);
  return parts.join(" + ") || stored;
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

/**
 * The cheapest thing that opens `feature`, for "comes with…" copy and the
 * upgrade message at a wall. Anything in a report comes with any report
 * purchase; the map and other people's reports come with the map.
 */
export function unlockFor(feature: Feature): { label: string; price: number; order: Order } {
  return FEATURE_NEEDS[feature] === "map"
    ? { label: "the map", price: MAP_PRICE_NZD, order: { reports: 0, map: true } }
    : { label: "any report", price: REPORT_PRICE_NZD[1], order: { reports: 1, map: false } };
}

/** "any report, from $29" / "the map — $249 for 12 months": one phrasing at every wall. */
export function unlockPhrase(feature: Feature): string {
  const u = unlockFor(feature);
  return u.order.map ? `the map — $${u.price} for ${MAP_TERM}` : `any report, from $${u.price}`;
}

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
    return `You've used your free report. One more is $${REPORT_PRICE_NZD[1]}, including the full valuation — or 20 for $${REPORT_PRICE_NZD[20]}, $10 each.`;
  }
  return `You've used all ${q.granted} of your reports. Credits don't expire, so buying more adds to the account — 10 are $${REPORT_PRICE_NZD[10]}, 20 are $${REPORT_PRICE_NZD[20]}.`;
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
  /** What was bought, as the account page says it — "10 reports + Map", or a legacy name. */
  label: string;
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
