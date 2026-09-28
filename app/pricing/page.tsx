"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Navbar from "@/components/Navbar";
import { Check, ArrowRight, Info, Map as MapIcon, FileText } from "lucide-react";

import BuyPlanButton from "@/components/billing/BuyPlanButton";
import { useSession } from "@/lib/auth/session";
import { PRODUCT_NAME } from "@/lib/brand";
import {
  describeGrant,
  FEATURE_LABEL,
  FEATURE_NEEDS,
  formatAccessDate,
  grantFor,
  MAP_PRICE_NZD,
  MAP_TERM,
  orderPrice,
  perReport,
  REPORT_PRICE_NZD,
  REPORT_QUANTITIES,
  type Feature,
  type Order,
} from "@/lib/billing/plans";

// ============================================================
// Pricing.
//
// Two things, bought together or apart: reports ($29 down to $10 each at 20)
// and the map ($249 for 12 months). What each includes is read from the feature
// map in lib/billing/plans.ts — the same map the gates in the app read — so
// nothing can be listed here that the app doesn't actually unlock.
// ============================================================

const REPORT_FEATURES = (Object.keys(FEATURE_NEEDS) as Feature[]).filter((f) => FEATURE_NEEDS[f] === "paid");
const MAP_FEATURES = (Object.keys(FEATURE_NEEDS) as Feature[]).filter((f) => FEATURE_NEEDS[f] === "map");

