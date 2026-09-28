import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Reveal } from "@/components/ui/Reveal";
import { QuestionHero } from "@/components/landing/QuestionHero";
import { DemoReportSection } from "@/components/landing/DemoReportSection";
import { LiveMapSection } from "@/components/landing/LiveMapSection";
import { WhatsInside } from "@/components/landing/WhatsInside";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Wordmark } from "@/components/ui/Wordmark";
import { ArrowRight, Check, Minus } from "lucide-react";
import { PRODUCT_NAME } from "@/lib/brand";
import {
  FEATURE_LABEL,
  FEATURE_NEEDS,
  featuresOf,
  grantFor,
  PACKAGE_LABEL,
  PACKAGES,
  priceFor,
  REPORT_PRICE_NZD,
  type Feature,
  type Package,
} from "@/lib/billing/plans";

/**
 * Landing page.
 *
 * Written to be read quickly: short sections, plain words, one idea each.
 * Every example comes from the product's own output — the demo section embeds
 * the real report, the map is the real map, and "What you get" quotes
 * buildDemoReport(). The valuation is explained in words rather than numbers,
 * so nothing here can disagree with the report embedded above it.
 */

export const metadata = {
  title: `${PRODUCT_NAME} — Know before you buy.`,
  description:
    "Property analysis for New Zealand buyers and investors. Every photo assessed, every component valued, every figure sourced.",
};

export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg)" }}>
      <Navbar />
      <QuestionHero />
      <DemoReportSection />
      <HowItWorks />
      <Position />
      <WhatsInside />
      <Valuation />
      <LiveMapSection />
      <Pricing />
      <Close />
      <Footer />
    </div>
  );
}

/* ── Position ──────────────────────────────────────────────────────────────
   The argument, short.                                                      */
