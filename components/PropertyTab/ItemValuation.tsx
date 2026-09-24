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

export function ItemValuation({ v }: { v: AnyItemValuation }) {
  return (
    <div className="space-y-3">
      <Step n={1} title="Material">
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

      <Step n={2} title="Visual concerns">
        {v.concerns.length > 0 ? (
          <ul className="space-y-0.5">
            {v.concerns.map((c, i) => (
              <li key={i} className="text-[13px]" style={{ color: "var(--warn)" }}>
                — {c}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Nothing visibly wrong in the photographs.
          </div>
        )}
      </Step>

      <Step n={3} title="Estimated age">
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

      <Step n={4} title="Material end life">
        <LifeBar life={v.life} />
      </Step>

      <Step n={5} title="Size">
        <Workings lines={sizeOf(v).workings} last={sizeOf(v).summary} />
      </Step>

      <Step n={6} title="Cost to replace">
        <Workings lines={v.cost.workings} />
        <div className="mt-2 space-y-0.5">
          <Row label="Materials" amount={v.cost.materialsNZD} />
          <Row label="Labour" amount={v.cost.labourNZD} />
          <Row label="Scaffold" amount={v.cost.scaffoldNZD} />
          <Row label="Strip &amp; disposal" amount={v.cost.disposalNZD} />
          <Row label="Total to replace" amount={v.cost.totalNZD} strong />
        </div>
        {/* The one thing on this panel nobody fetched. Saying so here beats a
            disclaimer at the foot of the report that nobody reaches. */}
        <div className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          Rates are industry-typical New Zealand ranges for 2026, not a quote. Get one before you
          budget on it.
        </div>
      </Step>

      <Step n={7} title="What it's worth">
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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
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

function Workings({ lines, last }: { lines: string[]; last?: string }) {
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

function Row({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
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
