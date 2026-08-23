"use client";

// ============================================================
// "Before you view" — the list that has to be answered before the report will
// let anything go to the vendor's agent.
//
// Two jobs, and they pull in different directions, so the component does both
// deliberately: on screen it's an input form (three taps per line, notes where
// they matter); on paper it's a clipboard — tick boxes and a ruled line, no
// colour, no chrome, ordered the way you'd actually walk a house.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, CircleAlert, Lock, Printer, Unlock, X } from "lucide-react";

import {
  ANSWER_LABEL,
  checklistStatus,
  type ChecklistItem,
  type ViewingAnswer,
  type ViewingState,
} from "@/lib/viewing/checklist";

const ANSWER_ORDER: ViewingAnswer[] = ["ok", "problem", "no_access"];

const ANSWER_COLOR: Record<ViewingAnswer, string> = {
  ok: "var(--good)",
  problem: "var(--bad)",
  no_access: "var(--warn)",
};

const SOURCE_NOTE: Record<ChecklistItem["source"], string> = {
  ungraded: "Not assessed",
  probable: "Probable — confirm",
  document: "Document needed",
  gap: "Not in the listing",
};

/** Print the checklist alone, without the navbar, tabs or the rest of the report. */
function printChecklist() {
  document.body.classList.add("printing");
  const clear = () => {
    document.body.classList.remove("printing");
    window.removeEventListener("afterprint", clear);
  };
  window.addEventListener("afterprint", clear);
  window.print();
  // Safari fires afterprint unreliably; make sure the class never sticks.
  setTimeout(clear, 1000);
}

