// ============================================================
// The viewing checklist — what has to be settled at the property before
// anything is put to the vendor's agent.
//
// The analysis reads photos. Photos don't show the subfloor, they don't show
// what a switchboard is wired with, and they don't show whether the "probable
// rot" in a Tier-2 read is rot or a shadow. Sending a vendor a costed schedule
// of defects assembled entirely from marketing photographs, before anyone has
// walked through the house, is not a negotiation position — it's a guess with a
// dollar sign on it, and the first thing a competent agent does with it is take
// it apart.
//
// So the letter is locked until this list is answered, and this list is exactly
// the set of things the report itself could not settle:
//
//   ungraded  — the analysis declined to score it (Tier 3, or no photos at all)
//   probable  — Tier 2, and graded critical or urgent, so the LETTER leans on it
//   document  — a LIM / consents / EQC file nobody has uploaded yet
//   gap       — an information gap the analysis flagged in its own words
//
// Nothing here is invented either. Every line traces to an item the report
// assessed (or refused to), and the "what to check" wording tells the reader
// what to physically look at — it never asks them to go and find out something
// we could have fetched ourselves.
// ============================================================

import { ITEM_BY_ID, isVerifiedDocItem } from "@/lib/scoring/catalog";
import { isPhotoAssessable } from "@/lib/viewing/photo-assessable";
import { bandFor, areaLabel, type Band } from "@/lib/negotiation/build";
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
  /** What to physically do about it at the viewing. */
  whatToCheck: string;
  source: CheckSource;
  /** Set when the letter already treats this as a critical/urgent claim. */
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

// ── What to actually check, per item ─────────────────────────────────────────
// Written as an instruction to someone standing at the property with fifteen
// minutes and no ladder. Where a thing needs a professional, it says so rather
// than pretending a buyer can judge it.

