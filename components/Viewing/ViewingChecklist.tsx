"use client";

// ============================================================
// "Viewing checklist" — the list that has to be answered before the report will
// before the report may say a person stood in the house.
//
// Two jobs, and they pull in different directions, so the component does both
// deliberately: on screen it's an input form (three taps per line, notes where
// they matter); on paper it's a clipboard — tick boxes and a ruled line, no
// colour, no chrome, ordered the way you'd actually walk a house.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Ban, CalendarDays, Camera, Check, CircleAlert, HardHat, Unlock, X } from "lucide-react";

import {
  ANSWER_LABEL,
  checklistStatus,
  type ChecklistItem,
  CHECKLIST_SECTIONS,
  type ViewingAnswer,
  type ViewingState,
} from "@/lib/viewing/checklist";
import type { ItemPhotoAnalysis } from "@/lib/viewing/photo-types";
import { ItemPhotoUpload, type PhotoContext } from "./ItemPhotoUpload";
import { RoomPhotoUpload } from "./RoomPhotoUpload";
import { roomPhotoKey } from "@/lib/viewing/rooms";
import { itemLabel } from "@/lib/scoring/catalog";
import { DocUpload } from "@/components/PropertyInspections/DocUpload";
import { type InspectionEvidence } from "@/lib/viewing/status";
import type { DocAnalysis } from "@/lib/report-store";
import { PRODUCT_NAME } from "@/lib/brand";

const ANSWER_ORDER: ViewingAnswer[] = ["ok", "problem", "no_access", "not_there"];

/** What to call each document on its own upload button. */
const DOC_NOUN: Record<string, string> = {
  leg_lim: "LIM",
  leg_consents: "council property file",
  leg_eqc: "EQC claim history",
  leg_title: "record of title",
};

/** Same bands the rest of the report scores against. */
const scoreColour = (score: number) =>
  score >= 8 ? "var(--good)" : score >= 5 ? "var(--warn)" : "var(--bad)";

const ANSWER_COLOR: Record<ViewingAnswer, string> = {
  ok: "var(--good)",
  problem: "var(--bad)",
  no_access: "var(--warn)",
  not_there: "var(--text-muted)",
};



