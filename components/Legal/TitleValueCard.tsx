"use client";

// ============================================================
// What the title does to the value.
//
// The valuation has always priced the tenure — a cross lease is valued on its
// share of the site and then discounted 5–10% (lib/scoring/cross-lease.ts); a
// unit title, leasehold or licence to occupy is valued against sales of its
// own kind — but none of it was on this tab, so the title read as though it
// made no difference to the money.
//
// Freehold is shown as FULL value, never as a premium. The land rate comes
// from sales of ordinary sections, nearly all of them freehold, so freehold is
// already what the number is; adding "+$X for freehold" would count it twice.
// The other titles are stated against it.
//
// Only THIS property's title is shown — a list of every tenure told a freehold
// buyer about licences to occupy. The card says the title and its effect; the
// breakdown says what it means, how it's valued and what can go wrong.
//
// Nothing here computes a value. It reads the one valuation the report already
// made (lib/scoring/property-value.ts) and says what the title did to it.
// ============================================================

import type { PropertyValue } from "@/lib/scoring/property-value";
import { explainCrossLeaseDiscount, MIN_DISCOUNT_PCT, MAX_DISCOUNT_PCT } from "@/lib/scoring/cross-lease";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { BlurredValue } from "@/components/report/Locked";

type Title = "freehold" | "cross_lease" | "unit_title" | "leasehold" | "licence_to_occupy" | "unknown";

/** What each title is, and what can go wrong with it — only this property's is shown. */
const ABOUT: Record<Title, { name: string; means: string; risks: string[] }> = {
  freehold: {
    name: "Freehold",
    means: "You own the land and everything on it outright. No ground rent, no body corporate, and nobody else's consent needed to change your own house.",
    risks: [],
  },
  cross_lease: {
    name: "Cross lease",
    means: "You own a share of the whole site together with the other flat owners, and lease your own flat back from all of them.",
    risks: [
      "Anything built that isn't on the flats plan — a deck, a conservatory, an extension — makes the title defective. Fixing it takes a new survey and every owner signing.",
      "Changing the footprint of your flat needs every other owner to agree.",
      "Shared driveways and shared ground are where disputes between owners start.",
      "Fewer buyers and some lenders are cautious of it, which is part of why it sells below freehold.",
    ],
  },
  unit_title: {
    name: "Unit title",
    means: "You own your unit, and a share of the common property that a body corporate runs on behalf of all the owners.",
    risks: [
      "Body corporate levies are paid on top of the mortgage, and a special levy can be raised for major repairs, such as weathertightness work.",
      "Decisions about the building are made by vote, not by you, and the body corporate rules limit what you can change.",
      "The long-term maintenance plan and the minutes show what's coming. An underfunded plan means levies to come.",
    ],
  },
  leasehold: {
    name: "Leasehold",
    means: "The building is yours, but the land under it belongs to someone else, and you pay them ground rent for it.",
    risks: [
      "Ground rent is reviewed on a set cycle, and reviews have moved by multiples, with nothing about the house changing.",
      "The value falls as the lease term runs down.",
      "Some banks won't lend on it, and others lend less.",
    ],
  },
  licence_to_occupy: {
    name: "Licence to occupy",
    means: "A contractual right to live there, most often in a retirement village. You don't own the land or the building.",
    risks: [
      "A deferred management fee is taken off what you get back when you leave.",
      "Any rise in value usually goes to the operator, not to you.",
      "What you get back, and when, is set by the occupation agreement, often not until the unit is relicensed.",
    ],
  },
  unknown: {
    name: "Title not found",
    means: "LINZ didn't return a title for this address, so the kind of ownership isn't known.",
    risks: ["If it turns out to be a cross lease, leasehold or unit title, the value and the risks change with it."],
  },
};

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{title}</div>
      <div className="text-[13px]" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

export function TitleValueCard({
  titleType,
  value,
  landAreaSqm,
  locked = false,
}: {
  titleType?: string | null;
  /** The report's one valuation — read, never recomputed. */
  value?: PropertyValue | null;
  landAreaSqm?: number | null;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const title = (titleType && titleType in ABOUT ? titleType : "unknown") as Title;
  const about = ABOUT[title];
  const xl = value?.crossLease;
  const shown = (n: number) => (locked ? <BlurredValue amount={5} label="Needs a paid plan">{money(n)}</BlurredValue> : money(n));

  // What the title did to the value — one figure for the card, the reasoning
  // for the breakdown.
  let effect: React.ReactNode;
  let valued: React.ReactNode;
  if (title === "freehold") {
    effect = <span style={{ color: "var(--good)" }}>Full value</span>;
    valued =
      "The land, from sales of nearby sections, plus the building on it. Those sections sell as freehold, so a freehold title is already priced in full. Nothing is added on top, because that would count it twice.";
  } else if (title === "cross_lease" && xl) {
    effect = (
      <span style={{ color: "var(--bad)" }}>
        −{shown(xl.deduction ?? 0)} <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>(−{xl.pct}%)</span>
      </span>
    );
    valued = (
      <>
        {value?.landAreaValuedSqm && landAreaSqm && value.landAreaValuedSqm < landAreaSqm && (
          <span className="block mb-1">
            Valued like a house, on this flat&apos;s share of the land: {value.landAreaValuedSqm.toLocaleString("en-NZ")} m² of the{" "}
            {landAreaSqm.toLocaleString("en-NZ")} m² site, not the whole section the listing quotes.
          </span>
        )}
        {explainCrossLeaseDiscount(xl)} The published range is {MIN_DISCOUNT_PCT}–{MAX_DISCOUNT_PCT}% below the equivalent freehold.
      </>
    );
  } else if (title === "cross_lease") {
    effect = <span style={{ color: "var(--text-muted)" }}>No discount sized</span>;
    valued =
      "The title's share of the land isn't published, so the site can't be divided between the flats. Valuing it as a house on the whole section would overstate it by far more than the discount, so it is valued against comparable sales per m² of floor instead, and no tenure discount is applied.";
  } else if (title === "unknown") {
    effect = <span style={{ color: "var(--text-muted)" }}>Not adjusted</span>;
    valued = "Valued as if freehold, and nothing is taken off for the title.";
  } else {
    effect = <span style={{ color: "var(--warn)" }}>Priced by its own market</span>;
    valued =
      "There's no section of your own to value, so it is valued against sales of the same kind of property per m² of floor area. The title is already in those prices, so nothing is added or taken off separately.";
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full text-left p-5 cursor-pointer">
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Title and value
        </div>
        <div className="flex items-baseline justify-between gap-3 mt-1 flex-wrap">
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{about.name}</span>
          <span className="mono text-[14px] font-bold">{effect}</span>
        </div>
        <div className="flex items-center gap-1 mt-2">
          <span className="text-xs" style={{ color: "var(--brand)" }}>{open ? "Hide detail" : "See breakdown"}</span>
          <ArrowRight size={11} style={{ color: "var(--brand)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-4 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
          <Section title="What it means">{about.means}</Section>
          <Section title="How it's valued">{valued}</Section>
          <Section title="Risks">
            {about.risks.length === 0 ? (
              "None from the kind of title itself. Anything registered against it, such as easements, covenants or caveats, is listed below."
            ) : (
              <ul className="space-y-1">
                {about.risks.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span style={{ color: "var(--warn)" }}>•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
