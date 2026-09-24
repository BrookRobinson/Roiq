"use client";

// ============================================================
// The seven steps behind one item's value, on the card that item sits on.
//
// The point of this panel is that a reader can disagree with a NUMBER rather
// than disbelieve a total. Every step shows the input it used and, where there
// is arithmetic, the arithmetic — so "$16,417" stops being an assertion and
// becomes a chain somebody can break at whichever link they think is wrong.
//
// Where a step is an assumption rather than a measurement, it says so in that
// step rather than in a footnote nobody reads.
// ============================================================

import type { RoofValuation } from "@/lib/scoring/roof-value";
import type { GenericItemValuation } from "@/lib/scoring/item-value";
import { mergeEvidence } from "@/lib/scoring/condition-evidence";

/**
 * Either shape. The roof measures its own area, so its step 5 carries real
 * geometry; every other item scales off a figure the report already holds and
 * its step 5 shows that scaling. Same seven questions either way, which is the
 * whole point — a reader should not have to learn a second card.
 */
export type AnyItemValuation = RoofValuation | GenericItemValuation;

const sizeOf = (v: AnyItemValuation) =>
  "area" in v
    ? { workings: v.area.workings, summary: `${v.area.roofM2} m²` }
    : { workings: v.size.workings, summary: v.size.summary };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

/**
 * `lead` is a step drawn BEFORE the seven — the card passes the photographs the
 * item was read from, so the reader sees the evidence before the arithmetic.
 */
