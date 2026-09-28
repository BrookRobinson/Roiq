"use client";

import { ITEM_BY_ID } from "@/lib/scoring/catalog";

import { useState } from "react";
import type { SubItem, RenoControls, UrgencyScore } from "@/lib/property-tab/types";
import { urgencyScoreToYears } from "@/lib/property-tab/types";
import { conditionScoreColor } from "./ConditionScore";
import type { ItemValue, EstimatedItem } from "@/lib/scoring/improvement-values";
import { ItemValuation, ItemValuationWithheld, Step, EvidenceList, ActionBody } from "./ItemValuation";
import { actionFor, actionCost } from "@/lib/scoring/depreciation";
import { evidenceFor, mergeEvidence } from "@/lib/scoring/condition-evidence";
import { itemSummary } from "@/lib/scoring/item-summary";
import { ITEM_LIFE, expectedLife } from "@/lib/scoring/item-life";
import { isFactOnly } from "@/lib/scoring/improvement-values";
import { isRefused, isPerRoom, type AnyValuation, type PerRoomValuation } from "./valuation-types";
import { SIZE_ITEM_IDS, type Persona } from "@/lib/scoring/model";
import { confidenceMeta } from "./ConfidenceBar";
import { CostWorkings } from "@/components/CostWorkings";
import { useHoldPeriod } from "@/lib/hold-period/context";
import {
  roofReplacementCost,
  windowReplacementCost,
  ceilingInsulationCost,
  claddingRepaintCost,
  deckRepairCost,
} from "@/lib/labour-rates";
import { Camera, ArrowRight, Wrench, Shield } from "lucide-react";

const PTS_RED = "var(--bad)", PTS_ORANGE = "var(--warn)", PTS_GREEN = "var(--good)";
/** Colour for a points read, banded by fraction of the max. Shared with the
 * category accordion so per-item and category summaries read the same way. */
export function pointsColor(frac: number): string {
  if (frac >= 0.7) return PTS_GREEN;
  if (frac >= 0.4) return PTS_ORANGE;
  return PTS_RED;
}

/** A small labelled stat bubble — a header word (e.g. "Condition" / "Item") over a value. */
function Chip({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <div
      title={title}
      className="text-xs rounded-md px-2 py-1 max-w-xs"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span style={{ color: "var(--text-muted)" }}>{label}: </span>
      {children}
    </div>
  );
}

/**
 * One line per bathroom or bedroom — its condition, what it's worth and what it would
 * cost new — each opening to its own seven steps. The lines add up to the
 * card's value; rooms nobody photographed are named, and left out.
 */
