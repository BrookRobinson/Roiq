// ============================================================
// What is actually registered against a title — SERVER ONLY.
//
// "Encumbrances / caveats" was scored 2 out of 2, "Low concern", badged
// "T1 — Confirmed from the public record", against a record nobody had read.
// The free LINZ feed gives the title's TYPE, estate, share and area; the
// instruments — easements, covenants, caveats, mortgages — are somewhere else
// entirely, and the item was being answered by a model looking at photographs.
//
// They are published, and on the same key. Three tables:
//
//   Title Memorial      (52006)  every instrument ever noted on the title,
//                                each flagged CURR or HIST
//   Title Instrument    (52012)  the instrument itself — its number, its type
//   Transaction Type    (52009)  what that type means in English  ← baked in,
//                                see lib/linz/instrument-types.ts
//
// ── CURR vs HIST is the whole safety of this ────────────────────────────────
//
// A title's memorial list is a HISTORY, not a state. NA89C/519 carries fifteen
// memorials, of which five are current: two flat leases and one mortgage. The
// other ten include mortgages long since discharged. Reporting those as live
// would tell a buyer a property is mortgaged to three lenders and hand them a
// negotiating point that does not exist — a false and damaging claim about
// somebody's house, which is exactly the standard the demo-address rule sets.
//
// So only CURR memorials are ever reported, and an instrument we cannot resolve
// is dropped rather than guessed at.
//
// ── What this can and cannot say ────────────────────────────────────────────
//
// It gives the instrument's TYPE, number and date. It does NOT give its TEXT:
// the wording of a covenant lives inside the instrument document, which is a
// paid Landonline download. So the report may say "a land covenant is
// registered against this title, instrument 5638539.1" and must never say what
// the covenant requires. That is still worth having — "ask your solicitor to
// read 5638539.1" is a different instruction from "check for covenants".
// ============================================================

import { INSTRUMENT_TYPES } from "./instrument-types";

/** What an instrument means for somebody buying the place. */
export type EncumbranceKind =
  /** Someone else's right over this land. Stays with it. */
  | "easement"
  /** A restriction on what may be built or done. Stays with it. */
  | "covenant"
  /** A claim freezing the title until it is removed or lapses. */
  | "caveat"
  /** A lease — including, on a cross lease, the flat leases themselves. */
  | "lease"
  /** Discharged on settlement. Real, but not the buyer's burden. */
  | "mortgage"
  /** A charge or notice imposed by statute. */
  | "statutory"
  /** Registered, current, and none of the above. */
  | "other";

export interface Encumbrance {
  /** LINZ's instrument number, e.g. "5638539.1" — quotable to a solicitor. */
  instrumentNo: string;
  /** LINZ's own description of the type, e.g. "Easement Instrument". */
  label: string;
  kind: EncumbranceKind;
  /** When it was lodged, ISO date. Null where LINZ doesn't publish one. */
  lodged: string | null;
}

export interface TitleEncumbrances {
  /** Current instruments only. Never anything flagged HIST. */
  live: Encumbrance[];
  /**
   * How many memorials were discharged, withdrawn or superseded. Reported as a
   * count and nothing more: a mortgage repaid in 1998 is not a finding about
   * this property, but "we looked and found nothing" is a stronger statement
   * when the reader can see the history was read too.
   */
  historicCount: number;
}

/**
 * Classify by LINZ's own words, because the code list is 525 long and growing
 * and a hand-written map of it would rot. Order matters: a "Discharge of
 * Mortgage" must read as a mortgage instrument, and "Partial Withdrawal of
 * Caveat" as a caveat one, so the removal sits in the same family as the thing
 * it removes and the counting stays honest.
 */
export function classifyInstrument(label: string): EncumbranceKind {
  const s = label.toLowerCase();
  if (/caveat/.test(s)) return "caveat";
  if (/easement|right of way/.test(s)) return "easement";
  if (/covenant|building line|building restriction/.test(s)) return "covenant";
  if (/mortgage|charge under the property law|encumbrance instrument/.test(s)) return "mortgage";
  if (/lease|licence to occupy/.test(s)) return "lease";
  if (/statutory land charge|act \d{4}|order in council|gazette|proclamation|taking|vesting/.test(s)) return "statutory";
  return "other";
}

/**
 * Instruments that say nothing about the property.
 *
 * "Default" is LINZ's own placeholder and appears with the instrument number
 * DEFAULTWS; a transfer is how the current owner came to own it, which is not a
 * burden on the next one. Both would pad the list and make a clean title look
 * encumbered.
 */
function isNoise(label: string, instrumentNo: string): boolean {
  if (/^default/i.test(instrumentNo)) return true;
  const s = label.toLowerCase();
  return s === "default" || /^transfer$/.test(s) || /^transmission/.test(s);
}

/**
 * The instruments currently registered against a title.
 *
 * Best-effort like every other LINZ lookup: a failure returns null and the
 * report says it could not read the register, rather than saying the title is
 * clear. Those are very different statements and only one of them is safe.
 */
export async function lookupEncumbrances(
  titleNo: string,
  wfs: <T>(table: string, cql: string, count?: number) => Promise<T[]>
): Promise<TitleEncumbrances | null> {
  const memorials = await wfs<{ act_tin_id_crt?: number; curr_hist_flag?: string }>(
    "table-52006",
    `ttl_title_no = '${titleNo.replace(/'/g, "''")}'`,
    250
  );
  if (memorials.length === 0) return null;

  const current = new Set<number>();
  let historic = 0;
  for (const m of memorials) {
    if (typeof m.act_tin_id_crt !== "number") continue;
    if (m.curr_hist_flag === "CURR") current.add(m.act_tin_id_crt);
    else historic++;
  }
  if (current.size === 0) return { live: [], historicCount: historic };

  const ids = [...current].join(",");
  const instruments = await wfs<{
    id?: number;
    inst_no?: string;
    trt_grp?: string;
    trt_type?: string;
    lodged_datetime?: string;
  }>("table-52012", `id IN (${ids})`, 250);

  const live: Encumbrance[] = [];
  for (const i of instruments) {
    if (!i.inst_no || !i.trt_grp || !i.trt_type) continue;
    // An unmapped code is dropped, not printed raw. "TINT/QQ" against somebody's
    // house is the zoning rule again: a code the reader cannot decode is worse
    // than an honest gap, because it looks like a finding.
    const label = INSTRUMENT_TYPES[`${i.trt_grp}/${i.trt_type}`];
    if (!label || isNoise(label, i.inst_no)) continue;
    live.push({
      instrumentNo: i.inst_no,
      label,
      kind: classifyInstrument(label),
      lodged: i.lodged_datetime ? i.lodged_datetime.slice(0, 10) : null,
    });
  }

  // Worst first, so a caveat is never below a lease in a truncated list.
  const ORDER: EncumbranceKind[] = ["caveat", "covenant", "easement", "statutory", "lease", "mortgage", "other"];
  live.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.instrumentNo.localeCompare(b.instrumentNo));

  return { live, historicCount: historic };
}

/**
 * The instruments that actually BURDEN a buyer.
 *
 * A mortgage is discharged on settlement and a lease on a cross lease IS the
 * tenure — neither is something the purchaser inherits as a restriction, and
 * counting them would make every ordinary house look encumbered.
 */
export function burdens(enc: TitleEncumbrances): Encumbrance[] {
  return enc.live.filter((e) => e.kind !== "mortgage" && e.kind !== "lease");
}
