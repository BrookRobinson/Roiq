// ============================================================
// The viewing checklist — what the photographs could not settle, and what to go
// and look at yourself.
//
// The analysis reads photos. Photos don't show the subfloor, they don't show
// what a switchboard is wired with, and they don't show whether the "probable
// rot" in a Tier-2 read is rot or a shadow. A costed schedule assembled entirely
// from marketing photographs is a guess with a dollar sign on it.
//
// So the report says what it could not settle, and this list is exactly that
// set:
//
//   ungraded  — the analysis declined to score it (Tier 3, or no photos at all)
//   probable  — Tier 2, and graded critical or urgent, so the money leans on it
//   document  — a LIM / consents / EQC file nobody has uploaded yet
//   gap       — an information gap the analysis flagged in its own words
//
// Nothing here is invented either. Every line traces to an item the report
// assessed (or refused to), and the "what to check" wording tells the reader
// what to physically look at — it never asks them to go and find out something
// we could have fetched ourselves.
// ============================================================

import { ITEM_BY_ID, isVerifiedDocItem } from "@/lib/scoring/catalog";
import { CHECK_GUIDE, type CheckGuide } from "./how-to-check";

/**
 * How bad a 1–10 condition score is, and where the item lives in the report.
 *
 * These moved here when the agent letter was removed — they were part of
 * building that document, and this list is now their only caller. Same numbers,
 * same thresholds: a line that was picked because the money leaned on it is
 * still picked for exactly the same reason, because it is still the finding a
 * buyer most needs to confirm with their own eyes.
 */
export type Band = "critical" | "urgent";

export const bandFor = (score: number): Band | null =>
  score <= 2 ? "critical" : score <= 4 ? "urgent" : null;

export const areaLabel = (id: string): string => {
  const inspection = ITEM_BY_ID[id]?.inspection;
  if (inspection === "improvements") return ITEM_BY_ID[id]?.category ?? "Building";
  if (inspection === "land") return "Land";
  if (inspection === "legal") return "Legal & title";
  if (inspection === "location") return "Location";
  return "Property";
};
import { isPhotoAssessable } from "@/lib/viewing/photo-assessable";
import type { SubItem } from "@/lib/property-tab/types";
import type { StoredReport, DocAnalysis } from "@/lib/report-store";

// The gate and the per-item rule live in ./status — dependency-free, so
// `npm run verify:viewing` can load them with plain node.
export {
  EMPTY_VIEWING,
  ANSWER_LABEL,
  checklistStatus,
  dispositionFor,
} from "./status";
export type {
  ViewingAnswer,
  ViewingRecord,
  ViewingState,
  ChecklistStatus,
  Disposition,
} from "./status";

export type { CheckGuide };

export type CheckSource = "ungraded" | "probable" | "document" | "gap";

export interface ChecklistItem {
  /** Stable key the answer is filed under. Survives a re-render, not a re-analysis. */
  key: string;
  /** Scoring item id, when the line maps to one. */
  itemId?: string;
  label: string;
  /** Heading it sits under — the item's own category, or "Paperwork". */
  group: string;
  /** Why it's on the list, in the report's terms. */
  why: string;
  /**
   * The three blocks the card is built from: what we don't know, what to do
   * about it in order, and what to photograph. See lib/viewing/how-to-check.ts.
   */
  guide: CheckGuide;
  source: CheckSource;
  /** Set when the report already treats this as a critical/urgent claim. */
  band?: Band;
  /**
   * True when a photograph would actually settle this. The buyer can then upload
   * one and have the item assessed properly, rather than only recording their own
   * opinion of it — see components/Viewing/ItemPhotoUpload.tsx.
   */
  canPhotograph: boolean;
  /** What the desktop analysis said, handed to the model alongside the photos. */
  priorSummary?: string;
}


