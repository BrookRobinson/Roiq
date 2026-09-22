"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Navbar from "@/components/Navbar";
import { CheckCircle2, Minus, ArrowRight, Info, HardHat } from "lucide-react";

import BuyPlanButton from "@/components/billing/BuyPlanButton";
import { useSession } from "@/lib/auth/session";
import { PRODUCT_NAME } from "@/lib/brand";
import {
  FEATURE_LABEL,
  FEATURE_NEEDS,
  featuresOf,
  formatAccessDate,
  grantFor,
  INSPECTION_TERMS,
  INSPECTION_VALUE_NZD,
  MAP_DAYS,
  MAP_VALUE_NZD,
  NEEDS_FULFILMENT,
  PACKAGE_COLOUR,
  PACKAGE_LABEL,
  PACKAGE_TAGLINE,
  PACKAGES,
  perReport,
  priceFor,
  REPORT_PRICE_NZD,
  REPORT_QUANTITIES,
  reportsValue,
  type Feature,
  type Package,
  type ReportQuantity,
} from "@/lib/billing/plans";

// ============================================================
// Pricing.
//
// Three packages, and every tick below is derived from the feature map in
// lib/billing/plans.ts — the same map the gates in the app read. It used to be
// a hand-written table beside them, and it drifted: it sold CSV export, listing
// alerts, saved searches, compare mode and priority generation, none of which
// were ever built. Nothing can appear here unless something actually gates on
// it.
// ============================================================

const FEATURE_ROWS = Object.keys(FEATURE_NEEDS) as Feature[];

export default function PricingPage() {
  const [quantity, setQuantity] = useState<ReportQuantity>(10);

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
            Buy what you need. No subscription, nothing auto-renews.
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            Prices in NZD. Reports never expire — map access runs {MAP_DAYS} days.
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

        <div className="grid gap-5 lg:grid-cols-3 mb-8">
          {PACKAGES.map((pkg) => (
            <PackageCard
              key={pkg}
              pkg={pkg}
              quantity={quantity}
              onQuantity={setQuantity}
            />
          ))}
        </div>

        <FreeNote />
        <ComparisonTable quantity={quantity} />
        <Faq />
      </div>
    </div>
  );
}

/**
 * One package.
 *
 * Bronze is the odd one out and has to be: its price is a function of a choice,
 * so the choice lives on the card rather than behind a "contact us" or a second
 * page. The other two are fixed, and show their working instead — Silver is
 * 50 reports plus the map, and saying so beats asking anyone to take $399 on
 * trust.
 */
