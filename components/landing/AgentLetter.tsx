import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";

import { Reveal } from "@/components/ui/Reveal";
import { buildDemoReport } from "@/lib/scoring/demo";
import { buildNegotiationCase } from "@/lib/negotiation/build";

/**
 * "Then send it to the agent" — the section that explains the negotiation
 * document, sitting straight after the value verdict.
 *
 * Built from buildNegotiationCase() on the demo report at render time, exactly
 * like the section above it, so the counts and the total on this page are the
 * ones the product would actually produce for that property. Nothing here is a
 * marketing number, which is the same promise the document itself makes.
 */

const data = buildNegotiationCase(buildDemoReport());

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

export function AgentLetter() {
  const items = data.critical.length + data.urgent.length;
  // The single most concrete thing on the page: a real finding, in the report's
  // own words, with the photo the agent can go and check it against.
  const lead = data.critical[0] ?? data.urgent[0];
  const pctOfAsking =
    data.askingPrice ? ((data.repairsHigh / data.askingPrice) * 100).toFixed(1) : null;

  return (
    <section className="border-b py-24 lg:py-28" style={{ borderColor: "var(--rule)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* The pitch */}
          <Reveal>
            <p className="section-label">Then send it to the agent</p>
            <h2 className="section-heading max-w-[16ch]">Ask for the repairs off the price.</h2>

            <p className="section-sub mt-5">
              Knowing a roof needs replacing is worth something. Being able to put it in front of the
              vendor&rsquo;s agent, in writing, with the photograph it came from and what it costs to
              fix, is worth rather more.
            </p>

            <p className="mt-5 text-[15px]" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
              Every report builds one automatically. Type the agent&rsquo;s email address and it goes
              — a plain, professional document setting out what needs doing and what it costs.
            </p>

            <p className="mt-5 text-[15px] font-semibold" style={{ color: "var(--accent-text)" }}>
              Nothing in it is invented. It only says what your report found.
            </p>

            <ul className="mt-6 space-y-2.5 text-[14px]" style={{ color: "var(--text-secondary)" }}>
              <li>Every finding carries the listing photo it was read from.</li>
              <li>Each one says whether it&rsquo;s confirmed or still to be verified at inspection.</li>
              <li>Costs are trade rates, and the letter says plainly that they&rsquo;re estimates.</li>
              <li>Your budget and your walk-away price are never part of it.</li>
            </ul>

            <Link href="/report/rpt_001" className="btn-secondary mt-8 px-6 py-3.5 text-[15px]">
              See it in the demo report
              <ArrowRight size={15} />
            </Link>
          </Reveal>

          {/* The document, as it actually comes out */}
          <Reveal delay={0.12}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--rule)" }}>
              <div
                className="flex items-center gap-2 border-b px-5 py-3"
                style={{ borderColor: "var(--rule)", color: "var(--text-muted)" }}
              >
                <Mail size={13} />
                <span className="text-[12px]">To: the listing agent</span>
              </div>

              <div className="px-5 py-5">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Condition findings
                </p>
                <p className="mt-1 text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {data.address}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <Figure label="Critical" value={String(data.critical.length)} tone="var(--bad)" />
                  <Figure label="Urgent" value={String(data.urgent.length)} tone="var(--warn)" />
                  <Figure label="Items" value={String(items)} />
                </div>

                <div
                  className="mt-4 flex items-baseline justify-between gap-3 px-4 py-3"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}
                >
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    Cost to remedy
                  </span>
                  <span className="mono text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {money(data.repairsLow)} – {money(data.repairsHigh)}
                  </span>
                </div>

                {pctOfAsking && (
                  <p className="mt-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {pctOfAsking}% of the {money(data.askingPrice as number)} asking price.
                  </p>
                )}

                {lead && (
                  <div
                    className="mt-5 px-4 py-3"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--rule)", borderLeft: "3px solid var(--bad)" }}
                  >
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {lead.name}
                    </p>
                    {lead.observedDefect && (
                      <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
                        {lead.observedDefect}
                      </p>
                    )}
                    <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Condition {lead.score}/10
                      {lead.photoRefs.length > 0
                        ? ` · listing photo${lead.photoRefs.length === 1 ? "" : "s"} ${lead.photoRefs.join(", ")}`
                        : ""}
                    </p>
                  </div>
                )}

                <p className="mt-5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Taken from the demo report on this page — not an illustration.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-3 py-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mono mt-0.5 text-[17px] font-bold" style={{ color: tone ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}
