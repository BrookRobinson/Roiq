// ============================================================
// The renovation plan — built once, used everywhere.
//
// Lifted out of RealReportView so the map can build a property's plan exactly
// as the Renovations tab does: what each line is, what it costs at the option
// chosen, what is ticked for purchase and what falls due during the hold.
// A second copy of any of this is how the map came to count different work
// from the report it was built from. Pure — no React.
// ============================================================

import { urgencyScoreToYears } from "@/lib/hold-period/years";
import { urgencyColor, urgencyLabel } from "@/lib/property-tab/types";
import type { SubItem, ExtraDwelling } from "@/lib/property-tab/types";
import type { StoredReport } from "@/lib/report-store";
import { labourMultiplierFor } from "@/lib/labour-rates";
import { actionFor, actionCost } from "@/lib/scoring/depreciation";
import { valueImprovementItems, showerTypeOf, floorTypeOf } from "@/lib/scoring/improvement-values";
import { assessHealthyHomes, HH_RENO_KEYS } from "@/lib/scoring/healthy-homes";
import { dwellingComplianceWork } from "@/lib/scoring/extra-dwelling-value";
import { costThreeTier, tierTotal, scaleTier, isScalableKind } from "@/lib/reno-costing/three-tier";
import type { ThreeTierCost, Tier, LabourMode } from "@/lib/reno-costing/three-tier";
import { tierBandFraction, type Persona, type Inspection } from "@/lib/scoring/model";
import { INSPECTION_META, ITEM_BY_ID } from "@/lib/scoring/catalog";

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

export const inspOf = (id: string): Inspection | undefined => ITEM_BY_ID[id]?.inspection;
export const isImprovement = (s: SubItem) => inspOf(s.id) === "improvements";

// Indicative weekly rent uplift (investor only) when a flagged item is renovated.
export const RENT_UPLIFT: Record<string, number> = {
  kit_cabinetry: 35, kit_appliances: 18, kit_benchtop: 12, kit_flooring: 8,
  bath_shower: 25, bath_vanity: 10, bath_flooring: 6,
  liv_heating: 25, liv_insulation: 22, liv_flooring: 15,
  bath_ventilation: 10, bath_hotwater: 10, bed_heating: 12,
};
export const rentUplift = (id: string): number => RENT_UPLIFT[id] ?? 0;
// Renovation selection state per line:
//   included=false → removed from the budget
//   tier → "patch" | "budget" | "premium" (default "budget")
//   labour → "diy" (materials only) | "tradie" (adds labour); default per tier
export interface RenoToggle { included: boolean; tier: Tier; labour: LabourMode; affectedPct?: number }

/** Fraction (0–1) of the property this line affects — only AREA/LINEAR items scale. */
export const lineFrac = (c: ThreeTierCost | undefined, t?: RenoToggle): number =>
  c && isScalableKind(c.kind) ? (t?.affectedPct ?? 100) / 100 : 1;
export const lineMid = (l: { low: number; high: number }) => (l.low + l.high) / 2;

// Effective cost for a line: chosen tier total under the chosen labour mode.
export const lineCost = (l: { costing?: ThreeTierCost; low: number; high: number }, t?: RenoToggle): number => {
  const c = l.costing;
  if (!c) return lineMid(l);
  const tier: Tier = t?.tier ?? "budget";
  const labour: LabourMode = t?.labour ?? c[tier].defaultLabour;
  return tierTotal(scaleTier(c[tier], lineFrac(c, t)), labour);
};

/** Is a reno line in the plan? Explicit toggle wins; otherwise its auto default. */
/**
 * Is this line in the plan?
 *
 * An explicit tick or untick ALWAYS wins — this only sets the default.
 *
 * The default now includes anything that falls due inside the hold period, and
 * that is the fix for a figure which used to be completely deaf to the slider:
 * the demo's renovation total read $3,859 at a three-year hold and $3,859 at a
 * fifteen-year one, with a 4/10 roof and an $18,000–$28,000 range sitting
 * outside the plan at every setting. Work that reaches end of life while you own
 * the house is money you will spend, whether or not anybody ticked a box —
 * and if you don't spend it you sell a house with a dead roof, which costs you
 * at the other end instead. Either way it belongs in the walk-away.
 *
 * `autoInclude` stays for what is urgent or legally required NOW, since that is
 * true at any hold length.
 */