/**
 * When we have no specific instruction, say the honest generic thing — and only
 * that. An earlier version appended "Check it while you're in {category}", which
 * reads fine for "the kitchen" and produced "Check it while you're in demand &
 * lifestyle" for the rest. A sentence that is nonsense for a third of the list
 * is worse than no sentence.
 */
/**
 * For an item with no hand-written guide.
 *
 * Deliberately vague, because a generic instruction that PRETENDED to be
 * specific would be worse than one that admits it is generic — "check the
 * flashings" on an item nobody wrote flashings for is how invented advice gets
 * into a checklist somebody carries round a house.
 */
function fallbackGuide(s: SubItem): CheckGuide {
  const cat = ITEM_BY_ID[s.id]?.category;
  const room = cat && ROOMS.has(cat) ? `, while you're in the ${cat.toLowerCase()}` : "";
  return {
    concern: "It wasn't visible in the listing photos, so nothing in the report is based on seeing it.",
    steps: [
      `Find it and look at it in person${room}.`,
      "Note its condition and anything obviously wrong.",
    ],
    photos: ["The item, clearly enough to identify it"],
  };
}

/** Categories that name somewhere you physically stand. */
const ROOMS = new Set(["Kitchen", "Bathroom", "Living areas", "Bedrooms", "Garage"]);

function groupOf(id: string): string {
  const item = ITEM_BY_ID[id];
  if (!item) return "Other";
  if (item.inspection === "improvements") return item.category;
  if (item.inspection === "legal") return "Paperwork";
  if (item.inspection === "land") return "Land & site";
  return "Location";
}

/**
 * Every unknown on this property, as one list.
 *
 * @param report      the stored report
 * @param subItems    the EFFECTIVE sub-items (post verified-doc override), so an
 *                    uploaded LIM removes its own line instead of standing there
 *                    asking for a document that's already in.
 */
/** True once the buyer has photographed the item and had it assessed. */
const verifiedPhoto = (subItems: SubItem[], id: string) =>
  subItems.find((s) => s.id === id)?.evidenceSource?.startsWith("Your own photo") ?? false;

/**
 * Items that describe a BUILDING, and so mean nothing on a bare section.
 *
 * A 5,002m² Hokitika paddock came back with "Weathertightness history
 * (leaky-building era 1994–2004)" on its viewing checklist. The analysis had
 * already said "not applicable — no dwelling on site" and left it unscored, and
 * unscored is precisely what puts a line on this list — so an honest refusal to
 * score it turned into an instruction to go and inspect the weathertightness of
 * a building that isn't there.
 *
 * Deliberately narrow. EQC stays (the land itself carries claim history) and so
 * do consents (what you may build is the whole question on a section); only the
 * ones that are meaningless without a dwelling are dropped.
 */
const DWELLING_ONLY_ITEMS = new Set(["leg_weathertight", "leg_crosslease", "leg_bodycorp"]);