export function ViewingChecklist({
  items,
  state,
  photoContext,
  gated = true,
  onAnswer,
  onNote,
  onViewedOn,
  onItemPhoto,
  onClearItemPhoto,
  onRoomPhotos,
  inspection,
  inspectionDoc,
  onVerifiedDoc,
  onOpenLand,
}: {
  items: ChecklistItem[];
  state: ViewingState;
  /** Property facts handed to the model alongside the buyer's photographs. */
  photoContext: PhotoContext;
  /**
   * False on a demo or sample report. Nothing here is withheld either way — the
   * flag only changes the copy, so a sample doesn't tell the reader to go and
   * look at a property that isn't theirs.
   */
  gated?: boolean;
  onAnswer: (key: string, answer: ViewingAnswer | null) => void;
  onNote: (key: string, note: string) => void;
  onViewedOn: (iso: string | null) => void;
  onItemPhoto: (itemId: string, analysis: ItemPhotoAnalysis) => void;
  onClearItemPhoto: (itemId: string) => void;
  /** A whole room's reads, from one set of photos. */
  onRoomPhotos: (lineKey: string, analyses: ItemPhotoAnalysis[]) => void;
  /** The uploaded inspection report, as the gate sees it. */
  inspection: InspectionEvidence | null;
  /** …and its full reading. The Land tab is keyed by scoring item id and has
   *  nowhere to put this one, so the findings are shown here. */
  inspectionDoc: DocAnalysis | null;
  /** A LIM / consent file / EQC history / title, read and scored. */
  onVerifiedDoc: (itemId: string, doc: DocAnalysis) => void;
  /** The Land tab holds the full reading of each document once it's in. */
  onOpenLand: () => void;
}) {
  const status = useMemo(() => checklistStatus(items, state), [items, state]);

  // By WHY each thing is on the list, which is what decides what to do about
  // it — not by room. The room is on each line instead.
  const sections = useMemo(
    () =>
      // The three main sections always show, in the same order, so "section 2"
      // means the same thing on every report; paperwork only when there is some.
      CHECKLIST_SECTIONS.map((sec) => ({ ...sec, rows: items.filter((it) => it.section === sec.id) })).filter(
        (sec) => sec.rows.length > 0 || sec.empty
      ),
    [items]
  );


  // Photographed items that are no longer on the list, because photographing
  // them is what took them off it.
  const onList = new Set(items.map((i) => i.itemId).filter(Boolean));
  const assessedElsewhere = Object.entries(state.photos ?? {}).filter(
    ([, a]) => a.showsItem && !onList.has(a.itemId)
  );

  return (
    <div className="space-y-6 print-root">
      {/* What this tab is and how to use it — in the order you'd do it, with
          the same words as the buttons below. */}
      <div className="card p-5">
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Your viewing checklist</h2>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {items.length > 0
            ? `These are the ${items.length} things the listing photos couldn't settle about this property. Take this list with you when you go and see it, and what you find replaces our estimate in the report.`
            : "The listing photos settled everything on this property, so there's nothing left to check at the viewing."}
          {!gated && " This is a sample property, so there's nothing to visit — it shows how the checklist works."}
        </p>
        {items.length > 0 && (
          <ol className="mt-3 space-y-1.5 text-sm list-decimal pl-5" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
            <li>Open this tab on your phone at the viewing.</li>
            <li>Each item tells you what to ask the agent, what to look at, and what to photograph.</li>
            <li>
              Where it offers <strong style={{ color: "var(--text-primary)" }}>Take a photo</strong>, take one. It&apos;s read the
              same way as the listing photos and scores that item properly.
            </li>
            <li>
              Otherwise pick an answer: <strong style={{ color: "var(--text-primary)" }}>No issue</strong>,{" "}
              <strong style={{ color: "var(--text-primary)" }}>Problem confirmed</strong>,{" "}
              <strong style={{ color: "var(--text-primary)" }}>Couldn&apos;t inspect</strong> or{" "}
              <strong style={{ color: "var(--text-primary)" }}>Not there</strong>. Couldn&apos;t inspect is a fair answer; the report
              then says so rather than guessing.
            </li>
            <li>Enter the date you went, so the report can say the property was inspected, not just read from photos.</li>
          </ol>
        )}
        <p className="mt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>Your answers save as you go.</p>
      </div>

      {/* When they went. This is the attestation the report states. */}
      <div className="card p-5 no-print">
        <label className="label flex items-center gap-2" htmlFor="viewed-on">
          <CalendarDays size={14} style={{ color: "var(--brand)" }} />
          The date you viewed this property
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id="viewed-on"
            type="date"
            className="input"
            style={{ maxWidth: 220 }}
            value={state.viewedOn ?? ""}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onViewedOn(e.target.value || null)}
          />
          {state.viewedOn && (
            <button
              onClick={() => onViewedOn(null)}
              className="text-[13px] underline"
              style={{ color: "var(--text-muted)" }}
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          The report says the property was inspected on this date. That is the difference between
          a schedule of defects and an opinion about some photos.
        </p>
        {/* Moved here from the removed intro card: it is about this field. */}
        {gated && status.missingViewingDate && (
          <p className="mt-3 flex items-start gap-2 text-[13px]" style={{ color: "var(--warn)" }}>
            <CircleAlert size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Every line is answered — record the date you went, and the report can say the
              property was inspected rather than read.
            </span>
          </p>
        )}
      </div>


      {/* The inspection. Optional, and the strongest evidence on the page —
          the one thing here a buyer cannot supply by typing. */}
      <div className="card p-5 no-print">
        <label className="label flex items-center gap-2">
          <HardHat size={14} style={{ color: "var(--brand)" }} />
          The property inspection
        </label>

        {inspection?.confirmed ? (
          <div className="mt-3">
            <p className="flex items-start gap-2 text-sm" style={{ color: "var(--good)" }}>
              <Unlock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Inspection report read and accepted
                {inspection.inspector ? ` — ${inspection.inspector}` : ""}
                {inspection.inspectedOn ? `, ${inspection.inspectedOn}` : ""}.
              </span>
            </p>
            {inspectionDoc?.summary && (
              <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {inspectionDoc.summary}
              </p>
            )}
            {!!inspectionDoc?.redFlags?.length && (
              <ul className="mt-3 space-y-1.5">
                {inspectionDoc.redFlags.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--warn)" }}>
                    <CircleAlert size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Where the inspector disagrees with the photo analysis, the report follows the
              inspector — they were there and the camera wasn&rsquo;t.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {inspection?.present
                ? "What you uploaded wasn't a property inspection report. A valuation, a builder's quote or a desktop assessment doesn't count — this slot wants a report by somebody who attended the property."
                : "Have a building inspector's report? Upload it and we'll read it beside ours. Your own walk-through can't settle whether a stain is an active leak or a repaired one; theirs can."}
            </p>
            <div className="mt-3">
              <DocUpload
                itemId="insp_report"
                label="Upload inspection report (PDF)"
                onVerified={(doc) => onVerifiedDoc("insp_report", doc)}
              />
            </div>
            <p className="mt-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Haven&rsquo;t had one done? A pre-purchase inspection is normally $400&ndash;$900 and a
              few days&rsquo; notice. Upload it here when you have it and the report reads it in.
            </p>
          </>
        )}
      </div>

      {/* Most photographed items leave the list — a clear shot makes them scored
          and Tier 1, so they stop being unknowns. Without this they'd vanish
          with no acknowledgement that the buyer did the work. */}
      {assessedElsewhere.length > 0 && (
        <div className="card p-5 no-print">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Assessed from your photos ({assessedElsewhere.length})
          </h3>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
            These are off the list — they&rsquo;re scored in the report now, on your photographs
            rather than the listing&rsquo;s.
          </p>
          <div className="mt-3 space-y-2">
            {assessedElsewhere.map(([key, a]) => (
              <div
                key={key}
                className="flex items-start justify-between gap-3 rounded-xl px-3.5 py-2.5"
                style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {itemLabel(a.itemId)}{a.room ? ` — ${a.room}` : ""}
                  </div>
                  <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {a.observedDefect || a.summary}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 whitespace-nowrap">
                  {a.score != null && (
                    <span className="mono text-[13px] font-bold" style={{ color: scoreColour(a.score) }}>
                      {a.score}/10
                    </span>
                  )}
                  <button
                    onClick={() => onClearItemPhoto(key)}
                    className="text-[12px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Undo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="card p-5 no-print">
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            Nothing on this property was left unassessed.
          </p>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            Record the date you viewed it anyway — a report that saw everything in the photos
            still hasn&rsquo;t smelled the place.
          </p>
        </div>
      )}

      {sections.map((sec, n) => (
        <section key={sec.id} className="card p-0 overflow-hidden">
          <div className="px-5 py-3.5" style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--rule)" }}>
            <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              <span
                className="mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "var(--accent-wash)", color: "var(--accent-text)" }}
              >
                {n + 1}
              </span>
              {sec.title}
              <span className="text-[12px] font-normal" style={{ color: "var(--text-muted)" }}>· {sec.rows.length}</span>
            </h3>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{sec.intro}</p>
          </div>
          {sec.rows.length === 0 && (
            <p className="px-5 py-3 text-[13px]" style={{ color: "var(--text-muted)" }}>{sec.empty}</p>
          )}
          <div>
            {sec.rows.map((it, i) => (
              <Row
                key={it.key}
                item={it}
                record={state.answers[it.key]}
                photo={
                  it.itemId
                    ? state.photos?.[it.itemId] ?? Object.values(state.photos ?? {}).find((p) => p.room && p.itemId === it.itemId)
                    : undefined
                }
                photoContext={photoContext}
                first={i === 0}
                onAnswer={onAnswer}
                onNote={onNote}
                onItemPhoto={onItemPhoto}
                onClearItemPhoto={onClearItemPhoto}
                onRoomPhotos={onRoomPhotos}
                onVerifiedDoc={onVerifiedDoc}
                onOpenLand={onOpenLand}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * One of the three blocks on every checklist item.
 *
 * The number and the colour do the same job twice on purpose. A reader scanning
 * a long list finds "2" faster than they read a heading, and the tint says which
 * KIND of thing it is before they read anything at all — but the colour never
 * carries the meaning alone, because roughly one man in twelve cannot separate
 * the amber from the green. The heading says it in words either way.
 *
 * On paper the numbered bubbles go and the rule stays: a printed checklist is
 * something you carry round a house with a pen, and what survives is the
 * instruction.
 */
function Step({
  n,
  title,
  tone,
  children,
}: {
  n: number;
  title: string;
  tone: "warn" | "neutral" | "good";
  children: React.ReactNode;
}) {
  // Only TWO of the three carry colour, deliberately. The theme's accent is a
  // gold and its warn an orange, close enough that three tinted headings in a
  // row read as a gradient rather than three separate things. So the problem is
  // amber, the payoff is green, and the instruction in the middle — the part
  // actually read word by word — is plain ink. The numbered bubble carries the
  // ordering; the colour carries the meaning.
  const TONE = {
    warn: { accent: "var(--warn)", wash: "var(--warn-wash)" },
    neutral: { accent: "var(--text-secondary)", wash: "var(--surface-2)" },
    good: { accent: "var(--good)", wash: "var(--good-wash)" },
  }[tone];

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="mono no-print flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: TONE.wash, color: TONE.accent }}
          aria-hidden="true"
        >
          {n}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TONE.accent }}>
          {title}
        </span>
      </div>
      <div className="pl-2.5" style={{ borderLeft: `2px solid ${TONE.wash}` }}>
        {children}
      </div>
    </div>
  );
}

function Row({
  item,
  record,
  photo,
  photoContext,
  first,
  onAnswer,
  onNote,
  onItemPhoto,
  onClearItemPhoto,
  onRoomPhotos,
  onVerifiedDoc,
  onOpenLand,
}: {
  item: ChecklistItem;
  record?: ViewingState["answers"][string];
  photo?: ItemPhotoAnalysis;
  photoContext: PhotoContext;
  first: boolean;
  onAnswer: (key: string, answer: ViewingAnswer | null) => void;
  onNote: (key: string, note: string) => void;
  onItemPhoto: (itemId: string, analysis: ItemPhotoAnalysis) => void;
  onClearItemPhoto: (itemId: string) => void;
  onRoomPhotos: (lineKey: string, analyses: ItemPhotoAnalysis[]) => void;
  onVerifiedDoc: (itemId: string, doc: DocAnalysis) => void;
  onOpenLand: () => void;
}) {
  const [note, setNoteLocal] = useState(record?.note ?? "");
  const answered = record?.answer;

  // Commit while they type, not only on blur. Someone writes what they found,
  // then taps straight through to the agent tab or hits print — on a phone, at
  // the property, there may never be a blur, and losing the one sentence they
  // wrote at the house is the worst thing this screen could do.
  useEffect(() => {
    if (note === (record?.note ?? "")) return;
    const t = setTimeout(() => onNote(item.key, note), 400);
    return () => clearTimeout(t);
  }, [note, record?.note, item.key, onNote]);

  return (
    <div
      className="px-5 py-4 print-row"
      style={{ borderTop: first ? "none" : "1px solid var(--rule)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Paper tick box. */}
            <span
              className="print-only"
              style={{ display: "none", width: 12, height: 12, border: "1px solid #000" }}
            />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {item.label}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold no-print"
              style={{
                background: item.band ? "var(--warn-wash)" : "var(--surface-2)",
                color: item.band ? "var(--warn)" : "var(--text-muted)",
                border: "1px solid var(--rule)",
              }}
            >
              {item.band ? `${item.group} · graded ${item.band}` : item.group}
            </span>
          </div>

          {/* Three blocks, always the same three, always in this order — which
              is the order they cost you. Ask is free and instant, look is free
              but you have to be there, and photograph is the only one that
              changes the report. Before this it was two grey paragraphs of
              similar weight and nobody could find the instruction in them. */}
          <Step n={1} title="The concern" tone="warn">
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              {item.guide.concern}
            </p>
            {/* The report's own reason, underneath and quieter — it says why
                this is ON the list, which is a different question from what
                you don't know about it. Screen only: printing a paragraph of
                reasoning per line turns a clipboard into an essay. */}
            <p className="mt-1 text-[12px] no-print" style={{ color: "var(--text-muted)" }}>
              {item.why}
            </p>
          </Step>

          <Step n={2} title="How to check it" tone="neutral">
            {item.guide.ask && (
              <div
                className="mb-2.5 rounded-lg px-3 py-2"
                style={{ background: "var(--surface)", border: "1px dashed var(--rule-strong)" }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
                  style={{ color: "var(--accent-text)" }}
                >
                  Ask the agent
                </div>
                <p className="text-sm italic" style={{ color: "var(--text-primary)" }}>
                  &ldquo;{item.guide.ask}&rdquo;
                </p>
              </div>
            )}
            <ol className="space-y-1.5">
              {item.guide.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span
                    className="mono shrink-0 text-[11px] font-bold"
                    style={{ color: "var(--accent-text)", lineHeight: "1.45" }}
                  >
                    {i + 1}.
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>{step}</span>
                </li>
              ))}
            </ol>
          </Step>

          {!!item.guide.photos?.length && (
            <Step n={3} title="Photograph it" tone="good">
              <ul className="space-y-1.5 mb-2">
                {item.guide.photos.map((shot, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <Camera size={13} className="shrink-0 mt-0.5" style={{ color: "var(--good)" }} />
                    <span style={{ color: "var(--text-secondary)" }}>{shot}</span>
                  </li>
                ))}
              </ul>
              {/* Two different promises, because only one of them is true for
                  any given item. An improvements item really is re-scored on the
                  buyer's photograph — see effectiveSubItems in RealReportView,
                  where the shot overrides score, condition, spec tier, age and
                  replacement cost, and valueProperty then reads those. Land,
                  legal and location items are NOT photo-assessable, and saying
                  "this flows into the valuation" there would be the same
                  over-claim the confidence tiers exist to prevent. */}
              <p className="text-[12px] no-print" style={{ color: "var(--text-muted)" }}>
                {item.canPhotograph ? (
                  <>
                    Your photos go through the same analysis the listing photos did. We read the
                    condition, the materials and the age — a model or serial number on a data
                    plate dates a unit far better than its appearance does — and the item is
                    re-scored on what you saw, which flows through to the valuation.
                  </>
                ) : (
                  <>
                    We can&rsquo;t score this one from a photograph — it&rsquo;s settled by a
                    document or by the council, not by how it looks. Take them anyway: they
                    are what you hand your building inspector and your solicitor.
                  </>
                )}
              </p>
            </Step>
          )}

          {/* The document goes in HERE, for the same reason the camera does: the
              buyer is standing at an open home with the LIM the agent just
              handed them, and sending them off to another tab to use it is how a
              checklist stops getting finished. Once it's read, the line is gone
              — the report has the document, so there is nothing left to ask. */}
          {item.source === "document" && item.itemId && (
            <div className="mt-3 no-print">
              <DocUpload
                itemId={item.itemId}
                label={`Upload the ${DOC_NOUN[item.itemId] ?? "document"}`}
                onVerified={(doc) => onVerifiedDoc(item.itemId as string, doc)}
              />
              <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                PDF. {PRODUCT_NAME} reads the whole thing — the full reading lands on the{" "}
                <button onClick={onOpenLand} className="underline" style={{ color: "var(--brand)" }}>
                  Title &amp; legal tab
                </button>
                .
              </p>
            </div>
          )}

          {/* Offered before the three answers, and deliberately so: a photograph
              gets the item ASSESSED, where an answer only records what the buyer
              reckoned. The report was never missing an opinion — it was missing
              a picture. */}
          {item.room && (
            <RoomPhotoUpload room={item.room} context={photoContext} onAnalysed={(a) => onRoomPhotos(item.key, a)} />
          )}
          {item.canPhotograph && item.itemId && (
            <ItemPhotoUpload
              itemId={item.itemId}
              label={item.label}
              priorSummary={item.priorSummary}
              context={photoContext}
              analysis={photo}
              rooms={item.rooms}
              // A room-tagged read is filed under its room, so the valuation
              // puts it on that room rather than on every room at once.
              onAnalysed={(a) => onItemPhoto(a.room ? roomPhotoKey(item.itemId as string, a.room) : (item.itemId as string), a)}
              onCleared={() => onClearItemPhoto(photo?.room ? roomPhotoKey(item.itemId as string, photo.room) : (item.itemId as string))}
            />
          )}
        </div>

        {answered && (
          <span
            className="no-print flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "var(--surface-2)", color: ANSWER_COLOR[answered], border: "1px solid var(--rule)" }}
          >
            {answered === "ok" ? <Check size={11} /> : answered === "problem" ? <X size={11} /> : answered === "not_there" ? <Ban size={11} /> : <CircleAlert size={11} />}
            {ANSWER_LABEL[answered]}
          </span>
        )}
      </div>

      {/* On screen: the three answers. Hidden once a photograph has settled the
          item — the report has assessed it, and asking the buyer to also tick a
          box invites an opinion to contradict the evidence. */}
      {!photo && (
      <div className="mt-3 flex flex-wrap gap-2 no-print">
        {ANSWER_ORDER.map((a) => {
          const on = answered === a;
          return (
            <button
              key={a}
              onClick={() => onAnswer(item.key, on ? null : a)}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors"
              style={{
                border: `1px solid ${on ? ANSWER_COLOR[a] : "var(--rule)"}`,
                background: on ? "var(--surface-2)" : "transparent",
                color: on ? ANSWER_COLOR[a] : "var(--text-secondary)",
              }}
            >
              {ANSWER_LABEL[a]}
            </button>
          );
        })}
      </div>
      )}

      {/* A confirmed problem and a no-access are both carried into the report in
          the buyer's own words, so the note is where it's worth typing. */}
      {!photo && (answered === "problem" || answered === "no_access" || answered === "not_there") && (
        <div className="mt-3 no-print">
          <textarea
            className="input"
            rows={2}
            value={note}
            onChange={(e) => setNoteLocal(e.target.value)}
            placeholder={
              answered === "problem"
                ? "What you actually saw — the agent's letter quotes this."
                : answered === "not_there"
                  ? "Optional — e.g. no deck anywhere on the section."
                  : "Why you couldn't check it, e.g. no subfloor access."
            }
          />
        </div>
      )}

      {/* On paper: boxes and a line to write on. */}
      <div className="print-only" style={{ display: "none", marginTop: 6, fontSize: 11 }}>
        <span style={{ marginRight: 14 }}>☐ No issue</span>
        <span style={{ marginRight: 14 }}>☐ Problem</span>
        <span style={{ marginRight: 14 }}>☐ Couldn&rsquo;t inspect</span>
        <span>☐ Not there</span>
        <div style={{ borderBottom: "1px solid #999", height: 16, marginTop: 4 }} />
      </div>
    </div>
  );
}

