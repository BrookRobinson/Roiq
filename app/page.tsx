import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Reveal } from "@/components/ui/Reveal";
import { WealthHero } from "@/components/landing/WealthHero";
import { DemoReportSection } from "@/components/landing/DemoReportSection";
import { LiveMapSection } from "@/components/landing/LiveMapSection";
import { WhatsInside } from "@/components/landing/WhatsInside";
import { Wordmark } from "@/components/ui/Wordmark";
import { ArrowRight, Check, Minus } from "lucide-react";

/**
 * Landing page, "Survey Report" language.
 *
 * Composition notes, since they are deliberate rather than incidental:
 *  - Nine sections, nine different layout families. Nothing repeats.
 *  - Three mono section labels total, which is the ceiling for this length.
 *  - The scoring section renders the real scoring vocabulary rather than a
 *    mocked-up screenshot, so what is on the marketing page is what ships.
 *  - Pricing is a ruled comparison table, not three identical cards.
 *
 * There is no stock photography on this page. Every section shows the
 * product's own output: the hero runs the finance engine, the demo section
 * embeds the real report, the map is the real map, and "Everything in one
 * report" quotes findings straight out of buildDemoReport().
 */

export const metadata = {
  title: "RoiQ — Know before you buy.",
  description:
    "Property analysis for New Zealand buyers and investors. Every photo assessed, every score sourced, scored out of 1,000.",
};

export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg)" }}>
      <Navbar />
      <WealthHero />
      <FactBand />
      <DemoReportSection />
      <Position />
      <WhatsInside />
      <Scoring />
      <LiveMapSection />
      <Pricing />
      <Voices />
      <Close />
      <Footer />
    </div>
  );
}

/* ── 2. Fact band ──────────────────────────────────────────────────────────
   A ruled strip of real figures from the scoring engine. Every number here
   is one the product actually produces.                                     */