export default function PricingPage() {
  const [reports, setReports] = useState<Order["reports"]>(10);
  const [map, setMap] = useState(false);
  const { entitlements } = useSession();
  // Nothing at all isn't an order — unticking the map with no reports picks one.
  const order: Order = reports === 0 && !map ? { reports: 1, map: false } : { reports, map };
  const summary = describeGrant(grantFor(order));

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl font-bold mb-4"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            Simple, honest pricing
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Pay for the reports you need. Add the map if you want every analysed property.
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            Prices in NZD. One-off payments — nothing auto-renews. Reports never expire.
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

        <div className="grid gap-5 lg:grid-cols-2 mb-6">
          {/* ── Reports ─────────────────────────────────────────────────── */}
          <div className="card p-6 flex flex-col">
            <div className="flex items-center gap-2">
              <FileText size={18} style={{ color: "var(--brand)" }} />
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Reports</h2>
            </div>
            <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-secondary)" }}>
              ${REPORT_PRICE_NZD[1]} for one, down to $10 each when you buy 20.
            </p>
            <div role="radiogroup" aria-label="How many reports" className="space-y-2">
              {REPORT_QUANTITIES.map((n) => {
                const on = reports === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setReports(n)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 cursor-pointer text-left"
                    style={{
                      background: on ? "var(--accent-wash)" : "var(--surface-2)",
                      border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`,
                    }}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ border: `1px solid ${on ? "var(--brand)" : "var(--rule-strong)"}`, background: on ? "var(--brand)" : "transparent" }}
                      >
                        {on && <Check size={10} style={{ color: "var(--on-accent)" }} />}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {n} {n === 1 ? "report" : "reports"}
                      </span>
                      {n === 20 && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--good-wash)", color: "var(--good)" }}>
                          Best value
                        </span>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="mono text-sm font-bold" style={{ color: "var(--text-primary)" }}>${REPORT_PRICE_NZD[n]}</span>
                      {n > 1 && (
                        <span className="block mono text-[11px]" style={{ color: "var(--text-muted)" }}>${perReport(n)} each</span>
                      )}
                    </span>
                  </button>
                );
              })}
              {map && (
                <button
                  type="button"
                  role="radio"
                  aria-checked={reports === 0}
                  onClick={() => setReports(0)}
                  className="w-full rounded-xl px-4 py-2.5 cursor-pointer text-left text-sm"
                  style={{
                    background: reports === 0 ? "var(--accent-wash)" : "transparent",
                    border: `1px dashed ${reports === 0 ? "var(--brand)" : "var(--border)"}`,
                    color: "var(--text-secondary)",
                  }}
                >
                  No reports — just the map
                </button>
              )}
            </div>
            <ul className="mt-5 space-y-2">
              {REPORT_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--good)", flexShrink: 0, marginTop: 2 }} />
                  {FEATURE_LABEL[f]}
                </li>
              ))}
            </ul>
          </div>

          {/* ── The map ─────────────────────────────────────────────────── */}
          <div className="card p-6 flex flex-col" style={map ? { border: "1px solid var(--brand)" } : undefined}>
            <div className="flex items-center gap-2">
              <MapIcon size={18} style={{ color: "var(--brand)" }} />
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>The map</h2>
            </div>
            <div className="mt-1 mb-4">
              <span className="mono text-3xl font-bold" style={{ color: "var(--text-primary)" }}>${MAP_PRICE_NZD}</span>
              <span className="text-sm ml-1.5" style={{ color: "var(--text-muted)" }}>for {MAP_TERM}</span>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Every property anyone has analysed, coloured against its asking price or against your own numbers,
              with the best deals ranked for you — and the full report on every one of them.
            </p>
            <ul className="mt-4 space-y-2 flex-1">
              {MAP_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <Check size={15} style={{ color: "var(--good)", flexShrink: 0, marginTop: 2 }} />
                  {FEATURE_LABEL[f]}
                </li>
              ))}
              <li className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <Check size={15} style={{ color: "var(--good)", flexShrink: 0, marginTop: 2 }} />
                Best deals for you, ranked on your budget and numbers
              </li>
            </ul>
            {entitlements.map && entitlements.mapUntil && (
              <p className="text-xs mt-3" style={{ color: "var(--good)" }}>
                You have the map until {formatAccessDate(entitlements.mapUntil)} — adding it again extends that.
              </p>
            )}
            <label
              className="mt-5 flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
              style={{
                background: map ? "var(--accent-wash)" : "var(--surface-2)",
                border: `1px solid ${map ? "var(--brand)" : "var(--border)"}`,
              }}
            >
              <input
                type="checkbox"
                checked={map}
                onChange={(e) => {
                  setMap(e.target.checked);
                  if (!e.target.checked && reports === 0) setReports(1);
                }}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Add the map · ${MAP_PRICE_NZD}
              </span>
            </label>
          </div>
        </div>

        {/* ── The order ─────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 mb-10 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--rule-strong)" }}
        >
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Your order</div>
            <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {summary.charAt(0).toUpperCase() + summary.slice(1)}
            </div>
          </div>
          <div className="mono text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            ${orderPrice(order).toLocaleString("en-NZ")}
          </div>
          <BuyPlanButton
            order={order}
            label="Buy now"
            className="btn-primary px-6 py-3 text-[15px] gap-1.5 justify-center"
            returnTo="/pricing"
          />
        </div>

        <FreeNote />
        <Faq />
      </div>
    </div>
  );
}

/** The free report still exists; it just isn't for sale. */
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
          shown. Only the conclusion stays blurred — the valuation.
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

function Faq() {
  const faqs = [
    {
      q: "Is this a subscription?",
      a: `No. You buy reports, the map, or both, and it ends there — no recurring charge, no saved mandate, nothing to cancel. Reports don't expire at all: buy ten, use three this month and seven next year. The map is the one thing on a clock: ${MAP_TERM} from purchase, and buying it again adds to what's left.`,
    },
    {
      q: "What does the map get me?",
      a: `Every property anyone has analysed, coloured against its asking price — or, for an investor, against your own deposit, rate and hold — the Best deals list ranked on your numbers, and the full report on every one of them, not just your own. $${MAP_PRICE_NZD} for ${MAP_TERM}. Add it to a report purchase, or buy it on its own.`,
    },
    {
      q: "What do I actually get for free?",
      a: "One complete analysis of a real listing you paste in — every photo read, every defect and finding shown. What stays locked is the conclusion: the valuation and the Financial and Renovations tabs. It's one report, not one a month, and buying opens the report you already ran rather than making you run it again.",
    },
    {
      q: "Is this a registered property valuation?",
      a: `No. ${PRODUCT_NAME} is AI-assisted analysis of publicly available listing data. It is not a registered valuation, building inspection, or legal advice.`,
    },
    {
      q: "How accurate is the photo analysis?",
      a: "Every finding carries a confidence level. Clear ones are stated as fact; less certain ones are labelled 'verify at the viewing'. Anything the photos don't show isn't valued as if it were seen — it's either estimated and labelled as estimated, or left out.",
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
