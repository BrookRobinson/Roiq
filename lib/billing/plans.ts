// ============================================================
// What the plans are, what each one includes, and when access runs out.
//
// Pure and import-safe from client components — no Stripe SDK, no env secrets,
// no database. The server maps these to Stripe price IDs in ./stripe.ts.
//
// The tier ladder is metals: copper → bronze → silver → gold → platinum →
// diamond. Each step adds exactly one thing, so "what does the next one buy me"
// always has a one-line answer.
// ============================================================

export type Plan =
  | "free"
  | "copper"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond";
export type PaidPlan = Exclude<Plan, "free">;

/** A purchase buys this many days. Nothing auto-renews — see the migration. */
export const ACCESS_DAYS = 30;

/** Cheapest first. The order the pricing page and the comparison table use. */
export const PAID_PLANS: PaidPlan[] = [
  "copper",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
];

export const ALL_PLANS: Plan[] = ["free", ...PAID_PLANS];

export const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  copper: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
  platinum: 5,
  diamond: 6,
};

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  copper: "Copper",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

/**
 * Plans that were sold before the metals, and what they map to now.
 *
 * Starter was 10 reports, which is Bronze exactly. Pro was 20 reports plus the
 * map; Gold is the cheapest tier with the map, and 50 reports is more than they
 * paid for — erring toward giving someone more than they bought rather than
 * taking the map away from an account that is still inside its 30 days.
 */
const LEGACY_PLANS: Record<string, PaidPlan> = {
  starter: "bronze",
  pro: "gold",
};

/**
 * Display price in whole NZD. This is copy, not a source of truth — the amount
 * actually charged is whatever the Stripe price says, and the receipt records
 * it. Keep the two in step by hand; showing $99 and charging $149 is the kind
 * of mismatch nobody notices until a customer does.
 */
export const PLAN_PRICE_NZD: Record<PaidPlan, number> = {
  copper: 29,
  bronze: 59,
  silver: 99,
  gold: 169,
  platinum: 279,
  // Diamond carries a real building inspection, which is bought from a person
  // and costs $400–900 depending on the house and how far they drive. The price
  // has to cover the worst of that range, not the average.
  diamond: 1299,
};

/** Who each tier is for, in one line. Shown on the plan card under the price. */
export const PLAN_TAGLINE: Record<Plan, string> = {
  free: "One real report on your own listing",
  copper: "One house, properly looked at",
  bronze: "A weekend of open homes",
  silver: "Reading the paperwork too",
  gold: "Hunting across the whole country",
  platinum: "Your inspector's findings, put to the agent",
  diamond: "Someone on site before you sign",
};

/**
 * The accent each tier is drawn in.
 *
 * Mid-lightness on purpose: these sit on both the light and the dark theme, and
 * a true platinum white or a true bronze brown disappears into one of them.
 */
export const PLAN_COLOUR: Record<Plan, string> = {
  free: "#8A94A6",
  copper: "#B45F35",
  bronze: "#9A7B4F",
  silver: "#8A96A6",
  gold: "#C9A227",
  platinum: "#6E8BA8",
  diamond: "#4FB3E8",
};

export const isPaidPlan = (v: unknown): v is PaidPlan =>
  typeof v === "string" && (PAID_PLANS as string[]).includes(v);

/** Parse a stored plan string, mapping the retired names onto the metals. */
export function normalisePlan(stored: string | null | undefined): Plan | null {
  if (!stored) return null;
  if (isPaidPlan(stored)) return stored;
  if (stored === "free") return "free";
  return LEGACY_PLANS[stored] ?? null;
}

/**
 * The plan a user actually has right now.
 *
 * A stored plan of "gold" means nothing on its own: it's a record of what was
 * bought, and it stays there after the month runs out. Access is the pair —
 * plan AND an expiry still in the future. Anything unparseable, missing or past
 * resolves to "free", because every failure here should fail closed.
 */
export function effectivePlan(
  storedPlan: string | null | undefined,
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): Plan {
  const plan = normalisePlan(storedPlan);
  if (!plan || plan === "free") return "free";
  if (!expiresAt) return "free";

  const end = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return "free";

  return end.getTime() > now.getTime() ? plan : "free";
}