function PerRoomBreakdown({ v, label, unseenEstimate }: { v: PerRoomValuation; label: string; unseenEstimate?: EstimatedItem | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
  return (
    <div className="space-y-2">
      {v.parts.map((p) => {
        const isOpen = open === p.room;
        const c = conditionScoreColor(p.condition as UrgencyScore);
        return (
          <div key={p.room} className="rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : p.room)}
              aria-expanded={isOpen}
              className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer"
            >
              <span className="min-w-0">
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{p.room}</span>
                <span className="text-[12px] ml-2 mono" style={{ color: c }}>{p.condition}/10</span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span className="mono text-[13px] font-bold" style={{ color: c }}>{money(p.valuation.valueNZD)}</span>
                <span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>· {money(p.valuation.cost.totalNZD)} new</span>
                <ArrowRight size={11} style={{ color: "var(--brand)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <ItemValuation
                  v={p.valuation}
                  lead={{
                    title: "Listing photos",
                    body: (
                      <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                        {p.fromBuyer ? (
                          <span className="inline-flex items-center gap-1" style={{ color: "var(--good)" }}><Camera size={12} /> Photographed at the property by you</span>
                        ) : p.photoReferences.length > 0 ? (
                          <span className="inline-flex items-center gap-1"><Camera size={12} style={{ color: "var(--text-muted)" }} /> Photos: {p.photoReferences.join(", ")}</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Read from the listing photos of this {v.noun}.</span>
                        )}
                      </div>
                    ),
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
      {/* The rooms no photo shows: estimated, drawn dashed so the eye can
          tell them from the rooms that were actually looked at. */}
      {v.unseen.length > 0 && (
        <div className="rounded-lg px-3 py-2.5" style={{ border: "1px dashed var(--border)" }}>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold">{v.unseen.join(", ")}</span>
              <span className="text-[12px] ml-2" style={{ color: "var(--text-muted)" }}>not photographed</span>
            </span>
            {unseenEstimate && (
              <span className="flex items-center gap-2 flex-shrink-0">
                <span className="mono text-[13px] font-bold" style={{ color: "var(--text-secondary)" }}>est. {money(unseenEstimate.valueNow)}</span>
                <span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>· {money(unseenEstimate.replacementTotal)} new</span>
              </span>
            )}
          </div>
          <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
            {unseenEstimate
              ? `No photo shows ${v.unseen.length === 1 ? "it" : "them"}, so ${v.unseen.length === 1 ? "it is" : "they are"} estimated from the condition of everything the photos do show, at no better than a modern spec. A photo of ${v.unseen.length === 1 ? "it" : "them"} would replace the estimate.`
              : `No photo shows ${v.unseen.length === 1 ? "it" : "them"}, and there's nothing seen to estimate from, so ${v.unseen.length === 1 ? "it isn't" : "they aren't"} valued.`}
          </div>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-2 px-3 pt-1 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
        <span>{label}, every {v.noun}</span>
        <span className="mono">
          {money(v.valueNZD + (unseenEstimate?.valueNow ?? 0))}{" "}
          <span className="font-normal text-[11px]" style={{ color: "var(--text-muted)" }}>
            · {money(v.cost.totalNZD + (unseenEstimate?.replacementTotal ?? 0))} new
            {unseenEstimate ? ` · incl. ${money(unseenEstimate.valueNow)} est.` : ""}
          </span>
        </span>
      </div>
    </div>
  );
}

/** Build a CostItem for this sub-item where we have the data */
function getCostItem(item: SubItem, region = "", floorSqm?: number | null) {
  if (!item.estimatedReplacementCost) return null;
  const floor = floorSqm && floorSqm > 0 ? floorSqm : 140; // fallback when floor area isn't stated
  // Match known sub-item IDs to specific cost calculators (region-aware labour).
  if (item.id === "ext_roof")        return roofReplacementCost(floor, region);
  if (item.id === "ext_cladding")    return claddingRepaintCost(floor, region);
  if (item.id === "ext_windows")     return windowReplacementCost(3, region);
  if (item.id === "kit_ceiling_ins" || item.id === "svc_insulation")
                                     return ceilingInsulationCost(floor, region);
  if (item.id === "out_deck")        return deckRepairCost(28, region);
  // Generic fallback — use raw replacement cost range
  return null;
}

export function SubItemCard({ item, region, floorSqm, showCost = false, persona = "buyer", renoControls, onOpenRenovations, value, valuation, estimate, unseenEstimate }: { item: SubItem; region?: string; floorSqm?: number | null; showCost?: boolean; persona?: Persona; renoControls?: RenoControls; onOpenRenovations?: () => void; value?: ItemValue | null; valuation?: AnyValuation | null; estimate?: EstimatedItem | null; unseenEstimate?: EstimatedItem | null }) {
  const [expanded, setExpanded] = useState(false);
  const { holdYears, withinHold } = useHoldPeriod();
  // v6 — the card shows what the item is WORTH, not what it scored. Colour
  // follows the condition read, which is the thing the colour was always really
  // about: points were condition wearing a rubric's clothes.
  const color = conditionScoreColor(item.score);

  // ONE value per item, and the itemised model wins where it exists.
  //
  // The badge used to read the blended spec×condition figure while the panel
  // underneath worked the item through cost-to-replace × life-remaining — so a
  // roof showed "$16,417" at the top and "$0" at the bottom of the same card.
  // That is the rival-valuation mistake this codebase has deleted twice, and it
  // reappeared the moment a second method existed. The itemised one is the
  // better answer (it measures the roof rather than scaling the floor area), so
  // it is the one displayed, and the older figure is the fallback for items it
  // does not cover yet.
  const rejected = valuation ? isRefused(valuation) : false;
  const detailed = valuation && !rejected ? valuation : null;
  const shown = detailed && !isRefused(detailed)
    ? { now: detailed.valueNZD, rcn: detailed.cost.totalNZD }
    : value
      ? { now: value.valueNow, rcn: value.replacementTotal }
      : null;
  const photosStep = (
    <div className="flex items-center gap-2 flex-wrap text-[13px]" style={{ color: "var(--text-secondary)" }}>
      {/* The step is already titled "Listing photos"; only name the source when it's something else. */}
      {!/^listing photos?$/i.test(item.evidenceSource.trim()) && <span>{item.evidenceSource}</span>}
      {item.photoReferences.length > 0 ? (
        <span className="inline-flex items-center gap-1">
          <Camera size={12} style={{ color: "var(--text-muted)" }} />
          Photos: {item.photoReferences.join(", ")}
        </span>
      ) : (
        <span style={{ color: "var(--text-muted)" }}>No photograph shows this item.</span>
      )}
    </div>
  );
  // Life left on the SAME reading the card's valuation uses: its own when it
  // has one, otherwise the itemised value's age against the item's service life.
  const life = ITEM_LIFE[item.id];
  const yearsRemaining =
    detailed && !isRefused(detailed) ? detailed.life.expectedYears - detailed.life.usedYears
    : value && life ? expectedLife(life) - value.ageYears
    : null;
  // Inside the hold on that same life — the plan dates the work the same way,
  // so the card's "outside your hold" tag and the plan can't disagree. The
  // condition score is only the fallback for an item with no life reading.
  const isWithinHold = withinHold(yearsRemaining != null ? Math.max(0, Math.round(yearsRemaining)) : urgencyScoreToYears(item.score));
  // The urgent action — the valuation's when it has one (same cost as the
  // Renovations line), otherwise read from the item at the itemised cost.
  const fallbackAction = actionFor(item);
  const action =
    detailed && !isRefused(detailed) ? detailed.action
    : fallbackAction ? { ...fallbackAction, costNZD: actionCost(value?.replacementTotal ?? 0, fallbackAction), deductedNZD: 0, stopGap: fallbackAction.scope !== "replace" && !!value?.pastLife }
    : null;
  const summary = itemSummary({
    action,
    yearsRemaining,
    replaceCost: shown?.rcn ?? null,
    score: item.score,
    holdYears,
    defect: item.observedDefect,
    evidence: evidenceFor(item),
    factOnly: isFactOnly(item.id) || !ITEM_BY_ID[item.id]?.costBearing,
    aiSummary: item.aiSummary,
  });
  // Several rooms: one summary per room, each from that room's own life, cost
  // and work. A single line built from the worst room's age and every room's
  // cost read as though the whole lot needed replacing in seven years.
  const roomSummaries =
    detailed && !isRefused(detailed) && isPerRoom(detailed)
      ? [
          ...detailed.parts.map((p) => ({
            room: p.room,
            text: itemSummary({
              action: p.valuation.action,
              yearsRemaining: p.valuation.life.expectedYears - p.valuation.life.usedYears,
              replaceCost: p.valuation.cost.totalNZD,
              score: p.condition,
              holdYears,
              defect: p.valuation.concerns[0],
            }),
          })),
          ...detailed.unseen.map((room) => ({
            room,
            text: unseenEstimate
              ? `Not photographed, so there's no reading of when it will need work. Valued at an estimated $${Math.round(unseenEstimate.valueNow / detailed.unseen.length).toLocaleString("en-NZ")} from the rest of the house.`
              : "Not photographed, so there's no reading of when it will need work.",
          })),
        ]
      : null;
  const costItem = getCostItem(item, region, floorSqm);
  // Renovation plan: this item can be added if it has a costed reno line.
  const canReno = renoControls?.has(item.id) ?? false;
  const inPlan = canReno && (renoControls?.included(item.id, withinHold) ?? false);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${color}`,
        // Deliberately NOT faded when the work falls outside the hold period. The
        // findings are the same findings either way, and dimming them made the AI
        // assessment hard to read — the "major work outside your hold" tag says it in
        // words, and the COST is where the hold period actually changes anything.
      }}
    >
      {/* Header row — always visible */}
      <button
        className="w-full text-left p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                {item.name}
              </span>
              {item.renovationLink && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "var(--accent-wash)", color: "var(--brand)", border: "1px solid var(--accent-wash)" }}
                >
                  <Wrench size={9} />
                  Reno tab
                </span>
              )}
              {item.healthyHomesLink && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "var(--warn-wash)", color: "var(--warn)", border: "1px solid var(--warn-wash)" }}
                >
                  <Shield size={9} />
                  Healthy Homes
                </span>
              )}
            </div>

            {/* Data pills — or, with no photos, the "upload to assess" prompt */}
            {item.noPhotoNotAssessed ? (
              <div className="mb-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                Upload photos to get a condition score for this area.{" "}
                <a href="/report/upload" className="inline-flex items-center gap-0.5 font-medium hover:underline" style={{ color: "var(--brand)" }}>Add photos <ArrowRight size={11} /></a>
              </div>
            ) : (
              // The summary line: what it's worth and how sure we are. Material
              // and age used to sit here, but both are steps 1 and 3 of the
              // valuation underneath, so the card said them twice.
              <div className="flex flex-wrap gap-2 mb-2 empty:mb-0">
                {shown ? (
                  <>
                    <Chip
                      label="Value"
                      title={`Costs about $${Math.round(shown.rcn).toLocaleString("en-NZ")} to replace today; this one is worth $${Math.round(shown.now).toLocaleString("en-NZ")} after the share of its life already used.`}
                    >
                      <span className="font-bold mono" style={{ color }}>${Math.round(shown.now).toLocaleString("en-NZ")}</span>
                    </Chip>
                    {unseenEstimate && (
                      <Chip label="Unphotographed rooms" title="Estimated from the condition of everything the photos do show.">
                        <span className="font-medium mono" style={{ color: "var(--text-secondary)" }}>est. ${Math.round(unseenEstimate.valueNow).toLocaleString("en-NZ")}</span>
                      </Chip>
                    )}
                  </>
                ) : estimate ? (
                  // Nothing of it was photographed, but it is still there and
                  // still in the valuation — so its estimate is shown, labelled.
                  <Chip label="Est. value" title="No photo shows this. Estimated from the condition of everything the photos do show.">
                    <span className="font-bold mono" style={{ color: "var(--text-secondary)" }}>${Math.round(estimate.valueNow).toLocaleString("en-NZ")}</span>
                    <span style={{ color: "var(--text-muted)" }}> · not photographed</span>
                  </Chip>
                ) : SIZE_ITEM_IDS.has(item.id) && item.estimatedSqm ? (
                  <Chip label="Size"><span className="font-medium" style={{ color: "var(--text-secondary)" }}>~{item.estimatedSqm} m²</span></Chip>
                ) : (
                  <Chip label="Condition" title="Condition — how worn or new the item is (1–10).">
                    <span className="font-bold mono" style={{ color: conditionScoreColor(item.score) }}>
                      {item.score !== null ? `${item.score}/10` : "Not assessed"}
                    </span>
                  </Chip>
                )}
                {item.confidenceTier != null && (
                  <Chip label="Confidence" title={confidenceMeta(item.confidenceTier).full}>
                    <span className="font-medium" style={{ color: confidenceMeta(item.confidenceTier).color }}>
                      {confidenceMeta(item.confidenceTier).short.replace(/ confidence$/, "")}
                    </span>
                  </Chip>
                )}
              </div>
            )}
          </div>

          {item.noPhotoNotAssessed && (
            <div className="flex-shrink-0">
              <span className="inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-1 whitespace-nowrap" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <Camera size={11} /> No photos — not assessed
              </span>
            </div>
          )}
        </div>

        {/* Outside hold period label — the fallback position. When the card has
            an "Add to renovation plan" control the tag lives beside that instead,
            which is where someone is actually deciding whether to include it. */}
        {/* Only for items that CAN have work done to them. It was printing
            "Major work outside your 10-year hold — monitor and maintain" against
            Natural light & aspect, which is not a thing anyone maintains. */}
        {!isWithinHold && !canReno && ITEM_BY_ID[item.id]?.costBearing && item.score !== null && item.score <= 7 && (
          <div
            className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            Major work outside your {holdYears}-year hold — monitor and maintain
          </div>
        )}

        {/* Expand toggle hint — no AI assessment to read for a no-photo item */}
        {!item.noPhotoNotAssessed && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs" style={{ color: "var(--brand)" }}>
              {expanded ? "Hide detail" : "See breakdown"}
            </span>
            <ArrowRight
              size={11}
              style={{
                color: "var(--brand)",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </div>
        )}
      </button>

      {/* Add-to-renovation-plan control — only for items we can cost (renovate) */}
      {canReno && (
        <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5" style={{ borderTop: "1px solid var(--border)", background: inPlan ? "var(--accent-wash)" : "transparent" }}>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inPlan}
              onChange={(e) => renoControls?.toggle(item.id, e.target.checked)}
              className="w-4 h-4 cursor-pointer flex-shrink-0"
              aria-label={`Add ${item.name} to the renovation plan`}
            />
            <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: inPlan ? "var(--brand)" : "var(--text-secondary)" }}>
              <Wrench size={11} />
              {inPlan ? "In your renovation plan" : "Add to renovation plan"}
            </span>
          </label>

          {/* "Major work" specifically: what falls outside the hold is the
              REPLACEMENT, not every hand laid on the thing. A 25-year roof at
              year 12 still wants patching and clearing in the meantime, and a
              tag reading plain "outside your hold" reads as "ignore this",
              which is how a leak becomes a rebuild. Fading the card said the
              same wrong thing more quietly. */}
          {!isWithinHold && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              title={`Replacing this falls beyond the ${holdYears}-year hold you've set. Patching and maintenance may still be needed before then.`}
            >
              Major work outside your {holdYears}-yr hold
            </span>
          )}
          {inPlan && onOpenRenovations && (
            <button onClick={onOpenRenovations} className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer hover:underline" style={{ color: "var(--brand)" }}>
              View <ArrowRight size={11} />
            </button>
          )}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && !item.noPhotoNotAssessed && (
        <div
          className="px-4 pb-4 space-y-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {/* The valuation, above the prose. The workings are what the reader
              came for; the summary is context for them, not a substitute. */}
          {/* Step 1 is the evidence: which photographs this item was read from.
              It leads the valuation when there is one, and stands alone when
              there isn't, so it is always the first thing in the drop-down. */}
          <div className="pt-4">
            {valuation && (
              <div
                className="text-xs font-semibold uppercase tracking-wider mb-2.5"
                style={{ color: "var(--text-muted)" }}
              >
                How this value was worked out
              </div>
            )}
            {valuation && !isRefused(valuation) && isPerRoom(valuation) ? (
              <PerRoomBreakdown v={valuation} label={item.name} unseenEstimate={unseenEstimate} />
            ) : valuation && !isRefused(valuation) ? (
              <ItemValuation v={valuation} lead={{ title: "Listing photos", body: photosStep }} evidence={evidenceFor(item)} />
            ) : (
              <div className="space-y-3">
                {estimate && (
                  <div className="rounded-lg px-3 py-2.5 text-[13px]" style={{ border: "1px dashed var(--border)", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Estimated, not seen</span>
                      <span className="mono whitespace-nowrap">
                        <span className="font-bold">${Math.round(estimate.valueNow).toLocaleString("en-NZ")}</span>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}> · ${Math.round(estimate.replacementTotal).toLocaleString("en-NZ")} new</span>
                      </span>
                    </div>
                    <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                      No photo shows this, but it is still there, so it is valued from the condition of everything the photos do
                      show, at no better than a modern spec. It counts towards the valuation and is listed as estimated on the
                      Financial tab. A photo of it would replace the estimate.
                    </div>
                  </div>
                )}
                <Step n={1} title="Listing photos">{photosStep}</Step>
                {!item.noPhotoNotAssessed && ITEM_BY_ID[item.id]?.inspection === "improvements" && (
                  <Step n={2} title="Visual evidence">
                    {(() => {
                      const m = mergeEvidence(item.observedDefect ? [item.observedDefect] : [], evidenceFor(item));
                      return <EvidenceList concerns={m.concerns} evidence={m.seen} />;
                    })()}
                  </Step>
                )}
                {!item.noPhotoNotAssessed && ITEM_BY_ID[item.id]?.costBearing && (
                  <Step n={3} title="Action"><ActionBody action={action} replaceCost={value?.replacementTotal} /></Step>
                )}
                {valuation && isRefused(valuation) && <ItemValuationWithheld reason={valuation.reason} />}
              </div>
            )}
          </div>

          {/* The summary: when work is due and what it costs, then the finding
              behind it. Built from the same life and cost as the valuation above
              so the two can't disagree. It replaced the AI's full paragraph,
              whose substance is now the visual evidence step. */}
          <div className="pt-4">
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Summary
            </div>
            {roomSummaries ? (
              <div className="space-y-2">
                {roomSummaries.map((r) => (
                  <p key={r.room} className="text-sm" style={{ color: "var(--text-primary)", lineHeight: 1.7 }}>
                    <span className="font-semibold">{r.room}: </span>
                    {r.text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)", lineHeight: 1.7 }}>
                {summary}
              </p>
            )}
          </div>


          {/* Replacement cost — kept on the Renovation tab only (showCost gates it). */}
          {showCost && item.estimatedReplacementCost && (
            costItem ? (
              <CostWorkings item={costItem} withinHoldPeriod={isWithinHold} />
            ) : (
              <div
                className="rounded-lg p-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                  Estimated replacement cost
                  {!isWithinHold && (
                    <span className="ml-2 font-normal" style={{ color: "var(--text-muted)" }}>
                      (major work outside your {holdYears}-yr hold)
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold mono" style={{ color: "var(--text-primary)" }}>
                    ${item.estimatedReplacementCost.low.toLocaleString()} – ${item.estimatedReplacementCost.high.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {item.estimatedReplacementCost.notes}
                </div>
              </div>
            )
          )}

          {/* Renovation link */}
          {item.renovationLink && (
            <button
              className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer"
              style={{ color: "var(--brand)" }}
            >
              <Wrench size={13} />
              View in Renovation tab
              <ArrowRight size={13} />
            </button>
          )}

          {/* Healthy Homes link */}
          {item.healthyHomesLink && (
            <button
              className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer"
              style={{ color: "var(--warn)" }}
            >
              <Shield size={13} />
              View Healthy Homes assessment
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
