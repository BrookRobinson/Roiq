import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { buildDemoReport } from "@/lib/scoring/demo";
import { ArrowRight } from "lucide-react";

/**
 * "Everything in one report", built from the report itself.
 *
 * Every figure, finding and quote below is pulled out of buildDemoReport() at
 * render time, so this section cannot drift from what the product actually
 * produces: change the engine and these examples change with it.
 *
 * No computed dollar figures: see the note in WhatsInside. It replaces a bento
 * of stock photography. Photographs of anonymous kitchens
 * told a visitor nothing about what they were buying, which is a strange thing
 * for the section whose entire job is to answer that.
 */

const report = buildDemoReport();
const byId = (id: string) => report.subItems.find((s) => s.id === id);

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

// Deliberately no computed dollar values here. The report's own figures come
// out of the full valuation (lib/scoring/property-value.ts) with inputs this
// page doesn't have, and a second, slightly different number beside the embedded
// demo is the rival-valuation mistake. Words and source data only; the demo
// above shows the money.
const JOB: Record<string, string> = { repair: "Repair", maintenance: "Maintain", replace: "Replace" };

export function WhatsInside() {
  const roof = byId("ext_roof");
  // Three real jobs from the demo's plan, as the Renovations tab lists them.
  const jobs = ["ext_roof", "bath_hotwater", "ext_gutters"]
    .map((id) => byId(id))
    .filter((s): s is NonNullable<typeof s> => !!s?.urgentAction)
    .map((s) => ({ name: s.name, kind: JOB[s.urgentAction!.scope] ?? "Repair", work: s.urgentAction!.work }));
  const rent = report.marketRent;
  const cg = report.capitalGrowth;

  return (
    <section className="border-b py-24 lg:py-28" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="section-heading max-w-[16ch]">What you get</h2>
          <p className="section-sub mt-4">
            Four things every report gives you. Each example is taken from the demo report above.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          <Reveal as="article">
            <Cell kicker="1 · Every item, from the photos" title="What's actually wrong, and where">
              {roof?.observedDefect && <Quote>{roof.observedDefect}</Quote>}
              {roof && roof.photoReferences.length > 0 && (
                <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
                  {roof.name} · seen in photos {roof.photoReferences.join(", ")}
                </p>
              )}
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Every item is checked like this, and each is valued in dollars: what it would cost to replace
                today, less the life it has already used.
              </p>
            </Cell>
          </Reveal>

          <Reveal delay={0.06} as="article">
            <Cell kicker="2 · A renovation plan" title="What to do, and when">
              <ul className="space-y-3">
                {jobs.map((j) => (
                  <li key={j.name} className="grid gap-x-3 text-[14px]" style={{ gridTemplateColumns: "4.5rem minmax(0,1fr)" }}>
                    <span className="font-semibold" style={{ color: "var(--accent-text)" }}>{j.kind}</span>
                    <span style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>{j.work}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Split into what&apos;s needed straight after you buy, and what falls due in each year you own it.
              </p>
            </Cell>
          </Reveal>

          <Reveal delay={0.12} as="article">
            <Cell kicker="3 · The land and the title" title="Measured, not guessed">
              <ul className="space-y-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
                <li>Section size, shape, slope and midwinter sun, from national survey and terrain data</li>
                <li>Title type and what&apos;s registered on it, from LINZ</li>
                <li>District plan zoning, from the council</li>
              </ul>
            </Cell>
          </Reveal>

          <Reveal delay={0.18} as="article">
            <Cell kicker="4 · The money" title="Worked through for your hold">
              <dl className="space-y-3">
                {rent && <Line label="Market rent" value={`${money(rent.weekly)}/wk`} />}
                {cg && <Line label="Long-run growth" value={`${cg.annualRatePct}% a year`} />}
              </dl>
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Mortgage, rates, insurance and renovations over however long you plan to own it, for a home buyer
                or an investor.
              </p>
              {rent?.source && (
                <p className="mt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Rent: {rent.source}.{cg?.source ? ` Growth: ${cg.source}.` : ""}
                </p>
              )}
            </Cell>
          </Reveal>
        </div>

        <Reveal delay={0.24}>
          <Link href="#demo" className="btn-secondary mt-10 px-6 py-3.5 text-[15px]">
            Open the full demo report
            <ArrowRight size={15} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

function Cell({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card flex h-full flex-col p-7">
      <div
        className="text-[11px] font-bold uppercase tracking-[0.09em]"
        style={{ color: "var(--accent-text)" }}
      >
        {kicker}
      </div>
      <h3
        className="mt-2 text-[19px] font-semibold leading-snug"
        style={{ letterSpacing: "-0.015em", color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}

/** A verbatim line from the report, marked as a quotation rather than our copy. */
function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      className="border-l-2 pl-4 text-[15px] leading-relaxed"
      style={{ borderColor: "var(--accent)", color: "var(--text-secondary)" }}
    >
      {children}
    </blockquote>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 border-b pb-3 last:border-b-0"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <dt className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </dt>
      <dd className="mono text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
        {value}
      </dd>
    </div>
  );
}

