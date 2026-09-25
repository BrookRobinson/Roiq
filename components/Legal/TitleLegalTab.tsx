"use client";

// ============================================================
// Title & legal — what a buyer hands their solicitor.
//
// This used to be ten cards in one worst-first list on the Land tab, each with
// a mark out of ten: "Easements 7/10", "Moderate — verify". It mixed three
// different kinds of thing — facts off the register, risks we inferred, and
// documents nobody had given us — and the scores meant nothing for a legal
// fact. It is three plain groups now:
//
//   1  WHAT THE TITLE SAYS   — read from LINZ, stated, with what it means.
//   2  RISKS TO CHECK        — low / check / problem, with the reason and,
//                              where it can be fixed, the cost in the plan.
//   3  DOCUMENTS YOU CAN ADD — the LIM, consents and EQC history, one panel.
// ============================================================

import type { SubItem } from "@/lib/property-tab/types";
import type { DocAnalysis } from "@/lib/report-store";
import type { TitleEncumbrances, Encumbrance } from "@/lib/linz/encumbrances";
import { ITEM_BY_ID, VERIFIED_DOC_ITEMS } from "@/lib/scoring/catalog";
import { DocUpload } from "@/components/PropertyInspections/DocUpload";
import { legalItemApplies } from "@/lib/scoring/applies";
import { ArrowRight, Check, FileText } from "lucide-react";

const TITLE_ITEMS = ["leg_title", "leg_easements", "leg_encumbrances"];

/** What each kind of registered instrument means for the person buying. */
const MEANS: Record<Encumbrance["kind"], string> = {
  easement:
    "Somebody else has a registered right over part of this land — most often a drain, a power line or a shared driveway. It stays with the land, and you generally can't build over it.",
  covenant: "A restriction on what may be built or done here — height, cladding, a second dwelling. It binds you as the next owner.",
  caveat: "A formal claim by someone other than the owner. Nothing can be transferred to you while it stands; it must be removed before settlement.",
  mortgage: "The vendor's loan. It is repaid and removed at settlement — normal on almost every sale.",
  lease: "Someone has a registered right to occupy part or all of the land. Find out who, and for how long.",
  statutory: "A charge or notice imposed by law. It stays with the land; your solicitor can read its terms.",
  other: "A registered instrument we can name but not interpret. Give the number to your solicitor.",
};

type Status = "low" | "check" | "problem" | "unknown";
const STATUS: Record<Status, { label: string; color: string; wash: string }> = {
  low: { label: "Low risk", color: "var(--good)", wash: "var(--good-wash)" },
  check: { label: "Check", color: "var(--warn)", wash: "var(--warn-wash)" },
  problem: { label: "Problem", color: "var(--bad)", wash: "var(--bad-wash)" },
  unknown: { label: "Not established", color: "var(--text-muted)", wash: "var(--surface-2)" },
};
/**
 * A low-confidence read is never a Problem. "The studio MAY be unconsented",
 * inferred from a photo, is something to check — calling it a problem states
 * as established what nobody has established.
 */
const statusOf = (score: number | null, tier?: number): Status => {
  const s: Status = score == null ? "unknown" : score >= 8 ? "low" : score >= 5 ? "check" : "problem";
  return s === "problem" && tier === 3 ? "check" : s;
};

/**
 * The first sentence that SAYS something. The analysis writes legal items as
 * "Source: … Finding: …", and cutting at the first full stop turned "Built
 * c. 1975" into "Built c." — so sentences only break before a capital, and a
 * "Source:" line is skipped (the source has its own line).
 */