function PackageCard({
  pkg,
  quantity,
  onQuantity,
}: {
  pkg: Package;
  quantity: ReportQuantity;
  onQuantity: (n: ReportQuantity) => void;
}) {
  const colour = PACKAGE_COLOUR[pkg];
  const bronze = pkg === "bronze";
  const grant = grantFor(pkg, quantity);
  const price = priceFor(pkg, quantity);
  const highlight = pkg === "silver";
  const fulfilment = NEEDS_FULFILMENT[pkg];

  return (
    <div
      className="rounded-2xl p-6 flex flex-col relative"
      style={{
        background: "var(--surface)",
        border: `1px solid ${highlight ? colour : "var(--border)"}`,
        boxShadow: highlight ? `0 12px 40px ${colour}26` : "none",
      }}
    >
      {highlight && (
        <div
          className="absolute -top-2.5 left-6 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: colour, color: "#1a1a1a" }}
        >
          Reports + the map
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
        <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
          {PACKAGE_LABEL[pkg]}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
          ${price.toLocaleString("en-NZ")}
        </span>
        {bronze && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            ${perReport(quantity)} a report
          </span>
        )}
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        {PACKAGE_TAGLINE[pkg]}
      </p>

      {bronze ? (
        <div className="mb-4">
          <label
            htmlFor="report-qty"
            className="block text-xs font-semibold mb-1.5"
            style={{ color: "var(--text-primary)" }}
          >
            How many reports?
          </label>
          <select
            id="report-qty"
            className="input w-full"
            value={quantity}
            onChange={(e) => onQuantity(Number(e.target.value) as ReportQuantity)}
          >
            {REPORT_QUANTITIES.map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "report" : "reports"} — ${REPORT_PRICE_NZD[n]} ($
                {perReport(n)} each)
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            The more you buy the less each one costs, and they don&rsquo;t expire.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl px-3 py-2.5 mb-4 text-xs"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          {/* Showing the working, because a bundle nobody can price is a bundle
              nobody trusts. Silver's parts add to exactly its price; Gold's add
              to more than it. */}
          {grant.reports} reports (${reportsValue(grant.reports)}) + the map (${MAP_VALUE_NZD})
          {grant.inspections > 0 && <> + an inspection (${INSPECTION_VALUE_NZD})</>}
          {(() => {
            const parts =
              reportsValue(grant.reports) + MAP_VALUE_NZD + grant.inspections * INSPECTION_VALUE_NZD;
            const saved = parts - price;
            // Silver's parts come to exactly its price, so claiming a saving
            // would be a lie and saying nothing would look like one. It says so.
            return saved > 0 ? (
              <> = ${parts.toLocaleString("en-NZ")} separately, so ${saved.toLocaleString("en-NZ")} off.</>
            ) : (
              <> = ${parts.toLocaleString("en-NZ")}. Exactly its parts — nothing hidden in it.</>
            );
          })()}
        </div>
      )}

      <ul className="space-y-1.5 mb-5 flex-1">
        <li className="flex items-start gap-2 text-sm">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: colour }} />
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {grant.reports} full {grant.reports === 1 ? "report" : "reports"}, yours to keep
          </span>
        </li>
        {featuresOf(pkg).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: colour }} />
            <span style={{ color: "var(--text-secondary)" }}>{FEATURE_LABEL[f]}</span>
          </li>
        ))}
        {grant.inspections > 0 && (
          <li className="flex items-start gap-2 text-sm">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: colour }} />
            <span style={{ color: "var(--text-secondary)" }}>
              A building inspector on the property
            </span>
          </li>
        )}
        {!grant.map && (
          <li className="flex items-start gap-2 text-sm">
            <Minus size={14} className="mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-muted)" }}>No map — that starts at Silver</span>
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
            {fulfilment} One inspection per purchase — not one a month, so buying again
            doesn&rsquo;t owe a second visit.
          </span>
        </div>
      )}

      <Cta pkg={pkg} quantity={quantity} colour={colour} />
    </div>
  );
}

/**
 * The buy button, aware of what the visitor already holds.
 *
 * There is no "you already have something better" state any more, because
 * nothing here replaces anything: credits add up, map access extends. Someone
 * on Gold buying ten more reports is doing a sensible thing, and the old
 * ladder's 409 would have refused them.
 */
function Cta({
  pkg,
  quantity,
  colour,
}: {
  pkg: Package;
  quantity: ReportQuantity;
  colour: string;
}) {
  const { entitlements } = useSession();
  const grant = grantFor(pkg, quantity);

  return (
    <>
      <BuyPlanButton
        pkg={pkg}
        quantity={pkg === "bronze" ? quantity : undefined}
        label={`Get ${PACKAGE_LABEL[pkg]}`}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-all"
        style={{ background: colour, color: "#fff" }}
      />
      {grant.map && entitlements.map && entitlements.mapUntil && (
        <p className="text-xs mt-2 text-center" style={{ color: "var(--text-muted)" }}>
          Your map runs to {formatAccessDate(entitlements.mapUntil)} — this adds {MAP_DAYS} days
        </p>
      )}
    </>
  );
}