function Position() {
  return (
    <section className="border-b py-24 lg:py-28" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="section-label">Why it matters</p>
          <h2 className="section-heading max-w-[16ch]">The listing is written to sell</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-8 max-w-measure text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            It tells you the kitchen is modern. It won&apos;t tell you the roof has a few years left or the
            cladding is from the leaky-home era. {PRODUCT_NAME} reads the same photos and tells you what they
            show.
          </p>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="mt-10 border-l-4 py-2 pl-6 sm:pl-8" style={{ borderColor: "var(--accent)" }}>
            <p
              className="max-w-[26ch] text-[1.5rem] font-semibold leading-[1.2] sm:text-[2rem]"
              style={{ letterSpacing: "-0.02em", color: "var(--text-primary)" }}
            >
              Find the expensive problems before you sign, not after.
            </p>
            <p className="mt-4 max-w-measure text-[16px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              A reclad can cost hundreds of thousands. Unconsented work can stop your loan. Knowing first is the
              difference between a better price and a bill.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Valuation ─────────────────────────────────────────────────────────────
   How the figure is built, in three plain steps. No numbers: the demo report
   above prints the real ones, and a second set here could disagree with it. */
function Valuation() {
  const steps = [
    {
      title: "The land",
      body: "What sections like it have actually sold for nearby, adjusted for this one's size, shape, slope and sun.",
    },
    {
      title: "The house, item by item",
      body: "Every part — roof, kitchen, bathroom, heating — priced at what it would cost to replace today, less the life it has already used.",
    },
    {
      title: "Anything extra",
      body: "A sleepout, garage or pool, valued for what it actually adds.",
    },
  ];
  return (
    <section className="border-b py-24 lg:py-28" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="section-label">How we value it</p>
          <h2 className="section-heading max-w-[18ch]">A price you can check, line by line</h2>
          <p className="section-sub mt-5">
            We add up three things and set the total against the asking price. Every figure shows how it was
            worked out, so you can check it — or argue with it.
          </p>
        </Reveal>
        <ol className="mt-12 grid gap-4 lg:grid-cols-3">
          {steps.map((st, i) => (
            <Reveal key={st.title} delay={i * 0.08} as="li">
              <div className="card h-full p-7">
                <h3 className="text-[19px] font-semibold leading-snug" style={{ letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
                  {i > 0 && <span style={{ color: "var(--accent-text)" }}>+ </span>}
                  {st.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {st.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
        <Reveal delay={0.26}>
          <Link href="#demo" className="btn-secondary mt-10 px-5 py-3 text-[15px]">
            See it on the demo report
            <ArrowRight size={15} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Pricing ────────────────────────────────────────────────────────────
   A ruled comparison table rather than three identical cards.               */
function Pricing() {
  // All three, because there are only three. The rows come from the feature map
  // in lib/billing/plans.ts, like the pricing page's — the hand-written version
  // of this table sold "Batch and compare", which was never built.
  //
  // Bronze is shown at 10 reports, which is what the dropdown opens on. Its
  // price moves; the ticks don't.
  const shown: Package[] = [...PACKAGES];
  const plans = shown.map((pkg) => ({
    pkg,
    name: PACKAGE_LABEL[pkg],
    price:
      pkg === "bronze"
        ? `from $${REPORT_PRICE_NZD[1]}`
        : `$${priceFor(pkg).toLocaleString("en-NZ")}`,
    reports: grantFor(pkg, 10).reports,
    href: "/pricing",
    cta: `Get ${PACKAGE_LABEL[pkg]}`,
  }));

  const features: { label: string; has: boolean[] }[] = [
    ...(Object.keys(FEATURE_NEEDS) as Feature[]).map((f) => ({
      label: FEATURE_LABEL[f],
      has: shown.map((p) => featuresOf(p).includes(f)),
    })),
    {
      label: "In-person building inspection",
      has: shown.map((p) => grantFor(p, 10).inspections > 0),
    },
  ];

  return (
    <section id="pricing" className="border-b py-24 lg:py-28" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="section-heading max-w-[14ch]">Simple, honest pricing</h2>
          <p
            className="mt-1 text-[15px] font-semibold"
            style={{ color: "var(--accent-text)" }}
          >
            One-off payments. No subscription, nothing auto-renews.
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Reports never expire. Map access runs 30 days.{" "}
            <Link href="/pricing" className="font-semibold hover:underline" style={{ color: "var(--accent-text)" }}>
              See the full breakdown →
            </Link>
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="w-[34%] border-b py-5 pr-4 align-bottom" style={{ borderColor: "var(--border)" }}>
                    <span
                      className="text-[12px] font-semibold uppercase tracking-[0.07em]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Plan
                    </span>
                  </th>
                  {plans.map((p) => (
                    <th
                      key={p.name}
                      className="border-b py-5 pl-4 align-bottom"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div
                        className="text-[15px] font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {p.name}
                      </div>
                      <div
                        className="mono mt-1 text-[26px] font-medium leading-none"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {p.price}
                      </div>
                      <div className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {p.pkg === "bronze"
                          ? "As many reports as you want"
                          : `${p.reports} reports`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f) => (
                  <tr key={f.label}>
                    <td
                      className="border-b py-3.5 pr-4 text-sm"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                    >
                      {f.label}
                    </td>
                    {f.has.map((on, i) => (
                      <td
                        key={i}
                        className="border-b py-3.5 pl-4"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        {on ? (
                          <Check size={16} style={{ color: "var(--good)" }} aria-label="Included" />
                        ) : (
                          <Minus size={16} style={{ color: "var(--ink-3)" }} aria-label="Not included" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td />
                  {plans.map((p) => (
                    <td key={p.name} className="py-6 pl-4">
                      <Link href={p.href} className="btn-primary w-full px-4 py-3 text-sm">
                        {p.cta}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Close ──────────────────────────────────────────────────────────────
   Centered, because a closing statement is the one place it earns it.       */
function Close() {
  return (
    <section className="border-b py-28 lg:py-36" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="section-heading mx-auto max-w-[15ch]">
            The biggest cheque you&apos;ll ever write
          </h2>
          <p
            className="mx-auto mt-6 max-w-[54ch] text-lg leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Take three minutes to find out what you&apos;re actually buying.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/report/new" className="btn-primary px-7 py-3.5 text-[15px]">
              Analyse a listing
              <ArrowRight size={16} />
            </Link>
            <Link href="/report/rpt_001" className="btn-secondary px-7 py-3.5 text-[15px]">
              Read a sample report
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Footer ────────────────────────────────────────────────────────────── */
function Footer() {
  const groups = [
    {
      heading: "Product",
      links: [
        { href: "/report/new", label: "New report" },
        { href: "/map", label: "Map" },
        { href: "/pricing", label: "Pricing" },
        { href: "/report/rpt_001", label: "Sample report" },
      ],
    },
    {
      heading: "Company",
      links: [
        { href: "/about", label: "About" },
        { href: "/terms", label: "Terms" },
        { href: "/privacy", label: "Privacy" },
      ],
    },
  ];

  return (
    <footer className="py-16" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div style={{ color: "var(--text-primary)" }}>
              <Wordmark />
            </div>
            <p
              className="mt-4 max-w-[38ch] text-sm leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Property analysis for New Zealand buyers and investors.
            </p>
          </div>

          {groups.map((g) => (
            <div key={g.heading} className="md:col-span-3">
              <h3
                className="text-[12px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: "var(--text-muted)" }}
              >
                {g.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm transition-colors hover:opacity-70"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-14 border-t pt-6 text-[12px] font-semibold uppercase tracking-[0.07em]"
          style={{ borderColor: "var(--rule)", color: "var(--text-muted)" }}
        >
          {PRODUCT_NAME}, Aotearoa New Zealand
        </div>
      </div>
    </footer>
  );
}