export const renoIncluded = (
  l: { key: string; autoInclude: boolean; stopGap?: boolean; wholeRoom?: boolean; optIn?: boolean },
  toggles: Record<string, RenoToggle>,
  dueWithinHold = false
): boolean =>
  toggles[l.key]?.included ??
  // A whole-room refit REPLACES the room's individual lines, which are already
  // in by default — letting it in on the hold too put the same kitchen in the
  // plan twice. It's the reader's call, so it only ever comes in by a tick.
  // Same for `optIn` lines — making an extra dwelling or pool legally rentable
  // only matters if you mean to let it, so it's never assumed.
  (l.autoInclude || (dueWithinHold && !l.stopGap && !l.wholeRoom && !l.optIn));

/**
 * Work due within about a year is money you find at settlement; anything later
 * you pay for out of income while you own the place. The split matters because
 * "Total money needed to buy" is a real question with a real answer, and once
 * the plan started following the hold slider it was answering it with the price
 * of a roof due in year seven.
 */
export const UPFRONT_RENO_YEARS = 1;

export type PlanFlags = { key: string; urgencyYears: number; autoInclude: boolean; stopGap?: boolean; wholeRoom?: boolean; optIn?: boolean };
export type PlanLine = PlanFlags & { costing?: ThreeTierCost; low: number; high: number };

/**
 * TWO halves of the plan, and every total reads them the same way.
 *
 * At purchase: the ticked lines — ticked by the reader, or pre-ticked because
 * the work is needed the day you buy or before you can rent it out (see
 * `autoInclude`). Counted whatever the hold: you've said you'll do it.
 *
 * During the hold: not ticked, but it reaches end of life while you own the
 * place and nobody unticked it. A 30%-condition roof may well last a few more
 * years, so it isn't ticked — but on a ten-year hold it is still money you
 * will spend, so it is still counted.
 */
export const inAtPurchase = (l: PlanFlags, toggles: Record<string, RenoToggle>) => renoIncluded(l, toggles, false);
export const inDuringHold = (l: PlanFlags, toggles: Record<string, RenoToggle>, withinHold: (years: number) => boolean) =>
  !inAtPurchase(l, toggles) && withinHold(l.urgencyYears) && renoIncluded(l, toggles, true);

export function renoSplit(lines: PlanLine[], toggles: Record<string, RenoToggle>, withinHold: (years: number) => boolean) {
  let atPurchase = 0;
  let duringHold = 0;
  for (const l of lines) {
    if (inAtPurchase(l, toggles)) atPurchase += lineCost(l, toggles[l.key]);
    else if (inDuringHold(l, toggles, withinHold)) duringHold += lineCost(l, toggles[l.key]);
  }
  return { atPurchase, duringHold };
}

/** Everything in the plan: what's ticked, plus what falls due inside the hold. */
export function selectedRenoCost(lines: PlanLine[], toggles: Record<string, RenoToggle>, withinHold: (years: number) => boolean): number {
  const { atPurchase, duringHold } = renoSplit(lines, toggles, withinHold);
  return atPurchase + duringHold;
}

/**
 * What the ticked renovations add to what the property is WORTH — the app's own
 * valuation model, not a market resale promise.
 *
 * `valueGap` is `valuePotential − valueNow` out of `improvement-values.ts`,
 * where potential is **modern spec at as-new condition**. That is what a genuine
 * replacement gets you, so only Replace Budget and Replace High End count here.
 *
 * A PATCH contributes nothing, deliberately. Re-grouting a shower or repainting
 * cabinet doors moves neither the spec tier nor the condition to as-new, and
 * there is no principled figure in the model for a partial restoration — picking
 * one would be the invented-number habit in a new place. Zero errs toward the
 * conservative side, which is the right direction when over-capitalising is the
 * usual way people lose money on a renovation.
 */
export function selectedRenoUplift(
  lines: { key: string; valueGap?: number; urgencyYears: number; autoInclude: boolean; stopGap?: boolean; wholeRoom?: boolean; optIn?: boolean }[],
  toggles: Record<string, RenoToggle>,
  withinHold: (years: number) => boolean
): number {
  return lines
    .filter((l) => inAtPurchase(l, toggles) || inDuringHold(l, toggles, withinHold))
    .filter((l) => (toggles[l.key]?.tier ?? "budget") !== "patch")
    .reduce((sum, l) => sum + (l.valueGap ?? 0), 0);
}