/** The free report still exists; it just isn't a package. */
function FreeNote() {
  return (
    <div
      className="rounded-2xl p-5 mb-16 flex flex-col sm:flex-row sm:items-center gap-4"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <div className="flex-1">
        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Try it on your own listing first — free, once
        </div>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          One complete analysis of a real listing you paste in: every photo read, every defect
          shown. Only the conclusion stays blurred — the score and the valuation.
        </p>
      </div>
      <Link
        href="/signup"
        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap"
        style={{ background: "var(--brand)", color: "white" }}
      >
        Start free
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}

function ComparisonTable({ quantity }: { quantity: ReportQuantity }) {
  const cols: Package[] = [...PACKAGES];
  return (
    <div className="mb-16">
      <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--text-primary)" }}>
        What&rsquo;s in each
      </h2>
      <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
        <div className="min-w-[620px]">
          <Row header>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Feature
            </div>
            {cols.map((p) => (
              <div key={p} className="text-center">
                <div className="text-sm font-semibold" style={{ color: PACKAGE_COLOUR[p] }}>
                  {PACKAGE_LABEL[p]}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  ${priceFor(p, quantity).toLocaleString("en-NZ")}
                </div>
              </div>
            ))}
          </Row>

          <Row striped>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Reports
            </div>
            {cols.map((p) => (
              <div
                key={p}
                className="text-center text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {grantFor(p, quantity).reports}
              </div>
            ))}
          </Row>

          {FEATURE_ROWS.map((f, i) => (
            <Row key={f} striped={i % 2 === 1}>
              <div className="text-sm pr-4" style={{ color: "var(--text-secondary)" }}>
                {FEATURE_LABEL[f]}
              </div>
              {cols.map((p) => (
                <div key={p} className="flex justify-center">
                  {featuresOf(p).includes(f) ? (
                    <CheckCircle2 size={16} style={{ color: PACKAGE_COLOUR[p] }} />
                  ) : (
                    <Minus size={14} style={{ color: "var(--border)" }} />
                  )}
                </div>
              ))}
            </Row>
          ))}

          <Row>
            <div className="text-sm pr-4" style={{ color: "var(--text-secondary)" }}>
              In-person building inspection
            </div>
            {cols.map((p) => (
              <div key={p} className="flex justify-center">
                {grantFor(p, quantity).inspections > 0 ? (
                  <CheckCircle2 size={16} style={{ color: PACKAGE_COLOUR[p] }} />
                ) : (
                  <Minus size={14} style={{ color: "var(--border)" }} />
                )}
              </div>
            ))}
          </Row>
        </div>
      </div>
    </div>
  );
}

function Row({
  header = false,
  striped = false,
  children,
}: {
  header?: boolean;
  striped?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid px-4 py-3 items-center"
      style={{
        gridTemplateColumns: `minmax(240px,1.6fr) repeat(3, 1fr)`,
        borderBottom: "1px solid var(--border)",
        background: header ? "var(--surface-2)" : striped ? "var(--surface)" : "var(--bg)",
      }}
    >
      {children}
    </div>
  );
}

function Faq() {
  const faqs = [
    {
      q: "Is this a subscription?",
      a: "No. You buy reports, or a package, and it ends there — no recurring charge, no saved mandate, nothing to cancel. Reports don't expire at all: buy ten, use three this month and seven next year. Map access is the one thing on a clock, and it runs 30 days from purchase.",
    },
    {
      q: "Why can't I just buy the map?",
      a: "Because every coloured pin on it is a report somebody ran. A map sold on its own to people who never run reports is a map that never fills — the buyer gets less than they paid for, and so does everyone after them. Silver bundles it with 50 reports for that reason, not as a packaging trick.",
    },
    {
      q: "What do I actually get for free?",
      a: "One complete analysis of a real listing you paste in — every photo read, every defect and finding shown. What stays locked is the conclusion: the score out of 1,000, the valuation, and the Financial, Renovations and agent tabs. It's one report, not one a month, and buying opens the report you already ran rather than making you run it again.",
    },
    {
      q: "Silver has the agent document — so why would I need Gold?",
      a: `Because the agent document doesn't open until a building inspector has been to the property. It puts costed claims in front of somebody whose job is to take them apart, and your own walk-through can't settle whether a stain is an active leak or a repaired one. On Bronze and Silver you bring your own inspector's report and upload it. On Gold we send the inspector and load their report for you — so if you were paying for an inspection anyway, Gold is that inspection with everything else attached. ${INSPECTION_TERMS}`,
    },
    {
      q: "Is this a registered property valuation?",
      a: `No. ${PRODUCT_NAME} is AI-assisted analysis of publicly available listing data. It is not a registered valuation, building inspection, or legal advice. The Gold inspection is a real building inspection, carried out by the inspector, not by us.`,
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