/** Whole days of access left, floored at 0. Used for "renews in 6 days" copy. */
export function daysRemaining(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): number {
  if (!expiresAt) return 0;
  const end = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

/**
 * When a purchase made now should run out.
 *
 * Buying again while a month is still running EXTENDS it rather than resetting
 * it — otherwise paying early quietly throws away the days already paid for.
 */
export function accessUntil(
  currentExpiry: string | Date | null | undefined,
  now: Date = new Date()
): Date {
  const base =
    currentExpiry && new Date(currentExpiry).getTime() > now.getTime()
      ? new Date(currentExpiry)
      : now;
  return new Date(base.getTime() + ACCESS_DAYS * 86_400_000);
}

/** Does `plan` clear the `minimum` bar? Diamond ⊃ Platinum ⊃ … ⊃ Free. */
export const planMeets = (plan: Plan, minimum: Plan): boolean =>
  PLAN_RANK[plan] >= PLAN_RANK[minimum];

/** The next tier up, or null at the top. Drives every "upgrade to…" line. */
export function nextPlanUp(plan: Plan): PaidPlan | null {
  return PAID_PLANS.find((p) => PLAN_RANK[p] > PLAN_RANK[plan]) ?? null;
}

/** "21 September 2026" — one date format across the billing UI. */
export function formatAccessDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
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
  plan: Plan;
  amountCents: number | null;
  currency: string;
  status: "paid" | "refunded" | string;
  receiptUrl: string | null;
  accessUntil: string;
  createdAt: string;
}