const lead = (t: string | undefined): string => {
  const parts = (t ?? "").split(/(?<=[.!?])\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
  return parts.find((x) => !/^source\b/i.test(x)) ?? "";
};
const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const dateNZ = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-NZ", { year: "numeric", month: "short" }) : null);

/** What a buyer calls each kind — LINZ's own labels read "Easement Instrument". */
const HEADING: Record<Encumbrance["kind"], string> = {
  easement: "Easement",
  covenant: "Covenant",
  caveat: "Caveat — must be removed before settlement",
  mortgage: "Mortgage (the vendor's)",
  lease: "Registered lease",
  statutory: "Statutory charge or notice",
  other: "Registered instrument",
};

const DOC_ABOUT: Record<string, { name: string; answers: string }> = {
  leg_lim: { name: "LIM report", answers: "Council's record of the property: consents, hazards, rates, outstanding notices." },
  leg_consents: { name: "Building consents / CCC", answers: "Whether the building work — including any additions — was consented and signed off." },
  leg_eqc: { name: "EQC / insurance claim history", answers: "Past earthquake or insurance claims, and whether repairs were completed." },
};

export function TitleLegalTab({
  subItems,
  buildYear,
  region,
  city,
  statedBodyCorporate,
  unconsentedSignal,
  knownUnconsented = false,
  titleType,
  encumbrances,
  burdens = [],
  verifiedDocs = {},
  onVerified,
  onSeeRenovations,
}: {
  subItems: SubItem[];
  buildYear?: number | null;
  /** For whether EQC and a body corporate apply at all. */
  region?: string | null;
  city?: string | null;
  statedBodyCorporate?: boolean;
  /** Another structure found, or a floor-area gap — see lib/scoring/applies.ts. */
  unconsentedSignal?: boolean;
  /** A structure the listing or a document says is unconsented. Without one, consent is assumed. */
  knownUnconsented?: boolean;
  titleType?: string | null;
  encumbrances?: TitleEncumbrances | null;
  /** Surveyed easement / covenant areas drawn on the section. */
  burdens?: { kind: string; appellation: string | null }[];
  verifiedDocs?: Record<string, DocAnalysis>;
  onVerified?: (itemId: string, doc: DocAnalysis) => void;
  onSeeRenovations: () => void;
}) {
  const applies = (id: string, item?: SubItem) =>
    legalItemApplies(id, { titleType, statedBodyCorporate, region, city, unconsentedSignal }, item);
  const legal = subItems.filter((s) => ITEM_BY_ID[s.id]?.inspection === "legal" && applies(s.id, s));
  const docs = VERIFIED_DOC_ITEMS.filter((id) => applies(id));
  const byId = (id: string) => legal.find((s) => s.id === id);
  const risks = legal.filter(
    (s) =>
      !TITLE_ITEMS.includes(s.id) &&
      !(VERIFIED_DOC_ITEMS as readonly string[]).includes(s.id) &&
      !outOfLeakyEra(s, buildYear)
  );
  const title = byId("leg_title");
  const registerRead = !!encumbrances && encumbrances.memorialsFound > 0;
  const docsHeld = docs.filter((id) => verifiedDocs[id]).length;
  // Consent can't be looked up, so it is ASSUMED unless something says
  // otherwise: the risk stays as a Check with a request to confirm it, never a
  // Problem and never a Certificate of Acceptance priced against a guess.
  const assumedConsented = (s: SubItem) =>
    s.id === "leg_unconsented" && !knownUnconsented && s.confidenceTier !== 1;
  const riskStatus = (s: SubItem): Status =>
    assumedConsented(s) ? "check" : statusOf(s.score, s.confidenceTier);
  const firstEasement = registerRead ? encumbrances!.live.findIndex((e) => e.kind === "easement") : -1;

  return (
    <div className="space-y-4">
      {/* ── 1 What the title says ───────────────────────────────────────── */}
      <Group n={1} title="What the title says" sub="Read from the LINZ record of title. These are facts, not opinions.">
        {title && (
          <Fact
            head={title.finding || title.condition}
            body={lead(title.aiSummary)}
            source={title.evidenceSource || "LINZ record of title"}
          />
        )}
        {registerRead ? (
          encumbrances!.live.length ? (
            encumbrances!.live.map((e, i) => (
              <Fact
                key={e.instrumentNo}
                head={HEADING[e.kind]}
                body={
                  MEANS[e.kind] +
                  // The surveyed area IS this easement on the ground — one line, not two.
                  (e.kind === "easement" && i === firstEasement && burdens.length
                    ? ` Its surveyed area is drawn on the section plan on the Land tab (${burdens.map((b) => b.appellation ?? b.kind).join(", ")}).`
                    : "")
                }
                source={`Instrument ${e.instrumentNo}${e.lodged ? `, lodged ${dateNZ(e.lodged)}` : ""} — LINZ register`}
                tone={e.kind === "caveat" ? "bad" : undefined}
              />
            ))
          ) : (
            <Fact head="Nothing registered against the title" body="No easements, covenants, caveats or charges are current on the register." source="LINZ record of title — current memorials" />
          )
        ) : (
          // The register wasn't published for this title — about 17% aren't.
          // An empty list here would read as a clean title, so it says so.
          <Fact
            head="The register of instruments isn't published for this title"
            body="LINZ publishes no memorials for about one title in six, and from outside that looks the same as a clean title. A title search, from LINZ or through your solicitor, shows every easement, covenant and caveat."
            source="LINZ record of title"
            tone="muted"
          />
        )}
        {(!registerRead || firstEasement < 0) && burdens.map((b, i) => (
          <Fact
            key={`b${i}`}
            head={`${b.kind === "Easement" ? "Surveyed easement area" : b.kind} on the section${b.appellation ? ` — ${b.appellation}` : ""}`}
            body="Drawn on the section plan on the Land tab. You generally can't build over it."
            source="LINZ non-primary parcels (surveyed)"
          />
        ))}
      </Group>

      {/* ── 2 Risks to check ────────────────────────────────────────────── */}
      <Group n={2} title="Risks to check" sub="What we can see or infer. Each says how sure we are and why.">
        {risks.length === 0 && (
          <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Nothing to flag. There's no second dwelling or structure on the site, and nothing in the listing, the
            photos or the public record points to a title or consent risk.
          </div>
        )}
        {[...risks]
          .sort((a, b) => order(riskStatus(a)) - order(riskStatus(b)))
          .map((s) => {
            const st = STATUS[riskStatus(s)];
            const assumed = assumedConsented(s);
            return (
              <div key={s.id} className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: st.wash, color: st.color, minWidth: 92, textAlign: "center" }}
                >
                  {st.label}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {ITEM_BY_ID[s.id]?.label.replace(/\s*\(.*\)$/, "").replace(/\s+risk$/i, "")}
                    {/* Only a legal FINDING goes here. Without one, the fallback was
                        the condition label — "Very poor — replace urgently" on a
                        weathertightness risk — which is repair wording, not a finding. */}
                    {s.finding ? `: ${s.finding.replace(/^flagged:\s*/i, "")}` : ""}
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {lead(s.aiSummary)}
                  </div>
                  {assumed && (
                    <div className="text-[12px] mt-1 font-medium" style={{ color: "var(--warn)" }}>
                      We&apos;ve assumed it was consented. Please check this: council consent records aren&apos;t
                      public, so the LIM or the council property file is where to confirm it.
                    </div>
                  )}
                  {s.remediation && !assumed && (
                    <button
                      onClick={onSeeRenovations}
                      className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium"
                      style={{ color: "var(--brand)" }}
                    >
                      {s.remediation.renovationLineItem}: {fmt(s.remediation.low)}–{fmt(s.remediation.high)}, in your renovation plan
                      <ArrowRight size={11} />
                    </button>
                  )}
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Source: {s.evidenceSource || s.source}
                  </div>
                </div>
              </div>
            );
          })}
      </Group>

      {/* ── 3 Documents you can add ─────────────────────────────────────── */}
      <Group
        n={3}
        title="Documents you can add"
        sub={`${docsHeld} of ${docs.length} added. ${(docs as readonly string[]).includes("leg_eqc") ? "Councils and EQC don't" : "Councils don't"} publish these as data, so we can only read them if you add them — anything they turn up goes into the groups above.`}
      >
        {docs.map((id) => {
          const doc = verifiedDocs[id];
          const about = DOC_ABOUT[id];
          return (
            <div key={id} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0" style={{ color: doc ? "var(--good)" : "var(--text-muted)" }}>
                {doc ? <Check size={15} /> : <FileText size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{about.name}</div>
                <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{about.answers}</div>
                {doc ? (
                  <div className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--text-muted)" }}>Read {doc.fileName}: </span>
                    {doc.summary}
                    {doc.redFlags.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {doc.redFlags.map((f, i) => (
                          <li key={i} style={{ color: "var(--bad)" }}>— {f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                {onVerified && (
                  <div className="mt-1.5">
                    <DocUpload itemId={id} label={doc ? "Replace document" : `Add ${about.name}`} onVerified={(d) => onVerified(id, d)} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Group>
    </div>
  );
}

/**
 * Weathertightness is a question about the leaky-building era, 1994–2004. On a
 * house built outside it, "low risk, pre-leaky era" is a line telling the
 * reader about a problem this house doesn't have. It stays when the build year
 * is unknown, and whenever the analysis actually flagged a concern — monolithic
 * cladding on a later extension can put an older house in the era.
 */
function outOfLeakyEra(s: SubItem, buildYear?: number | null): boolean {
  if (s.id !== "leg_weathertight" || !buildYear) return false;
  const inEra = buildYear >= 1994 && buildYear <= 2004;
  const flagged = s.score != null && s.score <= 7;
  return !inEra && !flagged;
}

const order = (s: Status) => ({ problem: 0, check: 1, unknown: 2, low: 3 })[s];

function Group({ n, title, sub, children }: { n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <span
          className="mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: "var(--accent-wash)", color: "var(--accent-text)" }}
        >
          {n}
        </span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{title}</span>
      </div>
      <p className="text-[12px] mt-1 mb-4" style={{ color: "var(--text-muted)" }}>{sub}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Fact({ head, body, source, tone }: { head: string; body?: string; source: string; tone?: "bad" | "muted" }) {
  return (
    <div>
      <div className="text-[13px] font-medium" style={{ color: tone === "bad" ? "var(--bad)" : tone === "muted" ? "var(--text-secondary)" : "var(--text-primary)" }}>
        {head}
      </div>
      {body && <div className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{body}</div>}
      <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Source: {source}</div>
    </div>
  );
}
