"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import { CheckCircle2, Minus, ArrowRight, Info, HardHat } from "lucide-react";

import BuyPlanButton from "@/components/billing/BuyPlanButton";
import { useSession } from "@/lib/auth/session";
import { PRODUCT_NAME } from "@/lib/brand";
import {
  ACCESS_DAYS,
  ALL_PLANS,
  describeAllowance,
  featuresAddedBy,
  FEATURE_FROM,
  FEATURE_LABEL,
  formatAccessDate,
  INSPECTIONS_PER_PURCHASE,
  NEEDS_FULFILMENT,
  PLAN_ALLOWANCE,
  PLAN_COLOUR,
  PLAN_LABEL,
  PLAN_PRICE_NZD,
  PLAN_RANK,
  PLAN_TAGLINE,
  planIncludes,
  type Feature,
  type PaidPlan,
  type Plan,
} from "@/lib/billing/plans";

// ============================================================
// Pricing.
//
// Every tier, every tick and every row below is derived from the feature map in
// lib/billing/plans.ts — the same map the gates in the app read. It used to be
// a hand-written table beside them, and it drifted: it sold CSV export, listing
// alerts, saved searches, compare mode and priority generation, none of which
// were ever built. Nothing can appear here now unless something in the app
// actually gates on it.
// ============================================================

/** Cheapest feature first, so a column reads as a ladder. */
const FEATURE_ROWS = (Object.keys(FEATURE_FROM) as Feature[]).sort(
  (a, b) => PLAN_RANK[FEATURE_FROM[a]] - PLAN_RANK[FEATURE_FROM[b]]
);

/**
 * Seven cards in one row is a wall. Two groups, split where the product does:
 * below Gold you're analysing houses you found yourself; from Gold up the app
 * is finding them, and then acting on the one you chose.
 */
const GROUPS: { title: string; blurb: string; plans: Plan[] }[] = [
  {
    title: "Analyse the houses you've found",
    blurb: "Paste a listing, get the whole report back.",
    plans: ["free", "copper", "bronze", "silver"],
  },
  {
    title: "Find them, then act on one",
    blurb: "The map across all of New Zealand, and what happens after you choose.",
    plans: ["gold", "platinum", "diamond"],
  },
];