/** "$99.00" from 9900 — Stripe deals in cents, people don't. */
export function formatAmount(cents: number | null, currency = "nzd"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// ── What each tier includes ──────────────────────────────────────────────────
//
// One list, and everything reads from it: the gates in the app, the plan cards,
// the comparison table, and the message someone gets when they hit a wall. The
// table used to be written by hand beside the gates, and it drifted — it sold
// CSV export, listing alerts, saved searches, compare mode and priority
// generation, none of which were ever built. A feature that isn't in this enum
// cannot appear on the pricing page, which is the point.

export type Feature =
  /** The score out of 1,000 and the valuation, unblurred. */
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
  | "mapReports"
  /**
   * The document you send the vendor's agent, with the offer at the end.
   *
   * Buying the tier buys the machinery, not an open door: the letter still
   * waits on a building inspector having attended the property — see
   * lib/viewing/status.ts. Platinum means bringing your own inspector's report;
   * Diamond means we send the inspector.
   */
  | "negotiation"
  /** A building inspector on the property. One per purchase — see below. */
  | "inspection";

/** What each feature is called in front of a customer. */
export const FEATURE_LABEL: Record<Feature, string> = {
  score: "Score out of 1,000 and the valuation",
  tools: "Renovation planner, Financial tab, Healthy Homes check",
  share: "PDF, email and private share link",
  documents: "LIM, consents, EQC and title read for you",
  map: "NZ investment map, filters and watchlist",
  mapReports: "Every report on the map, not just your own",
  negotiation: "Agent offer document, once an inspector has been",
  inspection: "In-person building inspection, arranged by us",
};

/**
 * The tier a feature starts at. Cumulative: every tier above it has it too,
 * which is what makes `planIncludes` a rank comparison rather than a set.
 */
export const FEATURE_FROM: Record<Feature, PaidPlan> = {
  score: "copper",
  tools: "copper",
  share: "bronze",
  documents: "silver",
  map: "gold",
  mapReports: "gold",
  negotiation: "platinum",
  inspection: "diamond",
};

/** Does this plan include this feature? The only question the gates should ask. */
export const planIncludes = (plan: Plan, feature: Feature): boolean =>
  planMeets(plan, FEATURE_FROM[feature]);

/** Everything `plan` includes, cheapest feature first. */
export const featuresOf = (plan: Plan): Feature[] =>
  (Object.keys(FEATURE_FROM) as Feature[])
    .filter((f) => planIncludes(plan, f))
    .sort((a, b) => PLAN_RANK[FEATURE_FROM[a]] - PLAN_RANK[FEATURE_FROM[b]]);

/** What this tier adds that the one below it didn't have. */
export const featuresAddedBy = (plan: PaidPlan): Feature[] =>
  (Object.keys(FEATURE_FROM) as Feature[]).filter((f) => FEATURE_FROM[f] === plan);

// ── The Diamond inspection ───────────────────────────────────────────────────
//
// Unlike everything else here, this one isn't code — it's a person driving to a
// house. That makes it the only entitlement counted PER PURCHASE rather than
// per month: access lasts 30 days and buying again extends it, so a monthly
// inspection allowance would quietly owe a second visit to anyone who bought
// twice. One purchase, one inspection, on the one property.

/** Inspections owed per Diamond purchase. Not per month, and not per report. */
export const INSPECTIONS_PER_PURCHASE = 1;

/**
 * Tiers that owe a human something after the payment clears.
 *
 * Checked before a tier is offered for sale: a Diamond sold where no inspector
 * can be sent is a refund and an apology, not a customer. The practical guard
 * is that a tier with no Stripe price ID can't be bought at all, so Diamond
 * stays unsellable until someone deliberately creates its price.
 */
export const NEEDS_FULFILMENT: Partial<Record<PaidPlan, string>> = {
  diamond:
    "One pre-purchase inspection by a qualified New Zealand building inspector, on one property, booked after purchase. Outside a serviced region we quote the travel before booking.",
};

// ── Report allowances ────────────────────────────────────────────────────────
//
// A full report costs real money to produce (measured at roughly NZ$1.45 from
// September 2026 — the Claude vision pass plus the market lookups), so an
// allowance isn't a growth lever, it's the thing standing between a curious
// visitor and an unbounded bill. "Unlimited" on the pricing page was written
// before anyone had measured that.
//
// Gold, Platinum and Diamond all sit at 50. The tiers above Gold are not sold
// on volume — nobody analysing 50 houses a month needs 80 — they're sold on
// what happens to the house you actually chose.

export interface Allowance {
  /** How many reports the plan includes. */
  reports: number;
  /**
   * "lifetime" never resets. The free report is a taster, not a monthly
   * handout: a monthly reset turns every account into a renewable cost and
   * gives someone farming accounts a reason to keep each one.
   */
  period: "lifetime" | "month";
}

export const PLAN_ALLOWANCE: Record<Plan, Allowance> = {
  free:     { reports: 1,  period: "lifetime" },
  copper:   { reports: 3,  period: "month" },
  bronze:   { reports: 10, period: "month" },
  silver:   { reports: 25, period: "month" },
  gold:     { reports: 50, period: "month" },
  platinum: { reports: 50, period: "month" },
  diamond:  { reports: 50, period: "month" },
};

/** "1 report" / "10 reports a month" — one phrasing everywhere. */
export function describeAllowance(plan: Plan): string {
  const { reports, period } = PLAN_ALLOWANCE[plan];
  const noun = reports === 1 ? "report" : "reports";
  return period === "month" ? `${reports} ${noun} a month` : `${reports} ${noun}`;
}

/** Start of the window the allowance is counted over. Null = count everything. */
export function allowanceWindowStart(plan: Plan, now: Date = new Date()): Date | null {
  if (PLAN_ALLOWANCE[plan].period === "lifetime") return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** When the allowance next refills, or null if it never does. */
export function allowanceResetsAt(plan: Plan, now: Date = new Date()): Date | null {
  if (PLAN_ALLOWANCE[plan].period === "lifetime") return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export interface QuotaState {
  plan: Plan;
  used: number;
  limit: number;
  remaining: number;
  period: Allowance["period"];
  /** ISO date the count resets, or null for a lifetime allowance. */
  resetsAt: string | null;
}

export function quotaFrom(plan: Plan, used: number, now: Date = new Date()): QuotaState {
  const { reports, period } = PLAN_ALLOWANCE[plan];
  const reset = allowanceResetsAt(plan, now);
  return {
    plan,
    used,
    limit: reports,
    remaining: Math.max(0, reports - used),
    period,
    resetsAt: reset ? reset.toISOString() : null,
  };
}

/**
 * What to tell someone who has run out.
 *
 * Names the number they've used and the way out, because "quota exceeded" tells
 * a person nothing they can act on. The upsell only appears when the next tier
 * up actually carries more reports — Platinum over Gold is the same 50, and
 * offering it to someone who has run out would be selling them nothing.
 */
export function quotaExhaustedMessage(q: QuotaState): string {
  if (q.plan === "free") {
    return `You've used your free report. ${PLAN_LABEL.copper} is ${describeAllowance(
      "copper"
    )} for $${PLAN_PRICE_NZD.copper}, including the score and valuation.`;
  }

  const when = q.resetsAt
    ? new Date(q.resetsAt).toLocaleDateString("en-NZ", { day: "numeric", month: "long" })
    : "next month";

  const bigger = PAID_PLANS.find(
    (p) => PLAN_RANK[p] > PLAN_RANK[q.plan] && PLAN_ALLOWANCE[p].reports > q.limit
  );
  const upgrade = bigger
    ? ` ${PLAN_LABEL[bigger]} takes it to ${PLAN_ALLOWANCE[bigger].reports}.`
    : "";

  return `You've used all ${q.limit} reports for this month. Your allowance refills on ${when}.${upgrade}`;
}