const WHAT_TO_CHECK: Record<string, string> = {
  ext_foundation:
    "Open the subfloor hatch (usually under the house or in a hallway cupboard) and look with a torch: rot or splitting in the piles, sagging bearers, standing water, and how much clearance there is to the ground. If there's no access, say so.",
  ext_roof:
    "Look from the ground on all four sides: lifted or rusted sheets, cracked or slipped tiles, moss, patched flashings around the chimney and vents. Ask how old the roof is and whether it's been recoated.",
  ext_cladding:
    "Walk the full perimeter — including the side you can't see from the street. Tap weatherboards for soft spots, look for cracked plaster, staining below windows, and gaps where cladding meets joinery.",
  ext_windows:
    "Open and shut several. Single or double glazed? Rotten sills, fogging between panes, condensation staining on the frames, and whether the catches actually work.",
  ext_decking:
    "Stand on it and bounce. Springy boards, rusted or missing fixings, rot where the deck meets the house, and whether a balustrade over a metre high is solid.",
  ext_gutters:
    "Look for rust, sagging runs, and stains down the wall below a joint. If it's raining, watch where the water actually goes.",
  ext_soffits: "Look up under the eaves for sagging, staining or holes — the first place a roof leak shows.",
  ext_doors: "Open every exterior door: does it swing and latch, is the bottom rail rotten, are the seals intact.",
  ext_paint: "Chalky, flaking or bare timber anywhere, especially on the weather side. Ask when it was last painted.",
  ext_chimney: "Cracked or leaning brickwork, missing mortar, and whether the flashing where it meets the roof has been patched. Ask if the fire has been used recently.",
  ext_retaining: "Leaning, bulging or cracked walls, and whether there's drainage behind them. Anything over 1.5m usually needed a consent — ask for it.",

  bath_waterproof:
    "Press the wall lining beside and behind the shower — soft means water is getting through. Look for lifting vinyl, dark grout, swollen skirting, and a musty smell in the room.",
  bath_shower: "Run it. Check the pressure, whether the door or liner seals, and the state of the grout and silicone.",
  bath_hotwater:
    "Find the cylinder (hot water cupboard, garage or outside) or the gas califont. Read the date on the label, look for rust or a wet tray under it, and run a hot tap to see how long it takes.",
  bath_ventilation: "Is there an extractor fan, and does it vent outside rather than into the ceiling? Switch it on. Mould in the corners means it isn't coping.",
  bath_toilet: "Flush it. Look for movement in the pan, staining on the floor around the base, and a running cistern.",

  kit_appliances: "Turn on the oven, cooktop, rangehood and dishwasher. Ask their age and whether any are being taken by the vendor.",
  kit_cabinetry: "Open drawers and doors — swollen particle board, broken runners, water damage under the sink.",
  kit_benchtop: "Check the joins and the edge behind the sink for swelling or lifting laminate.",
  kit_sink: "Run both taps hard, then look under the sink with a torch for drips, staining or a bucket.",

  liv_insulation:
    "Get into the ceiling cavity if there's a hatch, and look under the house if there's access: is there insulation, is it thick and evenly laid, or is it flattened or missing in patches. Ask for the insulation statement — it's compulsory in every sale.",
  liv_heating: "Turn the heat pump or fire on and let it run. Ask its age, whether the fire has a current compliance certificate, and what the winter power bills look like.",
  liv_fixtures:
    "Find the switchboard. Ceramic rewirable fuses (porcelain, with fuse wire) mean old wiring; modern breakers and an RCD are what you want. Try light switches and a few power points.",
  liv_flooring: "Lift a corner of carpet in a wardrobe if you can, and walk the floors listening for spring or squeak — both suggest what's underneath.",
  liv_ceiling: "Brown rings or bubbling paint mean a leak, current or historic. Ask about any you find.",

  bed_size: "Take a tape measure. A room that won't take a double bed plus a wardrobe isn't a bedroom the market will pay for.",
  bed_windows: "Does every bedroom have an opening window, and does it get any direct sun?",

  gar_construction: "Look at the roof, walls and door of the garage the same way as the house — it's usually the oldest and least maintained structure on the site.",
  gar_floor: "Cracking, oil staining, and whether water runs in under the door.",

  out_drainage: "After rain, look for ponding against the house, and check where the downpipes discharge. Water sitting beside a foundation is the cheapest problem to find and the dearest to ignore.",
  out_driveway: "Cracking, drainage, and whether two cars can actually pass or park.",
  out_fencing: "Leaning or rotten posts, and who owns which boundary — ask the agent.",
  out_retaining: "Leaning, bulging or cracked walls, and whether there's drainage behind them. Anything over 1.5m usually needed a consent — ask for it.",

  loc_noise: "Stand outside for five minutes and listen — traffic, rail, dogs, aircraft. Go back at a different time of day if you can.",
  loc_views: "Check what the outlook actually is from the main living room, and whether a neighbour could build across it.",
  loc_sun: "Note where the sun is when you visit and which rooms get it. Ask which rooms have sun in winter — the answer is usually honest and it matters.",

  land_topography: "Walk the boundaries. How much of the section is actually flat enough to use, and is anything slipping or slumping?",
  land_frontage: "Drive in and out. Shared driveways, rights of way and who maintains them — ask, then check it on the title.",
  land_trees: "Large trees near the house or the drains, and whether any are protected or notable (the council schedule will say).",

  leg_lim:
    "A LIM comes from the council — only they can issue one. Ask the agent first: vendors often order one before marketing and hand copies out, and if it exists it costs you nothing. Check the date on the front, though — a LIM is a snapshot, and one pulled months ago won't show anything registered since. No copy, or an old one? Order your own from the council; anyone can, on any property, for a few hundred dollars and usually about ten working days. Upload it on the Land tab and we'll read it.",
  leg_consents:
    "Ask the council for the property file — it holds the consents and code compliance certificates for every structure, house, garage, deck and sleepout. The agent may already have a copy. Upload what you get on the Land tab.",
  leg_eqc: "Ask the agent or the vendor for the EQC (Toka Tū Ake) claim history and any scope of works or settlement documents — only the owner can request their own claim file, so this one has to come from them. Upload it on the Land tab.",
  leg_title: "Read the record of title: ownership type, easements, covenants and anything registered against it. Your solicitor should see it before you sign.",
  leg_weathertight: "Ask directly whether the house has monolithic cladding and when it was built or reclad. A 1994–2004 plaster house needs a specialist weathertightness inspection, not your eyes.",
  leg_unconsented: "Compare what you can see on site against the council property file — an extra room, a deck, a sleepout or a bathroom that isn't on the plans is unconsented work.",
  leg_bodycorp: "Ask for the body corporate minutes, the levies, the long-term maintenance plan and any pending special levy.",
  leg_crosslease: "Compare the flats plan against what's actually built. Any extension or deck not on the plan makes the title defective, and fixing it costs real money.",
  leg_easements: "Have your solicitor read the easements and covenants — what crosses the land, and what you're not allowed to do on it.",
  leg_encumbrances: "Have your solicitor check for caveats, encumbrances and any registered interest that survives the sale.",
};

