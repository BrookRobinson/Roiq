// ============================================================
// The summary at the foot of an item card — one or two sentences.
//
// The first says WHEN work is due and what it costs, because that is the thing
// a buyer acts on. It is built from the same life and cost the valuation above
// shows, never from the analysis's prose, so the summary can't promise ten
// years that the life bar says are three.
//
// The second is the finding behind it: the defect if there is one, otherwise
// the first thing the photographs showed.
//
// Dependency-free so a verify script can load it with plain node.
// ============================================================

export interface SummaryInput {
  /** Years of life left on the valuation's own reading; negative = overdue. */
  yearsRemaining: number | null;
  /** What it costs to replace today, all in. */
  replaceCost: number | null;
  /** The condition read, 1–10, or null when unassessed. */
  score: number | null;
  holdYears: number;
  /** What needs work, when anything does. */
  defect?: string | null;
  /** What the photos show, first line most important. */
  evidence?: string[];
  /** Items with no cost line (layout, size, light) are stated facts. */
  factOnly?: boolean;
  /** The analysis's own prose — used only for fact-only items. */
  aiSummary?: string;
  now?: Date;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const firstSentence = (t: string) => (t.match(/^[^.!?]+[.!?]?/)?.[0] ?? t).trim().replace(/[.!?]?$/, ".");
const years = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;

export function itemSummary(i: SummaryInput): string {
  if (i.factOnly) {
    const s = (i.aiSummary ?? "").match(/[^.!?]+[.!?]+/g) ?? [];
    return s.slice(0, 2).join(" ").trim() || "Stated as a fact about the property, not priced.";
  }

  const year = (i.now ?? new Date()).getFullYear();
  // A clause, not a sentence, so the summary stays at two.
  const cost = i.replaceCost && i.replaceCost > 0 ? ` — about ${money(i.replaceCost)} to replace today` : "";

  let when: string;
  if (i.score == null) {
    when = "Not assessed from the photographs, so there is no reading of when it will need work.";
  } else if (i.yearsRemaining == null) {
    when =
      i.score <= 4 ? "Needs work now."
      : i.score <= 7 ? "Serviceable for now, but it will need work within the next several years."
      : "In good order, with no work expected soon.";
  } else if (i.yearsRemaining < -10) {
    // "Overdue by 37 years" is arithmetic, not advice. Past a decade the
    // number stops meaning anything to a buyer; the message is: now.
    when = `Well past the end of its life, so budget to replace it now${cost}.`;
  } else if (i.yearsRemaining < 0) {
    when = `Replacement is overdue by about ${years(Math.round(-i.yearsRemaining))}${cost}.`;
  } else if (i.yearsRemaining < 1) {
    when = `Due for replacement now${cost}.`;
  } else {
    const n = Math.round(i.yearsRemaining);
    const hold = n <= i.holdYears ? `inside your ${i.holdYears}-year hold` : `beyond your ${i.holdYears}-year hold`;
    when =
      n > 40
        ? `No replacement expected for decades — about ${years(n)} of life left.`
        : `Needs replacing in about ${years(n)} (around ${year + n}), ${hold}${n <= i.holdYears ? cost : ""}.`;
  }

  // Work needed NOW outranks the replacement date: a roof with ten years left
  // and two lifted sheets needs a roofer this month.
  const finding = i.defect?.trim()
    ? `${i.score != null && i.score <= 4 ? "Needs attention now: " : "Worth watching: "}${lower(firstSentence(i.defect))}`
    : i.evidence?.[0]
      ? firstSentence(i.evidence[0])
      : "";

  return [when, finding].filter(Boolean).join(" ");
}

const lower = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