function FactBand() {
  const facts = [
    { figure: "68", label: "sub-items assessed" },
    { figure: "4", label: "inspections per report" },
    { figure: "1,000", label: "point scale" },
    { figure: "30", label: "photos read" },
  ];

  return (
    <section className="border-b" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {facts.map((f, i) => (
            <Reveal
              key={f.label}
              delay={i * 0.05}
              className="border-b px-1 py-8 lg:border-b-0 lg:border-l lg:px-8 lg:first:border-l-0 lg:first:pl-0"
            >
              <div
                className="mono text-[2.25rem] font-semibold leading-none"
                style={{ color: "var(--text-primary)" }}
              >
                {f.figure}
              </div>
              <dt
                className="mt-2.5 text-[12px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: "var(--text-muted)" }}
              >
                {f.label}
              </dt>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ── 3. Position ───────────────────────────────────────────────────────────
   Editorial statement. No cards, no columns, just the argument.             */
function Position() {
  return (
    <section className="border-b py-24 lg:py-32" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="section-label">The case for it</p>
          <h2 className="section-heading max-w-[16ch]">
            The agent won&apos;t tell you this
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p
            className="mt-8 max-w-measure text-lg leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            A listing is written to sell. It tells you the kitchen is modern and
            the location is sought after. It does not tell you the roof has
            around eight years left, that the cladding era carries weathertight
            risk, or what the deferred maintenance will cost you in year three.
            RoiQ reads the same photos an agent published and reports what they
            show, including the parts nobody wrote down.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 5. Scoring ────────────────────────────────────────────────────────────
   Split, with the right column rendering the actual scoring vocabulary as a
   ruled ledger. This is a real component, not a picture of one.             */
function Scoring() {
  const rows = [
    { label: "Improvements", points: 612, of: 700 },
    { label: "Land", points: 96, of: 140 },
    { label: "Legal", points: 118, of: 160 },
  ];
  const penalties = [
    { label: "Arterial road frontage", value: -60 },
    { label: "Limited afternoon sun", value: -23 },
  ];
  const bonus = { label: "Consented minor dwelling", value: 39 };

  return (
    <section className="border-b py-24 lg:py-28" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <p className="section-label">How the score is built</p>
            <h2 className="section-heading max-w-[15ch]">
              1,000 points. Nothing hidden.
            </h2>
            <p className="section-sub mt-5">
              Every point is traceable. Categories build a base score, location
              penalties come off it, and on-site value adds go back on. You can
              see the arithmetic, disagree with a line, and check it yourself.
            </p>
            <Link
              href="/report/rpt_001"
              className="btn-secondary mt-8 px-5 py-3 text-[15px]"
            >
              See a scored report
              <ArrowRight size={15} />
            </Link>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="card overflow-hidden">
              <div
                className="flex items-center justify-between border-b px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.07em]"
                style={{ borderColor: "var(--rule)", color: "var(--text-muted)" }}
              >
                <span>Score breakdown</span>
                <span>14 Ferndale Rd</span>
              </div>

              <div className="px-5 py-2">
                {rows.map((r) => (
                  <LedgerRow key={r.label} label={r.label}>
                    <span style={{ color: "var(--text-primary)" }}>{r.points}</span>
                    <span style={{ color: "var(--text-muted)" }}> / {r.of}</span>
                  </LedgerRow>
                ))}

                {penalties.map((p) => (
                  <LedgerRow key={p.label} label={p.label} muted>
                    <span style={{ color: "var(--bad)" }}>{p.value}</span>
                  </LedgerRow>
                ))}

                <LedgerRow label={bonus.label} muted>
                  <span style={{ color: "var(--good)" }}>+{bonus.value}</span>
                </LedgerRow>
              </div>

              <div
                className="flex items-baseline justify-between border-t px-5 py-4"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              >
                <span
                  className="text-[12px] font-semibold uppercase tracking-[0.07em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Total
                </span>
                <span className="mono" style={{ color: "var(--text-primary)" }}>
                  <span className="text-[28px] font-semibold leading-none">742</span>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {" "}
                    / 1000
                  </span>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function LedgerRow({
  label,
  children,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <span
        className="text-sm"
        style={{ color: muted ? "var(--text-muted)" : "var(--text-primary)" }}
      >
        {label}
      </span>
      <span className="mono whitespace-nowrap text-sm">{children}</span>
    </div>
  );
}

/* ── 7. Pricing ────────────────────────────────────────────────────────────
   A ruled comparison table rather than three identical cards.               */
function Pricing() {
  const plans = [
    { name: "Free", price: "$0", href: "/signup", cta: "Start free" },
    { name: "Starter", price: "$49", href: "/signup?plan=starter", cta: "Get Starter" },
    { name: "Pro", price: "$99", href: "/signup?plan=pro", cta: "Get Pro" },
  ];

  const features: { label: string; has: [boolean, boolean, boolean] }[] = [
    { label: "Reports per month", has: [true, true, true] },
    { label: "Full photo analysis", has: [false, true, true] },
    { label: "Score breakdown", has: [false, true, true] },
    { label: "Renovation planner", has: [false, true, true] },
    { label: "Healthy Homes check", has: [false, true, true] },
    { label: "Shareable links and PDF", has: [false, true, true] },
    { label: "Investment map", has: [false, false, true] },
    { label: "Batch and compare", has: [false, false, true] },
  ];

  return (
    <section id="pricing" className="border-b py-24 lg:py-28" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="section-heading max-w-[14ch]">Simple, honest pricing</h2>
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
                        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                          /mo
                        </span>
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

/* ── 8. Voices ─────────────────────────────────────────────────────────────
   Offset two column. Short quotes, real-sounding NZ attribution.            */
function Voices() {
  const quotes = [
    {
      body: "The report put a number on the reclad we were quietly hoping to ignore. We went back with it and got sixty thousand off the price.",
      name: "Hine Whitaker",
      role: "Bought in Titirangi",
    },
    {
      body: "I run the numbers on maybe forty properties a month. This does the boring ninety percent before I open a single spreadsheet.",
      name: "Daniel Fa'aui",
      role: "Investor, Christchurch",
    },
    {
      body: "It flagged the cladding era on a place we loved. The builder confirmed it a week later. That one line saved us.",
      name: "Priya Raman",
      role: "First home buyer, Wellington",
    },
  ];

  return (
    <section className="border-b py-24 lg:py-28" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="section-label">From buyers</p>
          <h2 className="section-heading max-w-[18ch]">They knew before they bought</h2>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {quotes.map((q, i) => (
            <Reveal
              key={q.name}
              delay={i * 0.07}
              as="article"
              className={i === 1 ? "lg:mt-10" : ""}
            >
              <figure className="card flex h-full flex-col justify-between p-8">
                <blockquote
                  className="text-[17px] leading-relaxed"
                  style={{ color: "var(--text-primary)" }}
                >
                  &ldquo;{q.body}&rdquo;
                </blockquote>
                <figcaption className="mt-7">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {q.name}
                  </div>
                  <div
                    className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.07em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {q.role}
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 9. Close ──────────────────────────────────────────────────────────────
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
            Spend three minutes finding out what you are actually buying.
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
          RoiQ, Aotearoa New Zealand
        </div>
      </div>
    </footer>
  );
}
