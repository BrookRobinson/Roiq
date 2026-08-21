"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { ArrowRight, Shield, TrendingUp, Eye } from "lucide-react";

export default function AboutPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="mb-16">
          <h1
            className="text-5xl font-bold mb-6"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Honest information
            <br />
            <span style={{ color: "var(--brand)" }}>before you commit.</span>
          </h1>
          <p className="text-lg max-w-2xl" style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}>
            Listing photos show beauty, not reality. Agents present the best case. Buyers and investors
            spend tens of thousands on properties they didn&apos;t fully understand — then discover the
            roof needs replacing, the title is cross-lease, the area floods, or the yield is negative
            after costs.
          </p>
          <p className="text-lg max-w-2xl mt-4" style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}>
            BDR Report was built to fix that. We give you the honest picture before you make an offer.
          </p>
        </div>

        {/* Principles */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-8" style={{ color: "var(--text-primary)" }}>
            How we approach this
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: Eye,
                title: "Street-specific findings only",
                desc: "We never report town-level generics as property findings. Every hazard, every comparison, every finding is specific to the address you gave us.",
                color: "#3b82f6",
              },
              {
                icon: Shield,
                title: "Confidence tiers, not false certainty",
                desc: "Photos can only show so much. We tier every finding: Tier 1 confirmed, Tier 2 probable, Tier 3 unscored. You always know how sure we are.",
                color: "#10b981",
              },
              {
                icon: TrendingUp,
                title: "Data over marketing",
                desc: "We flag marketing language in listing descriptions. We separate what the agent claims from what the photos and data confirm.",
                color: "#f59e0b",
              },
            ].map((p) => (
              <div key={p.title} className="card p-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${p.color}18` }}
                >
                  <p.icon size={20} style={{ color: p.color }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  {p.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Legal note */}
        <div
          className="rounded-2xl p-6 mb-10"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Important</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            BDR Report analyses publicly available listing data and photos. It is not a registered property
            valuation, a building inspection, or legal advice. It is AI-assisted analysis that helps you
            ask better questions and make more informed decisions. Always engage qualified professionals
            — a building inspector, registered valuer, or lawyer — before purchasing.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup" className="btn-primary text-base py-3 px-8">
            Get started free
            <ArrowRight size={18} />
          </Link>
          <Link href="/report/rpt_001" className="btn-secondary text-base py-3 px-8">
            View sample report
          </Link>
        </div>
      </div>
    </div>
  );
}