export function buildViewingChecklist(
  report: StoredReport,
  subItems: SubItem[],
  verifiedDocs: Record<string, DocAnalysis> = {}
): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const seen = new Set<string>();
  const landOnly = report.landOnly === true;
  /** Anything built on the site — a shed, sleepout or garage still needed consent. */
  const hasStructure = (report.extraDwellings?.length ?? 0) > 0;
  const tt = report.listing?.titleType;
  const titleTypeKnown = Boolean(tt) && tt !== "unknown";

  for (const s of subItems) {
    // Nothing that describes a building belongs on a bare section's list.
    if (landOnly && DWELLING_ONLY_ITEMS.has(s.id)) continue;

    // Location is never on this list. Suburb growth, demand and market trend are
    // desk research; putting "Suburb growth trend & demand" on a list of things
    // to check at an open home is asking somebody to look at a graph through a
    // window. They are also facts-only items that never counted toward the score.
    if (ITEM_BY_ID[s.id]?.inspection === "location") continue;

    // The TITLE TYPE is already known when the register answered — it comes from
    // LINZ, which is the authority, and the report prints it in its own header
    // (lib/linz/property-records.ts). Asking the buyer to go and obtain a title
    // to confirm a fact stated at the top of their own report is exactly the
    // homework this product exists to remove.
    //
    // Read from the LISTING rather than the item's score, deliberately. The
    // model is not consistent about this: on one report it scored leg_title 9/10
    // tier 1 "Freehold", and on another — same known freehold tenure — it
    // returned "Not assessed, not visible in the listing" and no score, which
    // put the ask straight back on the list. The title type is a fact we hold or
    // don't; it is not the model's to forget.
    //
    // What a record of title carries BEYOND the type — easements, covenants,
    // caveats — is a different question with its own items (leg_easements,
    // leg_encumbrances), which reach this list on their own merits.
    if (s.id === "leg_title" && titleTypeKnown) continue;

    // Consents and code compliance describe work that was done to a STRUCTURE.
    // On a bare section with nothing built there is no consent history to
    // produce and no CCC to chase, and the analysis says so itself — asking for
    // the council property file on an empty paddock is a job with no possible
    // answer. It stays the moment anything is on the land: a shed, a sleepout, a
    // garage, any of which may have needed a consent it never got.
    if (s.id === "leg_consents" && landOnly && !hasStructure) continue;

    // Paperwork: a document item is settled by uploading the document, not by
    // looking at the house — but it's still an unknown until someone does.
    if (isVerifiedDocItem(s.id) || s.id === "leg_title") {
      const doc = verifiedDocs[s.id];
      if (doc?.docTypeConfirmed) continue;
      out.push({
        key: s.id,
        itemId: s.id,
        label: s.name || ITEM_BY_ID[s.id]?.label || s.id,
        group: "Paperwork",
        why: "No document has been uploaded, so this is unscored — the report has not seen it.",
        guide: CHECK_GUIDE[s.id] ?? fallbackGuide(s),
        source: "document",
        canPhotograph: false,
      });
      seen.add(s.id);
      continue;
    }

    // Ungraded — the analysis refused to put a number on it.
    if (s.score === null) {
      out.push({
        key: s.id,
        itemId: s.id,
        label: s.name || ITEM_BY_ID[s.id]?.label || s.id,
        group: groupOf(s.id),
        why: s.noPhotoNotAssessed
          ? "The listing had no photos, so this was never assessed."
          : s.confidenceTier === 3
            ? `Not visible in any photo. ${s.aiSummary || ""}`.trim()
            : "Not assessed from the listing.",
        guide: CHECK_GUIDE[s.id] ?? fallbackGuide(s),
        source: "ungraded",
        canPhotograph: isPhotoAssessable(s.id),
        priorSummary: s.aiSummary || undefined,
      });
      seen.add(s.id);
      continue;
    }

    // Graded, but not from a photograph anyone can point at — and the report
    // still costs it. Tier 2 is a probable read and Tier 3 is an inference from
    // era or record; both are claims that have to survive being questioned, so
    // they get confirmed on site first. Tier 1 needs nothing: the
    // photograph is in the report and the agent can look at it.
    const band = bandFor(s.score);
    if (band && s.confidenceTier >= 2) {
      const basis = s.confidenceTier === 2 ? "a probable read" : "an inference, with nothing visible to confirm it";
      out.push({
        key: s.id,
        itemId: s.id,
        label: s.name || ITEM_BY_ID[s.id]?.label || s.id,
        group: groupOf(s.id),
        why: `Graded ${band} (${s.score}/10) from ${basis}. ${s.observedDefect || s.aiSummary || ""}`.trim(),
        guide: CHECK_GUIDE[s.id] ?? fallbackGuide(s),
        source: "probable",
        band,
        canPhotograph: isPhotoAssessable(s.id),
        priorSummary: s.observedDefect || s.aiSummary || undefined,
      });
      seen.add(s.id);
    }
  }

  // The subfloor, always. Its condition is the one thing the report NEVER sees —
  // rot, borer, settlement and subfloor moisture are all under the floor, and the
  // score is computed from type, era and movement visible inside precisely
  // because no listing photographs the piles. A photo through the hatch is worth
  // more than every other line on this list.
  if (!landOnly && !seen.has("ext_foundation") && !verifiedPhoto(subItems, "ext_foundation")) {
    const found = subItems.find((s) => s.id === "ext_foundation");
    out.push({
      key: "ext_foundation",
      itemId: "ext_foundation",
      label: "Foundation / subfloor",
      group: "Exterior",
      why:
        found?.aiSummary?.trim() ||
        "The foundation type is read from the perimeter, but no listing photograph shows under the floor — so its condition has never been seen.",
      guide: CHECK_GUIDE.ext_foundation,
      source: "ungraded",
      canPhotograph: true,
      priorSummary: found?.aiSummary || undefined,
    });
    seen.add("ext_foundation");
  }

  // Rooms the listing never photographed. A four-bedroom house advertised with
  // one bedroom in shot is not a report on four bedrooms, and saying nothing
  // about that lets the score stand on a room nobody has seen.
  const bedrooms = report.listing.bedrooms ?? 0;
  if (bedrooms > 1) {
    const shots = new Set(
      subItems.filter((s) => s.id.startsWith("bed_")).flatMap((s) => s.photoReferences ?? [])
    );
    // AT MOST, deliberately. These are photo numbers, not rooms, and a listing
    // routinely shoots one bedroom from two angles — counting them as two rooms
    // is the exact mistake this line exists to catch, so it must not make it
    // itself. Claiming "the other 2 bedrooms" when 3 were never shown is worse
    // than declining to put a number on it.
    const missing = bedrooms - shots.size;
    if (missing > 0) {
      out.push({
        key: "rooms:bedrooms",
        label: "The bedrooms the listing didn't show",
        group: "Bedrooms",
        why: `The listing advertises ${bedrooms} bedrooms. The photographs show at most ${shots.size} of them${shots.size > 1 ? " — and two shots of one room is a common way that count reads high" : ""}, so every bedroom score in this report rests on ${shots.size === 0 ? "no photograph at all" : "what little was photographed"}.`,
        guide: {
          concern: `The listing shows at most ${shots.size} of ${bedrooms} bedrooms, so the rest are unassessed.`,
          steps: [
            "Walk into every bedroom, including the ones the listing skipped.",
            "Pace each for size against a double bed plus a wardrobe, and open the window.",
            "Check for fixed heating, and look at the flooring and the ceiling corners.",
          ],
          photos: [`One wide shot from the doorway of each bedroom — all ${bedrooms}`],
        },
        source: "gap",
        canPhotograph: false,
      });
    }
  }

  // The analysis's own flagged gaps. These are questions for the agent rather
  // than things to go and look at — the listing didn't show it, so the fastest
  // route is usually to ask the person selling the house. Grouped separately for
  // that reason: it's a different errand from walking the property, and mixing
  // the two is how a checklist stops being used.
  for (const [i, g] of (report.gaps ?? []).entries()) {
    const label = g.area || `Gap ${i + 1}`;
    if (seen.has(g.area)) continue;
    const photo = /photo/i.test(g.gapType);
    out.push({
      key: `gap:${g.area || i}`,
      label,
      group: "Questions for the agent",
      why: g.description,
      guide: {
        concern: g.description,
        ask: photo
          ? `Can you send me a photo of ${label.toLowerCase()}?`
          : `Can you confirm ${label.toLowerCase()}?`,
        steps: photo
          ? [
              "Ask the agent — this is the fastest route, and they can usually answer by email.",
              "Or look at it yourself at the viewing and write down what you find.",
            ]
          : ["Ask the agent, and write down what they tell you."],
        photos: photo ? ["It, if you get to see it yourself"] : [],
      },
      source: "gap",
      canPhotograph: false,
    });
  }

  return out;
}