export default function PricingPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl font-bold mb-4"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            Simple, honest pricing
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Pay for a month at a time. No subscription, no hidden fees.
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            Prices in NZD. Access lasts {ACCESS_DAYS} days and nothing auto-renews.
          </p>
          <Suspense fallback={null}>
            <CheckoutNotice />
          </Suspense>
          <Link
            href="/report/rpt_001"
            className="inline-flex items-center gap-1.5 text-sm mt-3 cursor-pointer hover:underline"
            style={{ color: "var(--brand)" }}
          >
            View a sample report first →
          </Link>
        </div>

        {GROUPS.map((group, gi) => (
          <div key={group.title} className={gi === 0 ? "mb-12" : "mb-16"}>
            <div className="mb-5">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {group.title}
              </h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {group.blurb}
              </p>
            </div>
            <div
              className={`grid gap-5 ${
                group.plans.length === 4
                  ? "sm:grid-cols-2 lg:grid-cols-4"
                  : "sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {group.plans.map((plan) => (
                <PlanCard key={plan} plan={plan} />
              ))}
            </div>
          </div>
        ))}

        <ComparisonTable />
        <Faq />
      </div>
    </div>
  );
}

/**
 * One tier.
 *
 * The bullet list is what this tier ADDS, not everything it has — a Diamond
 * card listing all eight features buries the one thing you're paying the extra
 * thousand dollars for. "Everything in X" carries the rest.
 */
function PlanCard({ plan }: { plan: Plan }) {
  const paid = plan !== "free";
  const colour = PLAN_COLOUR[plan];
  const below = ALL_PLANS[PLAN_RANK[plan] - 1];
  const adds = paid ? featuresAddedBy(plan as PaidPlan) : [];
  const highlight = plan === "gold";
  const fulfilment = paid ? NEEDS_FULFILMENT[plan as PaidPlan] : undefined;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col relative"
      style={{
        background: "var(--surface)",
        border: `1px solid ${highlight ? colour : "var(--border)"}`,
        boxShadow: highlight ? `0 12px 40px ${colour}26` : "none",
      }}
    >
      {highlight && (
        <div
          className="absolute -top-2.5 left-5 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: colour, color: "#1a1a1a" }}
        >
          Most popular
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
        <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
          {PLAN_LABEL[plan]}
        </span>
      </div>

      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          {paid ? `$${PLAN_PRICE_NZD[plan as PaidPlan].toLocaleString("en-NZ")}` : "$0"}
        </span>
        {paid && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            / {ACCESS_DAYS} days
          </span>
        )}
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        {PLAN_TAGLINE[plan]}
      </p>

      <ul className="space-y-1.5 mb-5 flex-1">
        <li className="flex items-start gap-2 text-sm">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: colour }} />
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {describeAllowance(plan)}
          </span>
        </li>

        {plan === "free" && (
          <li className="flex items-start gap-2 text-sm">
            <Minus size={14} className="mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-secondary)" }}>
              Every photo read and every finding shown — the score and valuation stay blurred
            </span>
          </li>
        )}

        {adds.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: colour }} />
            <span style={{ color: "var(--text-secondary)" }}>{FEATURE_LABEL[f]}</span>
          </li>
        ))}

        {paid && below && below !== "free" && (
          <li className="flex items-start gap-2 text-sm">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: colour }} />
            <span style={{ color: "var(--text-secondary)" }}>
              Everything in {PLAN_LABEL[below]}
            </span>
          </li>
        )}
      </ul>

      {fulfilment && (
        <div
          className="rounded-xl p-3 mb-4 text-xs leading-relaxed flex gap-2"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          <HardHat size={14} className="mt-0.5 shrink-0" style={{ color: colour }} />
          <span>
            {fulfilment} {INSPECTIONS_PER_PURCHASE === 1 ? "One inspection per purchase" : `${INSPECTIONS_PER_PURCHASE} per purchase`} — not one a
            month, so buying a second month doesn&apos;t owe a second visit.
          </span>
        </div>
      )}

      {paid ? (
        <PlanCta plan={plan as PaidPlan} colour={colour} />
      ) : (
        <Link
          href="/signup"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-all"
          style={{ background: "var(--brand)", color: "white" }}
        >
          Start free
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}

/**
 * The buy button, aware of what the visitor already has.
 *
 * A plan they're already on says "another month" rather than "Get Gold", and a
 * lower tier than the one running says so instead of offering a purchase the
 * checkout route would refuse with a 409.
 */
function PlanCta({ plan, colour }: { plan: PaidPlan; colour: string }) {
  const { plan: current, planExpiresAt } = useSession();

  if (PLAN_RANK[current] > PLAN_RANK[plan]) {
    return (
      <div
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm"
        style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
      >
        <CheckCircle2 size={15} />
        Included in {PLAN_LABEL[current]}
      </div>
    );
  }

  return (
    <>
      <BuyPlanButton
        plan={plan}
        label={current === plan ? "Add another month" : `Get ${PLAN_LABEL[plan]}`}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-all"
        style={{ background: colour, color: "#fff" }}
      />
      {current === plan && planExpiresAt && (
        <p className="text-xs mt-2 text-center" style={{ color: "var(--text-muted)" }}>
          Yours until {formatAccessDate(planExpiresAt)}
        </p>
      )}
    </>
  );
}

function Cell({ on, colour }: { on: boolean; colour: string }) {
  return on ? (
    <CheckCircle2 size={16} style={{ color: colour }} />
  ) : (
    <Minus size={14} style={{ color: "var(--border)" }} />
  );
}

/**
 * Every tier against every feature.
 *
 * Eight columns don't fit a phone, so it scrolls sideways with the feature name
 * pinned — the alternative is eight stacked lists nobody compares.
 */
function ComparisonTable() {
  return (
    <div className="mb-16">
      <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--text-primary)" }}>
        Full comparison
      </h2>
      <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
        <div className="min-w-[860px]">
          {/* Header */}
          <div
            className="grid px-4 py-3"
            style={{
              gridTemplateColumns: `minmax(220px,1.6fr) repeat(${ALL_PLANS.length}, 1fr)`,
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Feature
            </div>
            {ALL_PLANS.map((p) => (
              <div key={p} className="text-center">
                <div className="text-sm font-semibold" style={{ color: PLAN_COLOUR[p] }}>
                  {PLAN_LABEL[p]}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {p === "free"
                    ? "$0"
                    : `$${PLAN_PRICE_NZD[p as PaidPlan].toLocaleString("en-NZ")}`}
                </div>
              </div>
            ))}
          </div>

          {/* Reports — a count, not a tick, so it gets its own row. */}
          <Row label="Reports" striped>
            {ALL_PLANS.map((p) => (
              <div
                key={p}
                className="text-center text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {PLAN_ALLOWANCE[p].reports}
                {PLAN_ALLOWANCE[p].period === "month" ? " / mo" : " ever"}
              </div>
            ))}
          </Row>

          {FEATURE_ROWS.map((f, i) => (
            <Row key={f} label={FEATURE_LABEL[f]} striped={i % 2 === 1}>
              {ALL_PLANS.map((p) => (
                <div key={p} className="flex justify-center">
                  <Cell on={planIncludes(p, f)} colour={PLAN_COLOUR[p]} />
                </div>
              ))}
            </Row>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  striped,
  children,
}: {
  label: string;
  striped: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid px-4 py-3 items-center"
      style={{
        gridTemplateColumns: `minmax(220px,1.6fr) repeat(${ALL_PLANS.length}, 1fr)`,
        borderBottom: "1px solid var(--border)",
        background: striped ? "var(--surface)" : "var(--bg)",
      }}
    >
      <div className="text-sm pr-4" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Faq() {
  const faqs = [
    {
      q: "Is this a subscription?",
      a: `No. You buy ${ACCESS_DAYS} days of access and it ends there. Nothing auto-renews, so there is no recurring charge, no saved mandate and nothing to cancel. Buy another month whenever you need one — buying early adds to the days you have left rather than replacing them.`,
    },
    {
      q: "What do I actually get for free?",
      a: "One complete analysis of a real listing you paste in — every photo read, every defect and finding shown. What stays locked is the conclusion: the score out of 1,000, the valuation, and the Financial, Renovations and agent tabs. It's one report, not one a month, and upgrading opens the report you already ran rather than making you run it again.",
    },
    {
      q: "Platinum has the agent document — so why would I need Diamond?",
      a: "Because the agent document doesn't open until a building inspector has been to the property. It puts costed claims in front of somebody whose job is to take them apart, and a buyer's own walk-through can't settle whether a stain is an active leak or a repaired one. On Platinum you bring your own inspector's report and upload it. On Diamond we send the inspector and load their report for you — so if you were going to pay for an inspection anyway, Diamond is that inspection with the rest attached.",
    },
    {
      q: "Why do Gold, Platinum and Diamond all have 50 reports?",
      a: "Because nobody analysing fifty houses a month needs eighty. Above Gold you aren't buying more searching, you're buying what happens to the house you've chosen — the offer document you hand the agent, and then an inspector standing in it.",
    },
    {
      q: "What is the Diamond inspection, exactly?",
      a: `${NEEDS_FULFILMENT.diamond} It is a qualified human being writing their own report, and their findings go in beside ours — where they disagree with the photo analysis, theirs is the one that was there.`,
    },
    {
      q: "Is this a registered property valuation?",
      a: `No. ${PRODUCT_NAME} is AI-assisted analysis of publicly available listing data. It is not a registered valuation, building inspection, or legal advice. The Diamond inspection is a real building inspection, carried out by the inspector, not by us.`,
    },
    {
      q: "How accurate is the photo analysis?",
      a: "Photos are scored with a confidence tier. Tier 1 (≥90% confidence) findings are stated as fact. Tier 2 (65–89%) are labelled 'verify at inspection'. Tier 3 findings are unscored.",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-8 text-center" style={{ color: "var(--text-primary)" }}>
        Common questions
      </h2>
      <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {faqs.map((faq) => (
          <div key={faq.q} className="card p-5">
            <h3 className="font-semibold text-sm mb-2" style={{ color: "var(--text-primary)" }}>
              {faq.q}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {faq.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Someone who backed out of Stripe lands back here — acknowledge it. */
function CheckoutNotice() {
  const params = useSearchParams();
  if (params.get("purchase") !== "cancelled") return null;

  return (
    <div
      className="inline-flex items-center gap-2 text-sm mt-4 px-4 py-2 rounded-xl"
      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
      role="status"
    >
      <Info size={15} />
      Checkout cancelled — you haven&apos;t been charged.
    </div>
  );
}