/**
 * When we have no specific instruction, say the honest generic thing — and only
 * that. An earlier version appended "Check it while you're in {category}", which
 * reads fine for "the kitchen" and produced "Check it while you're in demand &
 * lifestyle" for the rest. A sentence that is nonsense for a third of the list
 * is worse than no sentence.
 */
function fallbackCheck(s: SubItem): string {
  const cat = ITEM_BY_ID[s.id]?.category;
  const room = cat && ROOMS.has(cat) ? ` Check it while you're in the ${cat.toLowerCase()}.` : "";
  return `Look at this in person and note its condition — it wasn't visible in the listing photos, so nothing in the report is based on seeing it.${room}`;
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

export function buildViewingChecklist(
  report: StoredReport,
  subItems: SubItem[],
  verifiedDocs: Record<string, DocAnalysis> = {}
): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const seen = new Set<string>();
  const landOnly = report.landOnly === true;

  for (const s of subItems) {
    // Location is never on this list. Suburb growth, demand and market trend are
    // desk research; putting "Suburb growth trend & demand" on a list of things
    // to check at an open home is asking somebody to look at a graph through a
    // window. They are also facts-only items that never counted toward the score.
    if (ITEM_BY_ID[s.id]?.inspection === "location") continue;

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
        whatToCheck: WHAT_TO_CHECK[s.id] ?? fallbackCheck(s),
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
        whatToCheck: WHAT_TO_CHECK[s.id] ?? fallbackCheck(s),
        source: "ungraded",
        canPhotograph: isPhotoAssessable(s.id),
        priorSummary: s.aiSummary || undefined,
      });
      seen.add(s.id);
      continue;
    }

    // Graded, but not from a photograph anyone can point at — and the letter puts
    // it to the agent as a costed finding. Tier 2 is a probable read and Tier 3 is
    // an inference from era or record; both are claims that have to survive being
    // questioned, so they get confirmed on site first. Tier 1 needs nothing: the
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
        whatToCheck: WHAT_TO_CHECK[s.id] ?? fallbackCheck(s),
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
      whatToCheck: WHAT_TO_CHECK.ext_foundation,
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
        whatToCheck: `Photograph every bedroom — one wide shot from the doorway each, so all ${bedrooms} are covered. Check size against a double bed plus a wardrobe, whether the window opens, whether there's any fixed heating, and the state of the flooring and ceiling.`,
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
      whatToCheck: photo
        ? "Ask the agent to send a photo of this, or look at it yourself at the viewing, and note what you find."
        : "Ask the agent to confirm this, and write down what they tell you.",
      source: "gap",
      canPhotograph: false,
    });
  }

  return out;
}
