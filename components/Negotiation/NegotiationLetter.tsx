"use client";

// ============================================================
// The document the agent receives.
//
// Written to be read by a vendor's agent, which sets the tone: every claim is
// attributed, every figure is labelled as an estimate, and the confidence tier
// of each finding is printed next to it. A letter that overstates one item is a
// letter the other side can dismiss entirely, so the limitations section is part
// of the argument rather than fine print.
//
// Renders identically in the app and on the shared link the agent opens.
//
// It also states, at the top, the date the purchaser walked through the
// property. That sentence is the reason the "For the agent" tab is gated behind
// the viewing checklist: a schedule of defects assembled from marketing photos
// by someone who has never been to the house is not a negotiating position, and
// this document is not allowed to imply otherwise.
// ============================================================

import type { NegotiationCase, NegotiationItem, ReductionAsk, ViewingFinding } from "@/lib/negotiation/build";
import { PRODUCT_NAME } from "@/lib/brand";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const range = (lo: number, hi: number) => (lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`);

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });

const TIER_LABEL: Record<number, string> = {
  1: "Confirmed from photo",
  2: "Probable — verify at inspection",
  3: "Not visible — inferred",
};

export function NegotiationLetter({
  data,
  preparedBy,
  note,
}: {
  data: NegotiationCase;
  /** The buyer's name, as they typed it. Blank is fine — nothing is invented. */
  preparedBy?: string;
  note?: string;
}) {
  const total = data.critical.length + data.urgent.length;
  const hasCase = total > 0 || data.remedies.length > 0;

  return (
    <article
      className="mx-auto max-w-3xl"
      style={{ background: "var(--surface)", border: "1px solid var(--rule)" }}
    >
      {/* Letterhead */}
      <header className="border-b px-8 py-7" style={{ borderColor: "var(--rule)" }}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-lg font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {PRODUCT_NAME}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              Independent property condition analysis
            </div>
          </div>
          <div className="text-right text-[11px]" style={{ color: "var(--text-muted)" }}>
            <div>{longDate(data.reportDate)}</div>
            <div className="mono mt-0.5">Ref {data.reportId.slice(0, 8)}</div>
          </div>
        </div>

        <h1 className="mt-6 text-xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          Condition findings — {data.address || "this property"}
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {[data.suburb, data.region].filter(Boolean).join(", ")}
          {data.bedrooms ? ` · ${data.bedrooms} bed` : ""}
          {data.bathrooms ? ` · ${data.bathrooms} bath` : ""}
          {data.floorAreaSqm ? ` · ${data.floorAreaSqm}m² floor` : ""}
          {data.buildYear ? ` · built c.${data.buildYear}` : ""}
        </p>
      </header>

      <div className="px-8 py-7">
        {/* Opening — states what this is and what it isn't. */}
        <p className="text-[14px]" style={{ color: "var(--text-primary)", lineHeight: 1.65 }}>
          {preparedBy?.trim() ? `${preparedBy.trim()} has` : "A prospective purchaser has"} commissioned an
          independent condition analysis of the above property. The assessment scored{" "}
          {data.photosAnalysed > 0
            ? `${data.photosAnalysed} listing photograph${data.photosAnalysed === 1 ? "" : "s"}`
            : "the listing material"}{" "}
          against a 1,000-point rubric, returning {data.score}/1000.
          {data.viewing?.inspectedOn
            ? ` The purchaser then attended the property on ${longDate(data.viewing.inspectedOn)} and checked each item the analysis was unable to assess from photographs. What follows reflects both.`
            : ""}
        </p>

        {/* What the visit changed. An agent's first move is to test whether the
            sender has been to the house; saying so up front, with the count of
            items dropped after being found sound, is what makes the remainder
            hard to wave away. */}
        {data.viewing && data.viewing.cleared > 0 && (
          <p className="mt-4 text-[14px]" style={{ color: "var(--text-primary)", lineHeight: 1.65 }}>
            {data.viewing.cleared} item{data.viewing.cleared === 1 ? "" : "s"} the analysis had flagged{" "}
            {data.viewing.cleared === 1 ? "was" : "were"} inspected on site and found sound.{" "}
            {data.viewing.cleared === 1 ? "It is" : "They are"} not put forward here and{" "}
            {data.viewing.cleared === 1 ? "has" : "have"} been removed from the figures.
          </p>
        )}

        {note?.trim() && (
          <p className="mt-4 text-[14px]" style={{ color: "var(--text-primary)", lineHeight: 1.65 }}>
            {note.trim()}
          </p>
        )}

        {hasCase ? (
          <>
            <p className="mt-4 text-[14px]" style={{ color: "var(--text-primary)", lineHeight: 1.65 }}>
              {askOpening(data.ask)}
            </p>

            <p className="mt-4 text-[14px]" style={{ color: "var(--text-primary)", lineHeight: 1.65 }}>
              The items below were graded as requiring action. They are set out with the evidence each
              finding rests on, so they can be checked against the listing photographs and confirmed at
              inspection. Indicative costs to remedy total{" "}
              <strong>{range(data.repairsLow, data.repairsHigh)}</strong>.
            </p>

            {/* Headline figures */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Figure label="Critical items" value={String(data.critical.length)} tone="bad" />
              <Figure label="Urgent items" value={String(data.urgent.length)} tone="warn" />
              <Figure
                label={data.ask ? "Reduction sought" : "Indicative cost to remedy"}
                value={data.ask ? money(data.ask.amount) : range(data.repairsLow, data.repairsHigh)}
              />
            </div>

            {data.critical.length > 0 && (
              <Section
                title="Critical"
                caption="Immediate action required"
                tone="bad"
                items={data.critical}
              />
            )}

            {data.urgent.length > 0 && (
              <Section
                title="Urgent"
                caption="Replacement or repair required in the near term"
                tone="warn"
                items={data.urgent}
              />
            )}

            {data.remedies.length > 0 && (
              <section className="mt-8">
                <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Also flagged
                </h2>
                <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Specific remedial or compliance items identified in the analysis.
                </p>
                <div className="mt-3 space-y-2">
                  {data.remedies.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-start justify-between gap-4 px-4 py-3"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                          {r.name}
                        </div>
                        <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                          {r.description}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {r.area}
                        </div>
                      </div>
                      <div className="mono whitespace-nowrap text-[13px]" style={{ color: "var(--text-primary)" }}>
                        {range(r.costLow, r.costHigh)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Total */}
            <div
              className="mt-8 flex items-baseline justify-between gap-4 px-5 py-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--rule-strong)" }}
            >
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Total indicative cost to remedy
                </div>
                <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {total} item{total === 1 ? "" : "s"}
                  {data.remedies.length > 0 ? ` and ${data.remedies.length} flagged remed${data.remedies.length === 1 ? "y" : "ies"}` : ""}
                </div>
              </div>
              <div className="mono text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {range(data.repairsLow, data.repairsHigh)}
              </div>
            </div>
          </>
        ) : (
          // No manufactured case. If the analysis found nothing requiring action,
          // the document says exactly that.
          <p className="mt-4 text-[14px]" style={{ color: "var(--text-primary)", lineHeight: 1.65 }}>
            The analysis did not grade any item as critical or urgent. No remedial work is put forward on
            the basis of this report.
          </p>
        )}

        {/* Found on site. Kept apart from the scored findings and uncosted: it is
            the purchaser's own observation, and dressing it up as an assessed
            item would be the same over-claim this document exists to avoid. */}
        {data.viewing && data.viewing.confirmed.length > 0 && (
          <FindingList
            title="Observed at the inspection"
            caption="Noted by the purchaser at the property. The analysis did not grade these — it could not see them — so any figure shown is the indicative cost of the work, and none of it is included in the reduction sought above."
            findings={data.viewing.confirmed}
          />
        )}

        {/* Could not be reached. Stated plainly — an item nobody could look at is
            an open question for the vendor, not a claim, and never a number. */}
        {data.viewing && data.viewing.notInspected.length > 0 && (
          <FindingList
            title="Not able to be inspected"
            caption="Neither the listing material nor the inspection could establish these. No cost is claimed for any of them; we ask that the vendor confirm their condition or provide the relevant documentation."
            findings={data.viewing.notInspected}
          />
        )}

        {/* Limitations — part of the argument, not fine print. */}
        <section className="mt-9 border-t pt-5" style={{ borderColor: "var(--rule)" }}>
          <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Basis and limitations
          </h2>
          <ul className="mt-2 space-y-1.5 text-[12px]" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <li>
              The assessment was made from{" "}
              {data.photosAnalysed > 0
                ? `${data.photosAnalysed} listing photograph${data.photosAnalysed === 1 ? "" : "s"}`
                : "the listing material"}{" "}
              and the listing information.{" "}
              {data.viewing?.inspectedOn
                ? `It was followed by a visual inspection of the property by the purchaser on ${longDate(data.viewing.inspectedOn)}. That inspection was not carried out by a licensed building surveyor and no invasive testing was undertaken.`
                : "No physical inspection was carried out and no invasive testing was undertaken."}
            </li>
            {data.hasUnverified && (
              <li>
                Findings marked <em>Probable</em> or <em>Inferred</em> are not confirmed from a photograph
                and should be verified at inspection before being relied on.
              </li>
            )}
            <li>
              Costs are indicative Replace-Budget rates for tradesperson-supplied work at current New
              Zealand prices. They are estimates for the purpose of discussion, not quotations, and no
              trade has priced this property.
            </li>
            {data.notAssessed > 0 && (
              <li>
                {data.notAssessed} item{data.notAssessed === 1 ? "" : "s"} could not be assessed from the
                material available and {data.notAssessed === 1 ? "is" : "are"} excluded from the figures
                above.
                {data.viewing?.inspectedOn
                  ? " Each was carried to the inspection and is reported above as observed, sound, or unable to be reached."
                  : ""}
              </li>
            )}
            <li>
              This document does not constitute a building report, a valuation, or legal or financial
              advice.
            </li>
          </ul>
        </section>

        <footer className="mt-7 border-t pt-4 text-[11px]" style={{ borderColor: "var(--rule)", color: "var(--text-muted)" }}>
          Prepared with {PRODUCT_NAME} · Assessment dated {longDate(data.reportDate)}
          {data.listingUrl ? " · Listing details as advertised at the time of assessment" : ""}
        </footer>
      </div>
    </article>
  );
}

/**
 * The ask. Justified by the schedule and nothing else.
 *
 * Deliberately says nothing about what the buyer thinks the property is worth.
 * That assessment is the buyer's own information and it stays in the app —
 * telling a vendor's agent the property looks under-priced would give away the
 * buyer's position and invite the price to go up, not down.
 */
function askOpening(ask: ReductionAsk | null): string {
  if (!ask) {
    return "The items below were graded as requiring action. They are set out so the scope can be agreed and verified at inspection.";
  }
  const pct = ask.pctOfAsking != null ? `, which is ${ask.pctOfAsking}% of the advertised price` : "";
  return `On the basis of the findings below, we are seeking a reduction of ${money(ask.amount)}${pct}. Each item is work the purchaser would have to carry out, and the schedule sets out what each one is, the evidence it rests on, and what it is estimated to cost.`;
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "bad" | "warn" }) {
  const color = tone === "bad" ? "var(--bad)" : tone === "warn" ? "var(--warn)" : "var(--text-primary)";
  return (
    <div className="px-4 py-3" style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mono mt-1 text-[17px] font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

/**
 * Items settled by the visit rather than the analysis — observed, or unable to be
 * reached. Deliberately plainer than a Section: no severity accent, no condition
 * score and no money, because none of those were assessed.
 */
function FindingList({
  title,
  caption,
  findings,
}: {
  title: string;
  caption: string;
  findings: ViewingFinding[];
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {title}
      </h2>
      <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
        {caption}
      </p>
      <div className="mt-3 space-y-2">
        {findings.map((f) => (
          <div key={f.id} className="flex items-start justify-between gap-4 px-4 py-3" style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}>
            <div className="min-w-0">
            <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {f.name}
            </div>
            {f.note && (
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-primary)", lineHeight: 1.55 }}>
                &ldquo;{f.note}&rdquo;
              </p>
            )}
            <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {f.area}
            </div>
            </div>
            {f.costHigh != null && f.costLow != null && (
              <div className="mono whitespace-nowrap text-[13px]" style={{ color: "var(--text-primary)" }}>
                {range(f.costLow, f.costHigh)}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Section({
  title,
  caption,
  tone,
  items,
}: {
  title: string;
  caption: string;
  tone: "bad" | "warn";
  items: NegotiationItem[];
}) {
  const accent = tone === "bad" ? "var(--bad)" : "var(--warn)";
  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
        {title}
      </h2>
      <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
        {caption}
      </p>

      <div className="mt-3 space-y-2">
        {items.map((i) => (
          <div key={i.id} style={{ background: "var(--surface-2)", border: "1px solid var(--rule)", borderLeft: `3px solid ${accent}` }}>
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {i.name}
                </div>
                <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  {i.urgencyLabel}
                </div>

                {/* The specific, checkable evidence. Only shown when the analysis
                    actually recorded it — no filler. */}
                {i.observedDefect && (
                  <p className="mt-2 text-[12.5px]" style={{ color: "var(--text-primary)", lineHeight: 1.55 }}>
                    {i.observedDefect}
                  </p>
                )}

                {/* The purchaser's own words, quoted and attributed as theirs.
                    Never merged into the analysis's wording above. */}
                {i.buyerNote && (
                  <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
                    At the inspection: &ldquo;{i.buyerNote}&rdquo;
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <span>{i.area}</span>
                  <span>·</span>
                  <span>Condition {i.score}/10</span>
                  <span>·</span>
                  <span>
                    {i.confirmedOnSite
                      ? "Confirmed at inspection"
                      : (TIER_LABEL[i.confidenceTier] ?? i.evidenceSource)}
                  </span>
                  {i.photoRefs.length > 0 && (
                    <>
                      <span>·</span>
                      <span>
                        Listing photo{i.photoRefs.length === 1 ? "" : "s"} {i.photoRefs.join(", ")}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="mono whitespace-nowrap text-[13px]" style={{ color: "var(--text-primary)" }}>
                {i.costHigh > 0 ? range(i.costLow, i.costHigh) : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