export function ItemValuation({ v, lead, evidence = [] }: {
  v: AnyItemValuation;
  lead?: { title: string; body: React.ReactNode };
  /** What the photographs show that set the condition and the age. */
  evidence?: string[];
}) {
  // Defects first, in the warning colour; then the rest of what was seen. A
  // line the defect already says is not repeated.
  const merged = mergeEvidence(v.concerns, evidence);
  const o = lead ? 1 : 0;
  return (
    <div className="space-y-3">
      {lead && <Step n={1} title={lead.title}>{lead.body}</Step>}
      <Step n={1 + o} title="Material">
        <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
          {v.material.label}
        </div>
        {v.material.note && (
          <div className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {v.material.note}
          </div>
        )}
        <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
          Everything below is priced from this. A different material is a different number.
        </div>
      </Step>

      {/* The evidence the condition and the age rest on — wear AND signs of
          newness. It used to list defects only, so every sound item read
          "Nothing visibly wrong in the photographs", which says brand new. */}
      <Step n={2 + o} title="Visual evidence">
        <EvidenceList concerns={merged.concerns} evidence={merged.seen} />
      </Step>

      <Step n={3 + o} title="Estimated age">
        <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
          ~{v.age.chronologicalYears} years
          {v.age.effectiveYears !== v.age.chronologicalYears && (
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
              {" "}· presenting as {v.age.effectiveYears}
            </span>
          )}
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {v.age.basis}
        </div>
      </Step>

      <Step n={4 + o} title="Material end life">
        <LifeBar life={v.life} />
      </Step>

      <Step n={5 + o} title="Size">
        <Workings lines={sizeOf(v).workings} last={sizeOf(v).summary} />
      </Step>

      <Step n={6 + o} title="Cost to replace">
        <Workings lines={v.cost.workings} />
        {/* A zero line is not information. "Scaffold $0" sat on every
            foundation, driveway and kitchen in the report — you do not put
            scaffold round a footing, and printing the line to say so invites
            the reader to wonder whether we know that. Anything that costs
            nothing on this item simply isn't a line on this item. */}
        <div className="mt-2 space-y-0.5">
          {(
            [
              ["Materials", v.cost.materialsNZD],
              ["Labour", v.cost.labourNZD],
              ["Scaffold", v.cost.scaffoldNZD],
              ["Strip & disposal", v.cost.disposalNZD],
            ] as [string, number][]
          )
            .filter(([, amount]) => amount > 0)
            .map(([label, amount]) => (
              <Row key={label} label={label} amount={amount} />
            ))}
          <Row label="Total to replace" amount={v.cost.totalNZD} strong />
        </div>
        {/* The one thing on this panel nobody fetched. Saying so here beats a
            disclaimer at the foot of the report that nobody reaches. */}
        <div className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          Rates are industry-typical New Zealand ranges for 2026, not a quote. Get one before you
          budget on it.
        </div>
      </Step>

      <Step n={7 + o} title="What it's worth">
        <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {money(v.cost.totalNZD)} to replace × {Math.round(v.remainingFraction * 100)}% of its life
          left
        </div>
        <div className="mt-1.5 flex items-baseline gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Value today
            </div>
            <div className="mono text-lg font-bold" style={{ color: "var(--good)" }}>
              {money(v.valueNZD)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Life already used
            </div>
            <div className="mono text-lg font-bold" style={{ color: "var(--warn)" }}>
              {money(v.liabilityNZD)}
            </div>
          </div>
        </div>
        <div className="text-[12px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
          {v.summary}
        </div>
      </Step>
    </div>
  );
}

/** When the inputs weren't there. Says which one, because that is actionable. */
export function ItemValuationWithheld({ reason }: { reason: string }) {
  return (
    <div
      className="rounded-xl p-3 text-[13px]"
      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
    >
      <div className="font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
        Not valued
      </div>
      {reason}
    </div>
  );
}

/** Defects first in the warning colour, then the rest of what was seen. */
export function EvidenceList({ concerns = [], evidence }: { concerns?: string[]; evidence: string[] }) {
  if (concerns.length === 0 && evidence.length === 0) {
    return (
      <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>
        This report holds no recorded observations for this item. Its condition and age come from the
        assessment below.
      </div>
    );
  }
  return (
    <ul className="space-y-0.5">
      {concerns.map((c, i) => (
        <li key={`c${i}`} className="text-[13px]" style={{ color: "var(--warn)" }}>— {c}</li>
      ))}
      {evidence.map((e, i) => (
        <li key={`e${i}`} className="text-[13px]" style={{ color: "var(--text-secondary)" }}>— {e}</li>
      ))}
    </ul>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="mono flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ background: "var(--accent-wash)", color: "var(--accent-text)" }}
          aria-hidden="true"
        >
          {n}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </span>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

/**
 * The life bar. Fills on EFFECTIVE age, so a roof that presents badly reads as
 * further through its life than the calendar says — which is the whole reason
 * the condition is read at all.
 */
function LifeBar({ life }: { life: AnyItemValuation["life"] }) {
  const overdue = life.yearsRemaining <= 0;
  const colour = overdue ? "var(--warn)" : life.usedFraction > 0.75 ? "var(--warn)" : "var(--good)";
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <div
          className="flex-1 h-3 rounded-full overflow-hidden"
          style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}
        >
          <div
            className="h-full transition-all"
            style={{ width: `${Math.round(life.usedFraction * 100)}%`, background: colour }}
          />
        </div>
        <span className="mono text-[13px] font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
          {life.expectedYears} years
        </span>
      </div>
      <div className="text-[13px] mt-1 font-medium" style={{ color: colour }}>
        {life.label}
      </div>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {life.lowYears}–{life.highYears} years is the range this material lasts when it is done
        well.
      </div>
    </div>
  );
}

export function Workings({ lines, last }: { lines: string[]; last?: string }) {
  return (
    <div className="space-y-0.5">
      {lines.map((l, i) => (
        <div key={i} className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          {l}
        </div>
      ))}
      {last && (
        <div className="mono text-[13px] font-semibold pt-0.5" style={{ color: "var(--text-primary)" }}>
          {last}
        </div>
      )}
    </div>
  );
}

export function Row({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div
      className="flex items-center justify-between text-[13px]"
      style={
        strong
          ? { borderTop: "1px solid var(--border)", paddingTop: 4, marginTop: 2 }
          : undefined
      }
    >
      <span style={{ color: strong ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: strong ? 600 : 400 }}>
        {label}
      </span>
      <span className="mono" style={{ color: "var(--text-primary)", fontWeight: strong ? 700 : 400 }}>
        {money(amount)}
      </span>
    </div>
  );
}