// ── Renovations ──────────────────────────────────────────────────────────────
export interface RenoLine {
  key: string;
  /** A repair on an item past its life: listed as an option, never pre-ticked — the replacement is. */
  stopGap?: boolean;
  /** The kind of job, where the line knows it (a single repair or maintenance job). */
  work?: "repair" | "maintain";
  name: string;
  detail: string;
  badge?: string; // inspection label for remediation items
  low: number;
  high: number;
  urgencyYears: number;
  detailColor: string;
  uplift: number;
  notes?: string;
  category?: string; // improvements category (e.g. "Bathroom", "Kitchen") — drives the visualiser
  photoRefs?: number[]; // listing photo numbers for this item's room
  costing?: ThreeTierCost; // Patch Up / Replace Budget / Replace High End
  autoInclude: boolean; // pre-ticked into the plan (score ≤30% / flagged remedy)
  wholeRoom?: boolean; // a full strip-out and rebuild — never recommended as a patch
  optIn?: boolean; // only ever in the plan by the reader's tick, whatever the hold
  valueGap?: number; // renovation upside — value reclaimed if brought to modern & as-new
  observedDefect?: string; // what's visible in THIS property's photos — keeps the plan specific
  scopeHint?: string; // real scope for compliance/paperwork lines, which have no costing recipe
  legal?: boolean; // carries a Healthy Homes legal obligation (investor)
  nonExisting?: boolean; // the feature is deteriorated / effectively absent
  inferred?: boolean; // not established either way — shown unticked, never recommended
  /** How a single-price line's figure was reached, step by step — shown behind a toggle. */
  working?: string[];
}

