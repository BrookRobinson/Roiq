import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { buildDemoReport } from "@/lib/scoring/demo";
import { DEAL_HEX } from "@/lib/map/calc";
import { ArrowRight } from "lucide-react";

/**
 * "Everything in one report", built from the report itself.
 *
 * Every figure, finding and quote below is pulled out of buildDemoReport() at
 * render time, so this section cannot drift from what the product actually
 * produces: change the engine and these examples change with it.
 *
 * It replaces a bento of stock photography. Photographs of anonymous kitchens
 * told a visitor nothing about what they were buying, which is a strange thing
 * for the section whose entire job is to answer that.
 */

const report = buildDemoReport();
const byId = (id: string) => report.subItems.find((s) => s.id === id);

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const range = (lo: number, hi: number) => `${money(lo)} to ${money(hi)}`;

export function WhatsInside() {
  const roof = byId("ext_roof");
  const unconsented = byId("leg_unconsented");
  const insulation = byId("liv_insulation");
  const ventilation = byId("bath_ventilation");

  const asking = report.listing.askingPrice ?? 0;
  const sv = report.suburbValue;
  const cg = report.capitalGrowth;
  const rent = report.marketRent;

  // The three items the report puts in front of you before you make an offer.
  const priority = [roof, ventilation, insulation]
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({
      name: s.name,
      score: s.score,
      cost: s.estimatedReplacementCost,
    }));

  const scoreTotal = Math.round(report.scores.buyer.total);

  return (
    <section className="border-b py-24 lg:py-28" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="section-heading max-w-[16ch]">Everything in one report</h2>
          <p className="section-sub mt-4">
            Every example below is lifted straight out of the demo report on this
            page. Real findings on a real Auckland property, not illustrations.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {/* ── Condition: a real scored item, with the defect that drove it ── */}
          <Reveal className="lg:col-span-2" as="article">
            <Cell
              kicker="Condition, read from the photographs"
              title={`${roof?.name ?? "Roof"} scored ${roof?.score ?? 4}/10`}
            >
              {roof?.observedDefect && (
                <Quote>{roof.observedDefect}</Quote>
              )}
              <dl className="mt-5 grid gap-px sm:grid-cols-3" style={{ background: "var(--border)" }}>
                <Stat label="Age" value={roof?.estimatedAge ?? "~51 years"} />
                <Stat
                  label="Replace"
                  value={
                    roof?.estimatedReplacementCost
                      ? range(roof.estimatedReplacementCost.low, roof.estimatedReplacementCost.high)
                      : "n/a"
                  }
                />
                <Stat label="Evidence" value={roof?.evidenceSource ?? "Listing photos"} />
              </dl>
              <p className="mt-4 text-[13px]" style={{ color: "var(--text-muted)" }}>
                All {report.subItems.length} items are assessed this way, each tied
                to the photo it came from.
              </p>
            </Cell>
          </Reveal>

          {/* ── Renovation costing: the actual priority list ─────────────── */}
          <Reveal delay={0.06} as="article">
            <Cell kicker="Renovation costing" title="Priced before you offer">
              <ul className="mt-1 space-y-3">
                {priority.map((p) => (
                  <li
                    key={p.name}
                    className="flex items-baseline justify-between gap-3 border-b pb-3 last:border-b-0"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <span className="flex items-baseline gap-2">
                      <span
                        className="mono text-[12px] font-bold"
                        style={{ color: scoreHex(p.score) }}
                      >
                        {p.score ?? "-"}/10
                      </span>
                      <span className="text-[14px]" style={{ color: "var(--text-primary)" }}>
                        {p.name}
                      </span>
                    </span>
                    {p.cost && (
                      <span
                        className="mono whitespace-nowrap text-[13px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {money(p.cost.low)}+
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Cell>
          </Reveal>

          {/* ── Land and legal: the unconsented-works finding ─────────────── */}
          <Reveal delay={0.12} as="article">
            <Cell kicker="Land and legal" title="The thing nobody mentioned">
              <Quote>{unconsented?.finding ?? "Rear studio may be unconsented"}</Quote>
              {unconsented?.remediation && (
                <div
                  className="mt-4 p-3.5"
                  style={{ background: "var(--surface-2)", borderRadius: "var(--r-input)" }}
                >
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.07em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Remedy
                  </div>
                  <div className="mt-1.5 text-[14px]" style={{ color: "var(--text-primary)" }}>
                    {unconsented.remediation.description}
                  </div>
                  <div className="mono mt-1 text-[13px]" style={{ color: "var(--accent-text)" }}>
                    {range(unconsented.remediation.low, unconsented.remediation.high)}
                  </div>
                </div>
              )}
              {unconsented?.verifyAgainst && (
                <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
                  Verify against the {unconsented.verifyAgainst}.
                </p>
              )}
            </Cell>
          </Reveal>

          {/* ── The money: real market inputs ─────────────────────────────── */}
          <Reveal delay={0.18} as="article">
            <Cell kicker="The money" title="Sourced, not assumed">
              <dl className="mt-1 space-y-3">
                <Line label="Market rent" value={`${money(rent?.weekly ?? 0)}/wk`} />
                <Line label="Suburb median" value={`${money(sv?.medianPerSqm ?? 0)}/m²`} />
                <Line
                  label="Capital growth"
                  value={`${cg?.annualRatePct ?? 0}% a year`}
                />
              </dl>
              {sv?.source && (
                <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Source: {sv.source}, {sv.sampleSize} comparable sales, {sv.retrieved}.
                </p>
              )}
            </Cell>
          </Reveal>

          {/* ── Value verdict: asking against the evidence ────────────────── */}
          <Reveal delay={0.24} as="article">
            <Cell kicker="Value verdict" title="Is the asking price fair?">
              <div className="mt-1 space-y-4">
                <Big label="Asking" value={money(asking)} />
                <Big
                  label="Suburb median sale"
                  value={money(sv?.medianSalePrice ?? 0)}
                />
                <Big
                  label="Quality score"
                  value={`${scoreTotal}`}
                  suffix="/1000"
                  tone="var(--accent-text)"
                />
              </div>
            </Cell>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
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

function scoreHex(score: number | null): string {
  if (score === null) return "var(--text-muted)";
  if (score <= 4) return DEAL_HEX.red;
  if (score <= 6) return DEAL_HEX.orange;
  return "var(--good)";
}

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3" style={{ background: "var(--surface)" }}>
      <dt
        className="text-[11px] font-bold uppercase tracking-[0.07em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </dt>
      <dd className="mono mt-1 text-[13px]" style={{ color: "var(--text-primary)" }}>
        {value}
      </dd>
    </div>
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

function Big({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: string;
}) {
  return (
    <div>
      <div
        className="text-[11px] font-bold uppercase tracking-[0.07em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="mono mt-1.5 text-[26px] font-semibold leading-none"
        style={{ color: tone ?? "var(--text-primary)" }}
      >
        {value}
        {suffix && (
          <span className="text-[15px]" style={{ color: "var(--text-muted)" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
