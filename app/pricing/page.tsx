"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    category: "Reports",
    rows: [
      { label: "Reports included", free: "3", starter: "Unlimited", pro: "Unlimited" },
      { label: "Watermark-free reports", free: false, starter: true, pro: true },
      { label: "Photo analysis (AI vision)", free: false, starter: true, pro: true },
      { label: "Full 6-category score breakdown", free: false, starter: true, pro: true },
      { label: "VFM grade with working shown", free: false, starter: true, pro: true },
    ],
  },
  {
    category: "Analysis tools",
    rows: [
      { label: "Renovation planner", free: false, starter: true, pro: true },
      { label: "Healthy Homes compliance check", free: false, starter: true, pro: true },
      { label: "Financial calculator (buyer + investor)", free: false, starter: true, pro: true },
      { label: "Equity timeline", free: false, starter: true, pro: true },
      { label: "Hazard report", free: true, starter: true, pro: true },
      { label: "Market comparables", free: "Basic", starter: "Full", pro: "Full" },
    ],
  },
  {
    category: "Export & sharing",
    rows: [
      { label: "PDF download", free: false, starter: true, pro: true },
      { label: "Email report", free: false, starter: true, pro: true },
      { label: "Shareable private link", free: false, starter: true, pro: true },
      { label: "Export to CSV", free: false, starter: false, pro: true },
    ],
  },
  {
    category: "Pro: Investment map",
    rows: [
      { label: "NZ investment map", free: false, starter: false, pro: true },
      { label: "Map filters (deposit, yield, suburb)", free: false, starter: false, pro: true },
      { label: "10-year profit on every listing", free: false, starter: false, pro: true },
      { label: "Alert system (new listings)", free: false, starter: false, pro: true },
      { label: "Saved searches + watchlist", free: false, starter: false, pro: true },
      { label: "Batch reports (10 at once)", free: false, starter: false, pro: true },
      { label: "Compare mode (3 properties)", free: false, starter: false, pro: true },
      { label: "Priority report generation", free: false, starter: false, pro: true },
    ],
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true)
    return <CheckCircle2 size={16} style={{ color: "var(--success)" }} />;
  if (value === false)
    return <XCircle size={16} style={{ color: "var(--border)" }} className="opacity-60" />;
  return <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{value}</span>;
}

export default function PricingPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Simple, honest pricing
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            One-off payment. No subscriptions. No hidden fees.
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            Prices in NZD. Pay once, nothing recurring.
          </p>
          <Link
            href="/report/rpt_001"
            className="inline-flex items-center gap-1.5 text-sm mt-3 cursor-pointer hover:underline"
            style={{ color: "var(--brand)" }}
          >
            View a sample report first →
          </Link>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              name: "Free",
              price: "$0",
              desc: "Try before you commit",
              href: "/signup",
              cta: "Start free",
              highlight: false,
              features: ["3 reports", "Market value estimate", "Quality score preview", "Basic equity calculator"],
            },
            {
              name: "Starter",
              price: "$49",
              desc: "Full reports, unlimited",
              href: "/signup?plan=starter",
              cta: "Get Starter",
              highlight: false,
              features: ["Unlimited reports", "Full photo analysis", "Renovation planner", "Healthy Homes check", "PDF + email", "Shareable links"],
            },
            {
              name: "Pro",
              price: "$99",
              desc: "For serious investors",
              href: "/signup?plan=pro",
              cta: "Get Pro",
              highlight: true,
              features: ["Everything in Starter", "NZ investment map", "Map filters + alerts", "Batch reports", "Compare mode", "CSV export"],
            },
          ].map((p) => (
            <div
              key={p.name}
              className="rounded-2xl p-6 relative"
              style={{
                background: p.highlight ? "var(--brand)" : "var(--surface)",
                border: p.highlight ? "none" : "1px solid var(--border)",
                boxShadow: p.highlight ? "0 16px 48px rgba(29,78,216,0.25)" : "none",
              }}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full" style={{ background: "#f59e0b", color: "#1a1a1a" }}>
                  Most popular
                </div>
              )}
              <div className="text-xl font-bold mb-0.5" style={{ color: p.highlight ? "white" : "var(--text-primary)" }}>
                {p.name}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold" style={{ color: p.highlight ? "white" : "var(--text-primary)" }}>
                  {p.price}
                </span>
                {p.price !== "$0" && (
                  <span className="text-sm" style={{ color: p.highlight ? "rgba(255,255,255,0.6)" : "var(--text-muted)" }}>once</span>
                )}
              </div>
              <p className="text-sm mb-5" style={{ color: p.highlight ? "rgba(255,255,255,0.75)" : "var(--text-secondary)" }}>
                {p.desc}
              </p>
              <ul className="space-y-2 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} style={{ color: p.highlight ? "#a5f3d0" : "var(--success)" }} />
                    <span style={{ color: p.highlight ? "rgba(255,255,255,0.9)" : "var(--text-secondary)" }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all"
                style={{
                  background: p.highlight ? "white" : "var(--brand)",
                  color: p.highlight ? "var(--brand)" : "white",
                }}
              >
                {p.cta}
                <ArrowRight size={15} />
              </Link>
            </div>
          ))}
        </div>

        {/* Feature comparison table */}
        <div>
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--text-primary)" }}>
            Full feature comparison
          </h2>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div
              className="grid grid-cols-4 px-6 py-3 text-sm font-semibold"
              style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
            >
              <div style={{ color: "var(--text-primary)" }}>Feature</div>
              {["Free", "Starter — $49", "Pro — $99"].map((h) => (
                <div key={h} className="text-center" style={{ color: "var(--text-primary)" }}>{h}</div>
              ))}
            </div>

            {FEATURES.map((section, si) => (
              <div key={section.category}>
                <div
                  className="px-6 py-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ background: "var(--surface)", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}
                >
                  {section.category}
                </div>
                {section.rows.map((row, ri) => (
                  <div
                    key={ri}
                    className="grid grid-cols-4 px-6 py-3 items-center"
                    style={{
                      borderBottom: si < FEATURES.length - 1 || ri < section.rows.length - 1 ? "1px solid var(--border)" : "none",
                      background: ri % 2 === 0 ? "var(--bg)" : "var(--surface)",
                    }}
                  >
                    <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{row.label}</div>
                    <div className="flex justify-center"><Cell value={row.free} /></div>
                    <div className="flex justify-center"><Cell value={row.starter} /></div>
                    <div className="flex justify-center"><Cell value={row.pro} /></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-8 text-center" style={{ color: "var(--text-primary)" }}>
            Common questions
          </h2>
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                q: "Is this a subscription?",
                a: "No. You pay once and the plan is yours. There is no recurring charge, nothing to cancel, and no billing period to keep track of.",
              },
              {
                q: "Is this a registered property valuation?",
                a: "No. BDR Report is AI-assisted analysis of publicly available listing data. It is not a registered valuation, building inspection, or legal advice.",
              },
              {
                q: "How accurate is the photo analysis?",
                a: "Photos are scored with a confidence tier. Tier 1 (≥90% confidence) findings are stated as fact. Tier 2 (65–89%) are labelled 'verify at inspection'. Tier 3 findings are unscored.",
              },
              {
                q: "What currency does BDR Report use?",
                a: "NZD by default. Australian users will see AUD pricing automatically based on browser locale.",
              },
            ].map((faq) => (
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
      </div>
    </div>
  );
}
