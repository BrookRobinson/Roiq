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
// Nothing here computes a value. It reads the one valuation the report already
// made (lib/scoring/property-value.ts) and says what the title did to it.
// ============================================================

import type { PropertyValue } from "@/lib/scoring/property-value";
import { explainCrossLeaseDiscount, MIN_DISCOUNT_PCT, MAX_DISCOUNT_PCT } from "@/lib/scoring/cross-lease";
import { BlurredValue } from "@/components/report/Locked";

type Title = "freehold" | "cross_lease" | "unit_title" | "leasehold" | "licence_to_occupy" | "unknown";

/** Every title, best-held first — the order is the ranking. */
const TITLES: { id: Title; name: string; own: string; valued: string; effect: string; tone: "good" | "warn" | "bad" | "muted" }[] = [
  {
    id: "freehold",
    name: "Freehold",
    own: "The land and everything on it, outright.",
    valued: "The land, from sales of nearby sections, plus the building on it.",
    effect: "Full value",
    tone: "good",
  },
  {
    id: "unit_title",
    name: "Unit title",
    own: "Your unit, plus a share of the common property run by a body corporate.",
    valued: "Against sales of other unit-title properties of the same type, per m² of floor.",
    effect: "Its own market",
    tone: "warn",
  },
  {
    id: "cross_lease",
    name: "Cross lease",
    own: "A share of the land with the other flat owners, and a lease of your flat from all of them.",
    valued: `Your share of the land plus your building, then ${MIN_DISCOUNT_PCT}–${MAX_DISCOUNT_PCT}% off, more with more owners and more sharing.`,
    effect: `−${MIN_DISCOUNT_PCT} to −${MAX_DISCOUNT_PCT}%`,
    tone: "warn",
  },
  {
    id: "leasehold",
    name: "Leasehold",
    own: "The building, on land someone else owns. You pay ground rent, and it is reviewed.",
    valued: "Against sales of other leasehold properties of the same type, per m² of floor.",
    effect: "Well below freehold",
    tone: "bad",
  },
  {
    id: "licence_to_occupy",
    name: "Licence to occupy",
    own: "A right to live there, usually in a retirement village. No land and no building.",
    valued: "Against sales of the same kind of licence. What you get back on leaving is set by the contract, usually less a management fee.",
    effect: "Not ownership",
    tone: "bad",
  },
];

const TONE: Record<"good" | "warn" | "bad" | "muted", string> = {
  good: "var(--good)",
  warn: "var(--warn)",
  bad: "var(--bad)",
  muted: "var(--text-muted)",
};

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

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
  const title = (TITLES.some((t) => t.id === titleType) ? titleType : "unknown") as Title;
  const xl = value?.crossLease;
  const shown = (n: number) => (locked ? <BlurredValue amount={5} label="Needs a paid plan">{money(n)}</BlurredValue> : money(n));

  // This property, in one line and a reason.
  let head: React.ReactNode;
  let body: React.ReactNode;
  if (title === "freehold") {
    head = <>Freehold: full value, nothing taken off</>;
    body =
      "Nearby sections sell as freehold, and that is what the land value is built from, so a freehold title is already priced in full. It isn't added on top, because that would count it twice.";
  } else if (title === "cross_lease" && xl) {
    head = (
      <>
        Cross lease: <span style={{ color: "var(--bad)" }}>−{shown(xl.deduction ?? 0)}</span>{" "}
        <span className="mono text-[13px]" style={{ color: "var(--text-muted)" }}>(−{xl.pct}%)</span>
      </>
    );
    body = (
      <>
        {value?.landAreaValuedSqm && landAreaSqm && value.landAreaValuedSqm < landAreaSqm && (
          <span className="block mb-1">
            The land is valued on this flat&apos;s share: {value.landAreaValuedSqm.toLocaleString("en-NZ")} m² of the{" "}
            {landAreaSqm.toLocaleString("en-NZ")} m² site,
            not the whole section the listing quotes.
          </span>
        )}
        {explainCrossLeaseDiscount(xl)}
      </>
    );
  } else if (title === "cross_lease") {
    head = <>Cross lease: no discount could be sized</>;
    body =
      "The title's share of the land isn't published, so the site can't be divided between the flats. Valuing it as a house on the whole section would overstate it by far more than the discount, so it is valued against comparable sales per m² of floor instead, and no tenure discount is applied.";
  } else if (title === "unit_title" || title === "leasehold" || title === "licence_to_occupy") {
    const t = TITLES.find((x) => x.id === title)!;
    head = <>{t.name}: priced by its own market</>;
    body = `There's no section of your own to value, so it is valued against sales of the same kind of property per m² of floor area. The title is already in those prices, so nothing is added or taken off separately.${
      title === "leasehold" ? " The ground-rent review terms matter most: a rent reset can move the value sharply, and only the lease says when." : ""
    }${title === "unit_title" ? " Body corporate levies and any planned maintenance come out of your pocket on top." : ""}`;
  } else {
    head = <>Title not found: nothing adjusted</>;
    body = "LINZ didn't return a title for this address, so the valuation is made as if freehold and nothing is taken off. A cross lease or leasehold title would bring it down.";
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        What the title does to the value
      </div>
      <div className="font-semibold mt-1" style={{ color: "var(--text-primary)" }}>{head}</div>
      <div className="text-[13px] mt-1" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{body}</div>

      <div className="mt-4 pt-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          How each title weighs, strongest first
        </div>
        {TITLES.map((t) => {
          const current = t.id === title;
          return (
            <div
              key={t.id}
              className="rounded-lg px-3 py-2.5"
              style={{
                background: current ? "var(--accent-wash)" : "var(--surface-2)",
                border: `1px solid ${current ? "var(--accent-text)" : "var(--border)"}`,
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t.name}
                  {current && <span className="ml-2 text-[11px] font-medium" style={{ color: "var(--accent-text)" }}>this property</span>}
                </span>
                <span className="mono text-[12px] font-semibold whitespace-nowrap" style={{ color: TONE[t.tone] }}>{t.effect}</span>
              </div>
              <div className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{t.own}</div>
              <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Valued: {t.valued}</div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        The cross-lease range is the published 5–10% below equivalent freehold. The others are priced by comparable
        sales of their own kind, which are estimates until a sold-sales feed is connected.
      </p>
    </div>
  );
}