export function ViewingChecklist({
  items,
  state,
  address,
  onAnswer,
  onNote,
  onViewedOn,
  onOpenLetter,
  onOpenLand,
}: {
  items: ChecklistItem[];
  state: ViewingState;
  address: string;
  onAnswer: (key: string, answer: ViewingAnswer | null) => void;
  onNote: (key: string, note: string) => void;
  onViewedOn: (iso: string | null) => void;
  onOpenLetter: () => void;
  /** Paperwork lines are settled by uploading a document on the Land tab. */
  onOpenLand: () => void;
}) {
  const status = useMemo(() => checklistStatus(items, state), [items, state]);

  const groups = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const it of items) {
      const list = map.get(it.group) ?? [];
      list.push(it);
      map.set(it.group, list);
    }
    return [...map.entries()];
  }, [items]);

  const pct = items.length ? Math.round((status.answered / items.length) * 100) : 100;

  return (
    <div className="space-y-6 print-root">
      {/* Why this exists. Screen only — on paper the reader is holding the thing
          and doesn't need to be told what it's for. */}
      <div className="card p-5 no-print">
        <div className="flex items-start gap-3">
          {status.complete ? (
            <Unlock size={18} style={{ color: "var(--good)", flexShrink: 0, marginTop: 2 }} />
          ) : (
            <Lock size={18} style={{ color: "var(--brand)", flexShrink: 0, marginTop: 2 }} />
          )}
          <div className="flex-1">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {status.complete
                ? "You've been through the property — the letter is unlocked"
                : "Go and see the property before you write to the agent"}
            </h2>
            <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
              {status.complete ? (
                <>
                  All {items.length} {items.length === 1 ? "thing" : "things"} the photographs
                  couldn&rsquo;t settle {items.length === 1 ? "has" : "have"} been answered, and the
                  letter now says what you found rather than what the analysis guessed. Change any
                  answer below and it updates.
                </>
              ) : (
                <>
                  The report reads photographs. These are the things photographs can&rsquo;t settle:{" "}
                  {items.length === 0
                    ? "on this property, nothing — every item was assessed."
                    : `${items.length} of them on this property.`}{" "}
                  Until they&rsquo;re answered, the document that goes to the vendor would be built on
                  guesswork, and an agent will take it apart in a sentence. Print this, take it with
                  you, and fill it in as you go.
                </>
              )}
            </p>
            {items.length > 0 && (
              <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
                Nothing you record here is sent to the agent as-is. It decides which findings the letter
                is allowed to claim, and which it has to state you couldn&rsquo;t check.
              </p>
            )}
          </div>
        </div>

        {/* Progress + actions */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-baseline justify-between text-[13px]">
              <span style={{ color: "var(--text-secondary)" }}>
                {status.answered} of {items.length} answered
              </span>
              <span className="mono text-xs" style={{ color: "var(--text-muted)" }}>
                {pct}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full" style={{ background: "var(--surface-2)" }}>
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${pct}%`, background: status.complete ? "var(--good)" : "var(--brand)" }}
              />
            </div>
          </div>
          <button onClick={printChecklist} className="btn-secondary gap-2 px-4 py-2 text-sm">
            <Printer size={14} /> Print checklist
          </button>
          {status.complete && (
            <button onClick={onOpenLetter} className="btn-primary gap-2 px-4 py-2 text-sm">
              <Unlock size={14} /> Open the agent letter
            </button>
          )}
        </div>

        {status.missingViewingDate && (
          <p className="mt-3 flex items-center gap-2 text-[13px]" style={{ color: "var(--warn)" }}>
            <CircleAlert size={14} /> Every line is answered — record the date you viewed the property
            below and the letter unlocks.
          </p>
        )}
      </div>

      {/* Paper letterhead — print only. */}
      <div className="print-only" style={{ display: "none" }}>
        <div style={{ borderBottom: "1px solid #000", paddingBottom: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Viewing checklist</div>
          <div style={{ fontSize: 12 }}>{address}</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>
            Date viewed: ______________________ &nbsp;&nbsp; Time: ____________
          </div>
        </div>
      </div>

      {/* When they went. This is the attestation the letter states. */}
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
          The letter says the property was inspected on this date. That is the difference between a
          schedule of defects and an opinion about some photos, so it isn&rsquo;t optional.
        </p>
      </div>

      {items.length === 0 && (
        <div className="card p-5 no-print">
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            Nothing on this property was left unassessed.
          </p>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            Record the date you viewed it and the letter opens. Go anyway — a report that saw
            everything in the photos still hasn&rsquo;t smelled the place.
          </p>
        </div>
      )}

      {groups.map(([group, groupItems]) => (
        <section key={group} className="card p-0 overflow-hidden">
          <h3
            className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)", borderBottom: "1px solid var(--rule)" }}
          >
            {group}
          </h3>
          <div>
            {groupItems.map((it, i) => (
              <Row
                key={it.key}
                item={it}
                record={state.answers[it.key]}
                first={i === 0}
                onAnswer={onAnswer}
                onNote={onNote}
                onOpenLand={onOpenLand}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Row({
  item,
  record,
  first,
  onAnswer,
  onNote,
  onOpenLand,
}: {
  item: ChecklistItem;
  record?: ViewingState["answers"][string];
  first: boolean;
  onAnswer: (key: string, answer: ViewingAnswer | null) => void;
  onNote: (key: string, note: string) => void;
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
              {item.band ? `In the letter — ${item.band}` : SOURCE_NOTE[item.source]}
            </span>
          </div>

          {/* Why it's on the list. Screen only — on paper it is reasoning the
              reader already has in the report, and printing a paragraph of it
              per line turns a clipboard into an essay nobody carries round a
              house. What survives is the label and the instruction. */}
          <p className="mt-1.5 text-[13px] no-print" style={{ color: "var(--text-muted)" }}>
            {item.why}
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            {item.whatToCheck}
          </p>

          {item.source === "document" && (
            <button
              onClick={onOpenLand}
              className="mt-2 text-[13px] font-medium underline no-print"
              style={{ color: "var(--brand)" }}
            >
              Upload it on the Land tab
            </button>
          )}
        </div>

        {answered && (
          <span
            className="no-print flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "var(--surface-2)", color: ANSWER_COLOR[answered], border: "1px solid var(--rule)" }}
          >
            {answered === "ok" ? <Check size={11} /> : answered === "problem" ? <X size={11} /> : <CircleAlert size={11} />}
            {ANSWER_LABEL[answered]}
          </span>
        )}
      </div>

      {/* On screen: the three answers. */}
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

      {/* A confirmed problem and a no-access both end up in the letter, in their
          own words, so the note is where it's worth typing something. */}
      {(answered === "problem" || answered === "no_access") && (
        <div className="mt-3 no-print">
          <textarea
            className="input"
            rows={2}
            value={note}
            onChange={(e) => setNoteLocal(e.target.value)}
            placeholder={
              answered === "problem"
                ? "What you actually saw — the agent's letter quotes this."
                : "Why you couldn't check it, e.g. no subfloor access."
            }
          />
        </div>
      )}

      {/* On paper: boxes and a line to write on. */}
      <div className="print-only" style={{ display: "none", marginTop: 6, fontSize: 11 }}>
        <span style={{ marginRight: 14 }}>☐ No issue</span>
        <span style={{ marginRight: 14 }}>☐ Problem</span>
        <span>☐ Couldn&rsquo;t inspect</span>
        <div style={{ borderBottom: "1px solid #999", height: 16, marginTop: 4 }} />
      </div>
    </div>
  );
}

/**
 * What sits in the "For the agent" tab until the checklist is done.
 *
 * States the reason rather than just refusing — the reader paid for this tab and
 * is entitled to know it's being withheld on their behalf, not upsold.
 */
export function LetterLocked({
  outstanding,
  total,
  missingViewingDate,
  onOpenChecklist,
}: {
  outstanding: number;
  total: number;
  missingViewingDate: boolean;
  onOpenChecklist: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-6 py-14 text-center">
      <div
        className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <Lock size={20} style={{ color: "var(--brand)" }} />
      </div>

      <h2 className="mb-2 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        Go and see the house first
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        {missingViewingDate ? (
          <>
            Every check is answered. Record the date you viewed the property and this opens.
          </>
        ) : (
          <>
            This letter puts a costed schedule of defects in front of a vendor. Right now{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {outstanding} of {total}
            </strong>{" "}
            of its findings rest on things nobody has looked at — the analysis read photographs and said
            so honestly. Sending it in that state is how a real case gets dismissed on the first item
            that turns out to be wrong.
          </>
        )}
      </p>

      <button onClick={onOpenChecklist} className="btn-primary inline-flex px-6 py-3 text-[15px]">
        {missingViewingDate ? "Record the viewing date" : `Open the checklist — ${outstanding} to answer`}
      </button>

      <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Print it, take it to the viewing, tick it off. Anything you genuinely can&rsquo;t inspect is an
        answer too — the letter then says that, instead of claiming it.
      </p>
    </div>
  );
}