// Unified renovation list: Improvement replacement costs + Location/Land/Legal
// remediation line items, both obeying the hold-period rule.
export function buildRenoLines(subItems: SubItem[], listing: StoredReport["listing"], persona: Persona, extraDwellings: ExtraDwelling[] = [], hhAssessed?: { standard: string; status: "met" | "not_visible" | "absent"; note?: string }[]): RenoLine[] {
  const lines: RenoLine[] = [];
  // Which Healthy Homes standards we have established are NOT met. Only ever
  // consulted for the pre-tick — see the autoInclude below.
  const legallyRequired = new Set(
    assessHealthyHomes(subItems, listing.buildYear, hhAssessed)
      .filter((h) => h.compliant === false && h.renoKey)
      .map((h) => h.renoKey)
  );
  const ctx = {
    floorSqm: listing.floorAreaSqm ?? null,
    bedrooms: listing.bedrooms ?? null,
  };
  // Per-item building values → replacement-cost fallback + renovation upside (value gap).
  const valuation = valueImprovementItems({
    subItems,
    floorAreaSqm: listing.floorAreaSqm,
    bathrooms: listing.bathrooms,
    bedrooms: listing.bedrooms,
    buildYear: listing.buildYear,
    // Same labour and roof inputs as the cards, so an action costs the same
    // here as it does in the item's Action step.
    labourMultiplier: labourMultiplierFor(listing),
    roof: { footprintM2: listing.siteLayout?.mainBuildingAreaSqm ?? null },
  });
  const valueById = new Map(valuation.items.map((v) => [v.id, v]));

  for (const s of subItems) {
    // The work the item needs NOW. A full replacement ticks the item's own
    // replacement line below; anything smaller is its own line. Either way it
    // goes into the plan ticked, and the buyer unticks what they won't do.
    const urgent = isImprovement(s) ? actionFor(s) : null;
    // Every assessed, cost-bearing improvement item is a renovation candidate — the
    // buyer can tick it to replace it. Auto-ticked into the plan when it scores ≤30%.
    const v = valueById.get(s.id);
    if (isImprovement(s) && (s.estimatedReplacementCost || v)) {
      const col = urgencyColor(s.score);
      const category = ITEM_BY_ID[s.id]?.category;
      // Replacement cost: AI estimate if given, else derive a band from the value RCN.
      const low = s.estimatedReplacementCost?.low ?? Math.round((v?.rcnNew ?? 0) * 0.8);
      const high = s.estimatedReplacementCost?.high ?? Math.round((v?.rcnNew ?? 0) * 1.25);
      // Score fraction (persona-independent): tier band position, or raw condition.
      const frac = s.specTier ? tierBandFraction(s.specTier, s.score ?? 1) : (s.score ?? 6) / 10;
      const dueYears = v ? Math.max(0, Math.round(v.yearsLeft)) : urgencyScoreToYears(s.score);
      lines.push({
        key: s.id,
        name: s.name,
        // The condition word, then the life left on the same reading the plan
        // dates it by. "Fair — plan replacement within 5–7 years" was the
        // score's guess, and said it about a foundation with 67 years left.
        detail: v
          ? `${s.urgencyLabel.split(" — ")[0]} · ${
              v.yearsLeft <= 0 ? "past the end of its life" : `about ${Math.round(v.yearsLeft)} ${Math.round(v.yearsLeft) === 1 ? "year" : "years"} of life left`
            }`
          : s.urgencyLabel,
        low,
        high,
        // When it is due comes from the item's own life — the same years-left
        // its card shows — and only falls back to the condition score for an
        // item the valuation couldn't price.
        urgencyYears: dueYears,
        detailColor: col === "red" ? "var(--bad)" : col === "amber" ? "var(--warn)" : "var(--good)",
        uplift: rentUplift(s.id),
        notes: s.estimatedReplacementCost?.notes || undefined,
        category,
        photoRefs: s.photoReferences,
        costing: costThreeTier({ id: s.id, name: s.name, category, ...ctx, fallback: { low, high }, variant: s.id === "bath_shower" ? showerTypeOf(s) : s.id === "bath_flooring" ? floorTypeOf(s) : null }),
        // Pre-ticked only when it's needed the day you buy or before you can
        // rent it out: its action is a replacement now, it has a year or less
        // of life left, or it's a Healthy Homes standard ESTABLISHED to fail
        // (a legal obligation before tenanting, so the default is ticked).
        //
        // NOT on condition alone. It used to tick anything rated in the bottom
        // 30%, but a worn roof at 30% may last several more years — that's work
        // DURING the hold, counted in the plan by its year, not ticked.
        //
        // `=== false` on purpose in legallyRequired: unknown is not a failure.
        autoInclude: legallyRequired.has(s.id) || urgent?.scope === "replace" || (s.score !== null && dueYears <= UPFRONT_RENO_YEARS),
        valueGap: v?.valueGap,
        observedDefect: s.observedDefect,
        legal: HH_RENO_KEYS.has(s.id),
        nonExisting: s.specTier === "deteriorated",
      });
    }
    if (urgent && urgent.scope !== "replace") {
      const v = valueById.get(s.id);
      // A per-bathroom item carries its own figure: the work is in one
      // bathroom, and share × every bathroom's replacement would overcharge it.
      const cost = v?.actionCostNZD ?? actionCost(v?.replacementTotal ?? 0, urgent);
      if (cost > 0) {
        const category = ITEM_BY_ID[s.id]?.category;
        const low = Math.round(cost * 0.85);
        const high = Math.round(cost * 1.15);
        // How the figure was reached, in the order a reader would check it:
        // the job, what share of the item it is, of what, and the range.
        const pct = (x: number) => `${Math.round(x * 100)}%`;
        const shareWhy =
          urgent.basis === "recorded"
            ? `The analysis sized this job at ${pct(urgent.share)} of replacing the whole ${s.name.toLowerCase()}, from what the photos show.`
            : `Sized from the condition: at ${s.score}/10 the job is ${pct(urgent.share)} of replacing the whole ${s.name.toLowerCase()}.`;
        const roomsWithWork = (v?.byRoom ?? []).filter((p) => p.actionCostNZD > 0);
        const working = [
          `The job: ${urgent.work.replace(/[.]+$/, "")}.`,
          shareWhy,
          ...(roomsWithWork.length > 0
            ? roomsWithWork.map((p) => `In the ${p.room.toLowerCase()}: ${pct(urgent.share)} × ${fmt(p.replacementTotal)} to replace it there = ${fmt(p.actionCostNZD)}. The other rooms need nothing now.`)
            : [`${pct(urgent.share)} × ${fmt(v?.replacementTotal ?? 0)} to replace the whole ${s.name.toLowerCase()} = ${fmt(cost)}.`]),
          `The replacement figure is the item's own cost to replace on this property — materials, labour at this region's rate, disposal and scaffold where the job needs it — the same one on its Improvements card.`,
          `Shown as ${fmt(low)}–${fmt(high)}, 15% either side, because a quote for a small job moves with the tradesperson. The plan counts the middle, ${fmt(cost)}, which is also what comes off the item's value.`,
        ];
        lines.push({
          key: `${s.id}_act`,
          working,
          name: urgent.work,
          detail: `${urgent.scope === "maintenance" ? "Maintenance" : "Repair"} · ${s.name}`,
          work: urgent.scope === "maintenance" ? "maintain" : "repair",
          badge: v?.pastLife ? "Stop-gap" : "Needs doing now",
          low,
          high,
          urgencyYears: 0,
          detailColor: "var(--bad)",
          uplift: 0,
          notes: undefined,
          category,
          photoRefs: s.photoReferences,
          observedDefect: s.observedDefect,
          scopeHint: urgent.work,
          // No three-tier costing: this is ONE known job at one price — the
          // same figure the card's Action step shows and the value loses. Run
          // through the tier engine it came back as a $9,753 re-clad for a
          // $944 board repair.
          // Past its life, the replacement is ticked instead; paying for both
          // would put the same roof in the plan twice.
          autoInclude: !v?.pastLife,
          stopGap: !!v?.pastLife,
        });
      }
    }
    // Legal / due-diligence remedies (e.g. a LIM report, title checks) are not
    // renovations — keep them out of the reno tab's Patch/Replace cost tiers.
    if (s.remediation && ITEM_BY_ID[s.id]?.inspection !== "legal") {
      const insp = ITEM_BY_ID[s.id]?.inspection;
      lines.push({
        key: s.id + "_rem",
        name: s.remediation.renovationLineItem,
        detail: s.remediation.description,
        badge: insp ? INSPECTION_META[insp].label : undefined,
        low: s.remediation.low,
        high: s.remediation.high,
        urgencyYears: s.remediation.urgencyYears,
        // No photo defect here: the parent item's finding is the WHY, the
        // remediation description is the WORK.
        observedDefect: s.finding,
        scopeHint: s.remediation.description,
        detailColor: "var(--brand)",
        uplift: 0,
        notes: undefined,
        costing: costThreeTier({ id: s.id + "_rem", name: s.remediation.renovationLineItem, ...ctx, fallback: { low: s.remediation.low, high: s.remediation.high } }),
        autoInclude: true, // a specifically flagged remedy — pre-ticked
      });
    }
  }

  // Extra dwelling compliance — consent + Healthy Homes to make it rentable.
  // Opt-in (never auto-ticked): it only matters if you intend to let it.
  for (const d of extraDwellings) {
    const work = dwellingComplianceWork(d);
    if (!work.needed) continue;
    lines.push({
      key: `${d.id}_compliance`,
      name: d.consentStatus === "unconsented" ? `${d.type} — consent & compliance` : `${d.type} — compliance`,
      detail: `Make it legally rentable: ${work.scope.join(", ")}`,
      badge: "Extra dwelling",
      low: work.low,
      high: work.high,
      urgencyYears: 0,
      detailColor: "var(--warn)",
      uplift: 0,
      notes: undefined,
      costing: costThreeTier({ id: `${d.id}_compliance`, name: "Extra dwelling compliance", ...ctx, fallback: { low: work.low, high: work.high } }),
      autoInclude: false,
      optIn: true,
      // Paperwork, not a visible defect: the WHY is the missing paperwork, the
      // WORK is the scope — the generic costing text would say "full replacement".
      observedDefect: d.consentStatus === "unconsented"
        ? `This structure is recorded as unconsented, so it can't be legally rented as it stands.`
        : `It doesn't meet every standard a rented dwelling must, so it can't be legally rented as it stands.`,
      scopeHint: work.scope.join(", "),
      legal: true,
      nonExisting: true,
    });
  }

  // Healthy Homes draught-stopping — investor only, no equivalent quality item.
  //
  // It is derived from the BUILD ERA and nothing else: no photograph shows a
  // draught, and nobody has stood in the house. So it must not be stated as a
  // finding and must not tick itself into the plan. It was saying "Below the
  // draught-stopping standard — gaps/holes to seal" and pre-selecting $1,600 of
  // work on a house whose own listing advertises new double glazing, Insulmax
  // wall insulation and a heat pump. The honest version says what we know (the
  // era), what we don't (whether it actually leaks), and leaves the tick to the
  // buyer once they've been.
  // ── The whole room, as one job ────────────────────────────────────────────
  //
  // Every kitchen and bathroom line prices ONE component — cabinetry, or the
  // shower, or the benchtop. Nobody renovating a 1975 bathroom replaces the
  // vanity and leaves the waterproofing, and adding six lines up does not give
  // the number a builder would quote: a full refit strips back to the framing,
  // reworks the plumbing and re-waterproofs, and shares one lot of labour and
  // one lot of making good across the whole room.
  //
  // Offered rather than pre-ticked, and it never auto-includes: choosing to gut
  // a room is the reader's call, not a conclusion from a condition score.
  for (const [cat, label, id] of [
    ["Kitchen", "Whole kitchen — full refit", "room_kitchen"],
    ["Bathroom", "Whole bathroom — full refit", "room_bathroom"],
  ] as const) {
    const roomItems = subItems.filter((s) => ITEM_BY_ID[s.id]?.category === cat && s.score !== null);
    if (roomItems.length < 2) continue;
    const worst = Math.min(...roomItems.map((s) => s.score as number));
    const costing = costThreeTier({ id, name: label, category: cat, ...ctx });
    lines.push({
      key: id,
      name: label,
      detail: `Strip out and rebuild — replaces every ${cat.toLowerCase()} line below in one job`,
      badge: "Whole room",
      low: Math.round(costing.budget.tradieTotal * 0.85),
      high: Math.round(costing.premium.tradieTotal),
      urgencyYears: worst <= 3 ? 2 : 5,
      detailColor: "var(--brand)",
      uplift: 0,
      notes: "A full refit rather than the sum of the individual items — one lot of labour, one lot of making good. Tick this OR the separate lines, not both.",
      category: cat,
      costing,
      autoInclude: false,
      wholeRoom: true,
    });
  }

  if (persona === "investor") {
    // A standard established to fail whose item the analysis never returned
    // (say, insulation read from a 1960 build year) would have no line, so the
    // must-do could be neither ticked nor costed. Give it one, pre-ticked.
    for (const h of assessHealthyHomes(subItems, listing.buildYear, hhAssessed)) {
      if (h.compliant !== false || h.key === "hh_draught" || lines.some((l) => l.key === h.renoKey)) continue;
      lines.push({
        key: h.renoKey,
        name: `${h.label} (Healthy Homes)`,
        detail: "Doesn't meet the standard — required before you tenant",
        low: h.remediation.low,
        high: h.remediation.high,
        urgencyYears: 0,
        detailColor: "var(--bad)",
        uplift: 0,
        notes: h.fix,
        costing: costThreeTier({ id: h.renoKey, name: h.label, ...ctx, fallback: { low: h.remediation.low, high: h.remediation.high } }),
        autoInclude: true,
        legal: true,
        nonExisting: true,
      });
    }

    const draught = assessHealthyHomes(subItems, listing.buildYear, hhAssessed).find((h) => h.key === "hh_draught");
    if (draught) {
      const era = listing.buildYear ? `A ${listing.buildYear} house ` : "A house of this era ";
      // Established to fail = a legal must-do, pre-ticked like the other four
      // standards (insulation is read from the build year too and always was).
      // Not established = shown unticked, for the reader to add after checking.
      const mustDo = draught.compliant === false;
      lines.push({
        key: "hh_draught",
        name: "Draught stopping (Healthy Homes)",
        detail: mustDo
          ? `${era}predates draught-stopping requirements — required before you tenant`
          : "Built to an era that meets the standard — confirm at inspection",
        low: draught.remediation.low,
        high: draught.remediation.high,
        urgencyYears: 0,
        detailColor: mustDo ? "var(--bad)" : "var(--text-muted)",
        uplift: 0,
        notes:
          "Read from the build era, not from anything seen. Draughts are found by standing in the house: gaps at skirtings and architraves, doors and windows that don't seal, and an unused open fireplace left open to the sky. Untick this if the house has already been draught-stopped.",
        costing: costThreeTier({ id: "hh_draught", name: "Draught stopping", ...ctx, fallback: { low: draught.remediation.low, high: draught.remediation.high } }),
        autoInclude: mustDo,
        inferred: !mustDo,
        legal: true,
        nonExisting: mustDo,
      });
    }
  }
  return lines;
}
