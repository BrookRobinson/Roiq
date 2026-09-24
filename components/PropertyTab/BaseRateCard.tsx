"use client";

// ============================================================
// The house before its fittings: framing, linings, wiring, plumbing rough-in.
//
// It is the one part of the building value no item card explains, because
// none of it can be photographed — and it is often the biggest single line in
// the building. So it gets the same treatment as every item: each input shown,
// and the arithmetic shown, so a reader can disagree with a step rather than
// disbelieve a total.
// ============================================================

import type { ShellWorkings } from "@/lib/scoring/improvement-values";
import { Step, Workings } from "./ItemValuation";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

export function BaseRateCard({ shell }: { shell: ShellWorkings }) {
  if (shell.floorAreaSqm <= 0) {
    return (
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="font-semibold" style={{ color: "var(--text-primary)" }}>Base rate of the house</div>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          The listing gives no floor area, so the structure can&apos;t be priced. Nothing is claimed rather
          than guessing a size.
        </p>
      </div>
    );
  }

  // One decimal, so the printed sum is the sum: "× 32%" over a 31.9% factor
  // came out $242 off the value beside it.
  const pct = Math.round(shell.remainingFraction * 1000) / 10;
  const used = Math.min(1, shell.age.effectiveYears / shell.lifeYears);
  const years = Math.round(shell.age.chronologicalYears);
  const presents = Math.round(shell.age.effectiveYears);

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Base rate of the house
          </div>
          <div className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
            Structure &amp; services
          </div>
          <p className="text-[13px] mt-1 max-w-xl" style={{ color: "var(--text-secondary)" }}>
            The house before its fittings. It can&apos;t be photographed, so it isn&apos;t an item below. It is
            priced by floor area and depreciated by age.
          </p>
        </div>
        <div className="sm:text-right">
          <div className="mono text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{money(shell.value)}</div>
          <div className="mono text-[12px]" style={{ color: "var(--text-muted)" }}>
            of {money(shell.costNew)} to build new
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
        <Step n={1} title="What it covers">
          <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Framing, wall and ceiling linings, wiring, plumbing rough-in, consents, preliminaries and the
            builder&apos;s margin. The kitchen, bathrooms, roof, cladding, windows and the rest are valued
            on their own cards below and aren&apos;t counted here.
          </div>
        </Step>

        <Step n={2} title="Base rate">
          <Workings
            lines={[
              `${money(shell.ratePerSqm)} per m² of floor, a typical rate for a New Zealand timber-framed shell. It is an industry range, not a quote.`,
              `${shell.floorAreaSqm} m² of floor area, from the listing.`,
            ]}
            last={`${money(shell.ratePerSqm)} × ${shell.floorAreaSqm} m² = ${money(shell.costNew)} to build new`}
          />
        </Step>

        <Step n={3} title="Age">
          {shell.buildYear ? (
            <>
              <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                Built c.{shell.buildYear}, so ~{years} years
                {presents !== years && (
                  <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · presenting as {presents}</span>
                )}
              </div>
              <div className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {shell.blendedCondition != null
                  ? `Nobody can see the frame or the wiring, so the age is moved by how the rest of the house presents: the components average ${shell.blendedCondition}/10. A house whose visible parts are well kept has usually been looked after behind the linings too.`
                  : shell.age.basis}
              </div>
            </>
          ) : (
            <div className="text-[13px]" style={{ color: "var(--warn)" }}>
              No build year is known, so the structure is treated as new. That will overstate it; treat the
              figure as a ceiling.
            </div>
          )}
        </Step>

        <Step n={4} title="Life">
          <div className="flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full"
              style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}
            >
              <div className="h-full" style={{ width: `${Math.round(used * 100)}%`, background: "var(--warn)" }} />
            </div>
            <span className="mono text-[13px] font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
              {shell.lifeYears} years
            </span>
          </div>
          <div className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
            A timber-framed shell has an economic life of about {shell.lifeYears} years
            {shell.buildYear ? `, and this one is about ${Math.round(used * 100)}% of the way through it` : ""}.
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: shell.atResidual ? "var(--text-primary)" : "var(--text-muted)" }}>
            {shell.atResidual
              ? `It is past the point where age takes any more off. It never falls below ${Math.round(shell.residual * 100)}% of its cost new, because a frame that is still holding the house up is not worth nothing.`
              : `It never falls below ${Math.round(shell.residual * 100)}% of its cost new, because a frame that is still holding the house up is not worth nothing.`}
          </div>
        </Step>

        <Step n={5} title="Value">
          <Workings
            lines={[`${pct}% of its life's value is left${shell.atResidual ? " (the floor)" : ""}.`]}
            last={`${money(shell.costNew)} × ${pct}% = ${money(shell.value)}`}
          />
        </Step>
      </div>
    </div>
  );
}
