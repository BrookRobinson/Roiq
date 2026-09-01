// A realistic demo report (14 Ferndale Road, Remuera) powered by the REAL v3.1
// engine, so dashboard demo links (/report/rpt_001) showcase the persona toggle
// genuinely recomputing — not a hardcoded number.

import type { StoredReport } from "@/lib/report-store";
import type { SubItem, ExtraDwelling, UrgencyScore, Remediation, SpecTier } from "@/lib/property-tab/types";
import { urgencyLabel } from "@/lib/property-tab/types";
import { emptyListing } from "@/lib/scraper/types";
import { SCORING_MODEL, usesSpecTier } from "./model";
import { SOURCE_TAXONOMY } from "./catalog";
import { scoreBoth, type Assessment } from "./report";
import { readSiteLayout } from "./site-layout";

// Hand-tuned 1–10 scores telling a coherent story: prime Remuera location, sunny
// north aspect, renovated kitchen — but an aging iron roof, no ceiling insulation,
// and weak bathroom ventilation. Clean freehold title on flat, low-hazard land.
const SCORES: Record<string, number> = {
  // Improvements — Exterior
  ext_foundation: 7, ext_roof: 4, ext_cladding: 7, ext_windows: 8, ext_decking: 6,
  ext_gutters: 6, ext_soffits: 7, ext_doors: 7, ext_paint: 6, ext_chimney: 6,
  // Kitchen (recently renovated)
  kit_cabinetry: 8, kit_appliances: 8, kit_benchtop: 9, kit_flooring: 7, kit_layout: 8, kit_sink: 8, kit_splashback: 8,
  // Bathroom
  bath_shower: 6, bath_waterproof: 5, bath_hotwater: 6, bath_vanity: 6, bath_toilet: 7, bath_ventilation: 1, bath_flooring: 6,
  // Living
  liv_heating: 8, liv_size: 8, liv_insulation: 3, liv_light: 9, liv_flooring: 7, liv_ceiling: 7, liv_fixtures: 6,
  // Bedrooms
  bed_size: 7, bed_heating: 5, bed_storage: 7, bed_windows: 8, bed_flooring: 7, bed_ceiling: 7,
  // Garage
  gar_type: 7, gar_construction: 7, gar_door: 6, gar_floor: 7, gar_power: 7,
  // Outdoor
  out_drainage: 6, out_driveway: 7, out_fencing: 7, out_landscaping: 8,
  // Location
  loc_schools: 9, loc_growth: 8, loc_sun: 9, loc_amenities: 8, loc_street: 8, loc_employment: 7,
  loc_transport: 6, loc_walkability: 7, loc_parks: 8, loc_views: 7, loc_noise: 8, loc_safety: 8, loc_future: 7,
  // Land (v4 — flood, liquefaction, coastal, soil, fault, wind erased)
  land_size: 7, land_topography: 8, land_aspect: 9, land_shape: 9, land_frontage: 9, land_trees: 8,
  // Legal (unconsented rear studio flagged — drives the remediation example)
  leg_title: 10, leg_weathertight: 8, leg_unconsented: 4, leg_consents: 7, leg_eqc: 9,
  leg_easements: 7, leg_lim: 7, leg_encumbrances: 9,
};

// Spec/quality tier of the materials (Improvements) — the value axis separate from
// condition. Renovated kitchen + engineered-timber floors are premium; the original
// tiled bathroom is standard; everything unlisted defaults to standard.
const SPEC: Record<string, SpecTier> = {
  kit_cabinetry: "modern", kit_appliances: "modern", kit_benchtop: "modern", kit_splashback: "modern",
  liv_flooring: "modern",
  bath_shower: "dated", bath_vanity: "dated", bath_flooring: "dated",
  liv_fixtures: "dated", // original-ish light fittings & switches
  liv_insulation: "deteriorated", // minimal 1970s insulation — effectively end of life
  bath_ventilation: "deteriorated", // no ducted extractor fans fitted
};

// What's actually VISIBLE in this property's photos for each item needing work —
// this is what the renovation budget plan quotes, so it must be specific to the
// house, never a generic "below average". Paired with PHOTOS below.
const DEFECTS: Record<string, string> = {
  ext_roof: "Rust is bleeding through the ridge flashing above the garage and two sheets have lifted at the eastern end; the coating has chalked off across the north-facing pitch.",
  bath_ventilation: "No extractor fan in either bathroom — only an openable window — and there is mould staining spreading across the ceiling above the shower.",
  liv_insulation: "Not visible in any photo — inferred from the 1975 build era, when ceilings were typically built with little or no insulation, and the report found no upgrade recorded.",
  bath_flooring: "Two cracked floor tiles beside the vanity and the grout has darkened and lifted along the shower edge, which is where water gets underneath.",
  bath_hotwater: "Original-looking copper cylinder in the hallway cupboard with no visible lagging and corrosion staining on the tray beneath it.",
  liv_ceiling: "Hairline cracking along the cornice line in the lounge, consistent with normal settlement in a house of this age rather than anything structural.",
  liv_heating: "A single wood burner in the lounge doing all the work; its flue collar shows rust at the ceiling penetration.",
  liv_flooring: "Carpet is worn through to backing in the hallway traffic path and has pulled away from the gripper at the lounge doorway.",
  bed_ceiling: "Water staining across two ceiling panels in the back bedroom, directly under the section of roof flagged above.",
  bed_heating: "No fixed heating visible in any of the three bedrooms — the wood burner in the lounge is the only heat source in the house.",
  bed_flooring: "Carpet in the two rear bedrooms is flattened and sun-bleached in a band along the window wall, with a seam lifting in the main bedroom.",
  out_fencing: "Three palings missing along the western boundary and the run beside the driveway is leaning noticeably off vertical.",
  ext_gutters: "Debris and plant growth visible in the gutter above the front entry, with staining down the cladding where it has been overflowing.",
  ext_soffits: "Paint is flaking off the soffit lining along the south elevation and one sheet has begun to sag away from its fixings near the corner.",
  gar_door: "Timber tilt door with peeling paint along the bottom rail and visible swelling where it meets the concrete; no auto opener fitted.",
  ext_paint: "Weatherboards on the south and west elevations have chalked and are flaking above the window heads; the north face is holding up better.",
  ext_doors: "Original aluminium slider to the deck drags on its track and the rubber seals have perished; the front door itself is sound.",
  ext_cladding: "Weatherboard is intact overall, with a small area of soft timber at the base of the south wall where the gutter has been overflowing.",
  ext_decking: "Deck boards are grey and furred from lack of oil, with two boards cupping near the steps and a handrail post that moves when pushed.",
  bath_shower: "Dated framed shower over bath with a perished seal at the base and silicone that has gone black along the wall junction.",
  bath_vanity: "Original single vanity with a chipped laminate top and chrome tapware that is pitting around the spout base.",
  bath_toilet: "Older close-coupled suite, functional, with staining at the pan-to-floor junction suggesting a tired seal.",
  bath_waterproof: "Not visible — inferred. Behind the 1970s tiling there is unlikely to be a modern waterproof membrane, so budget for it if the bathroom is opened up.",
  kit_flooring: "Vinyl is lifting at the seam in front of the dishwasher and there is a scorch mark beside the oven.",
  liv_fixtures: "Original ceiling roses and plastic switch plates throughout, several yellowed with age; no downlights fitted.",
  bed_storage: "Two bedrooms have shallow original wardrobes with sagging hanging rails; the third has no built-in storage at all.",
  gar_floor: "Bare concrete with oil staining under the parking bay and a crack running diagonally from the door opening.",
  out_driveway: "Concrete drive is sound but crazed across the turning area, with weeds through the joints near the street.",
};

/** Items no listing photograph can show. They are inferred, so they are Tier 3
 *  and therefore not scored at all — they go on the viewing checklist instead. */
const NOT_VISIBLE = new Set(["liv_insulation", "bath_waterproof"]);

// Photo numbers backing each observation above.
const PHOTOS: Record<string, number[]> = {
  ext_roof: [4, 5], bath_ventilation: [6, 11], bath_flooring: [11], bath_hotwater: [14],
  liv_ceiling: [7], liv_heating: [3, 8], liv_flooring: [7],
  bed_ceiling: [9], bed_heating: [9, 10], bed_flooring: [9, 10],
  out_fencing: [16], ext_gutters: [2], ext_soffits: [4], gar_door: [1, 15],
  ext_paint: [1, 4], ext_doors: [3, 17], ext_cladding: [4], ext_decking: [17],
  bath_shower: [6], bath_vanity: [6], bath_toilet: [11], kit_flooring: [12],
  liv_fixtures: [7, 8], bed_storage: [10], gar_floor: [15], out_driveway: [1],
};

// One-line findings for Location/Land/Legal cards.
const FINDINGS: Record<string, string> = {
  loc_schools: "Double zone — Remuera Primary + Auckland Grammar",
  loc_growth: "Strong — sustained Remuera median growth",
  loc_sun: "Excellent — north-facing living, all-day sun",
  loc_amenities: "Good — Remuera shops & supermarket within ~1km",
  loc_transport: "Moderate — bus routes nearby, no rapid transit",
  land_size: "612m² — a typical Auckland residential section",
  land_shape: "Rectangular title — a regular block with almost nothing wasted",
  land_trees: "Established planting, kept tidy — no protected trees flagged",
  land_aspect: "North-facing section, lightly shaded by the established trees",
  land_frontage: "Own road frontage — nothing shared, no right of way",
  land_topography: "Gentle cross-slope to the rear — most of the section is usable",
  leg_title: "Freehold — no encumbrances",
  leg_weathertight: "Low risk — 1975 weatherboard, pre-leaky era",
  leg_unconsented: "Flagged: rear studio may be unconsented",
};

// Remediable findings → cost + Renovations line item (Section 8).
const REMEDIATIONS: Record<string, Remediation> = {
  leg_unconsented: {
    description: "Certificate of Acceptance for the rear studio",
    low: 4000,
    mid: 6500,
    high: 9000,
    urgencyYears: 2,
    renovationLineItem: "Certificate of Acceptance — rear studio",
  },
};

const bandFinding = (score: number) =>
  score >= 8 ? "Low concern" : score >= 5 ? "Moderate — verify" : "Concern — investigate";

const DEFAULT_BY_INSPECTION: Record<string, number> = {
  improvements: 7, location: 8, land: 8, legal: 8,
};

const SUMMARIES: Record<string, string> = {
  // ── Improvements: photo-grounded condition assessments ──────────────────
  // One per improvements sub-item, written against the DEFECTS and PHOTOS
  // maps above so the prose, the observed defect and the score agree.
  ext_foundation:
    "Concrete perimeter foundation typical of a 1975 Auckland build, with no visible cracking, movement or subsidence in the exterior photos. The gentle cross-slope on the section is being handled without stepping or underpinning. Nothing here suggests structural work, but a builder should still check the subfloor and pile condition from underneath, which no listing photo covers.",
  ext_cladding:
    "Bevel-back weatherboard, original to the house and in generally sound order across the elevations shown. The one concern is a patch of soft timber at the base of the south wall where the gutter above has been overflowing (Photo 4). Fix the guttering first, then cut out and replace the affected boards. Left alone, water at the base of a wall is how a small repair turns into a framing job.",
  ext_windows:
    "Aluminium joinery throughout, almost certainly a retrofit over the original timber given the condition, and running well in the photos. Single glazed, which is standard for the era and the main comfort weakness of the house. Double glazing is a worthwhile upgrade if you are staying long term, though it rarely pays for itself on resale alone.",
  ext_decking:
    "Timber deck off the living area, greyed and furred from going too long without oil, with two boards cupping near the steps (Photo 17). More concerning is the handrail post that moves when pushed, which is a safety item rather than a cosmetic one. Re-fix or replace the post, then sand and re-oil the boards. A weekend of work and a few hundred dollars in materials.",
  ext_gutters:
    "Debris and plant growth sitting in the gutter above the front entry, with staining down the cladding where it has been overflowing (Photo 2). This is the root cause of the soft weatherboard noted below it, so it is doing active damage rather than just looking untidy. Clear and re-fall the run, and check the downpipe discharges properly.",
  ext_soffits:
    "Paint flaking off the soffit lining along the south elevation and one sheet beginning to sag away from its fixings near the corner (Photo 4). Sagging soffit lining usually means moisture has been getting in behind it, so re-fix and repaint rather than just painting over. Worth checking at the same time as the gutter work above it.",
  ext_doors:
    "The front door is sound. The original aluminium slider to the deck drags on its track and its rubber seals have perished (Photos 3 and 17), which lets draughts and driving rain in and makes the living area harder to heat. New seals and a track service are cheap; replacing the unit only makes sense as part of a wider glazing upgrade.",
  ext_paint:
    "Weatherboards on the south and west elevations have chalked and are flaking above the window heads, while the north face is holding up better (Photos 1 and 4). That pattern is normal for prevailing weather exposure. A full exterior repaint is due within a year or two, and doing it sooner protects the cladding rather than just improving the look.",
  ext_chimney:
    "Masonry chimney serving the lounge wood burner, standing straight with no visible cracking or displaced flashing. Chimneys of this age are worth a specific look at the roof junction, which is the usual leak point, and an engineer should confirm it is seismically restrained if you are altering anything nearby. No evidence of a problem from the photos.",
  kit_cabinetry:
    "Renovated kitchen, roughly eight years old, with flat-panel doors and soft-close hardware in good order. This is the strongest room in the house and needs nothing. Expect another decade of service before it starts to look dated, which puts any kitchen spend well down your list.",
  kit_appliances:
    "Recent appliance suite of around five years, including an under-bench oven, ceramic cooktop, dishwasher and rangehood, all presenting as working. Nothing here needs replacing on purchase. Budget replacement from about year eight, and check whether the rangehood ducts outside rather than recirculating, which matters for moisture in a house with limited ventilation elsewhere.",
  kit_benchtop:
    "Engineered stone benchtop in excellent order with no chipping at the edges or staining around the sink cutout. The best single component in the house. No action needed and no cost to allow for.",
  kit_flooring:
    "Vinyl lifting at the seam in front of the dishwasher and a scorch mark beside the oven (Photo 12). A lifting seam next to a dishwasher matters more than it looks: water tracks under the vinyl and into the substrate where you cannot see it. Re-lay or replace the sheet, and check the floor underneath is dry while it is open.",
  kit_layout:
    "Workable galley arrangement with the sink, cooktop and fridge in a sensible triangle, and enough bench run either side of the cooktop to actually use. Storage is adequate rather than generous. The kitchen opens to the living area, which is what buyers in this bracket expect and is difficult to retrofit if it were not already there.",
  kit_sink:
    "Undermount stainless sink with a modern mixer, consistent with the eight-year renovation and in good condition. No leaks or staining visible at the cabinet base beneath. Nothing to do.",
  kit_splashback:
    "Glass splashback behind the cooktop, part of the same renovation, clean and undamaged with no cracking around the fixings. Fully sealed against the benchtop, which is what keeps moisture out of the wall behind. No action needed.",
  bath_shower:
    "Dated framed shower over bath with a perished seal at the base and silicone gone black along the wall junction (Photo 6). Black silicone is mould in the joint, and a perished base seal means water has been getting past it for a while. Re-seal as an immediate job, but treat this as the start of a bathroom that is due rather than a repair that will hold indefinitely.",
  bath_hotwater:
    "Original-looking copper cylinder in the hallway cupboard, unlagged, with corrosion staining on the tray beneath it (Photo 14). Staining in the tray means it has leaked at some point. A cylinder of this age is at the end of its service life and can fail without warning, so replace it early rather than waiting. Lagging and a modern cylinder will also cut your hot water running costs.",
  bath_vanity:
    "Original single vanity with a chipped laminate top and chrome tapware pitting around the spout base (Photo 6). Functional, dated, and matched to the rest of the bathroom in age. Not worth replacing on its own; roll it into the bathroom refresh when you do the shower and waterproofing.",
  bath_toilet:
    "Older close-coupled suite, working, with staining at the pan-to-floor junction that suggests a tired seal (Photo 11). Re-seat it on a new wax seal, which is a cheap job, and check the floor underneath is sound while it is lifted. Staining at that junction can mean water has been escaping under the floor covering.",
  bath_flooring:
    "Two cracked floor tiles beside the vanity and grout that has darkened and lifted along the shower edge (Photo 11). The shower edge is exactly where water gets underneath, and lifted grout there means it probably already has. Combined with the waterproofing question below, this points at a full wet-area redo rather than patching individual tiles.",
  liv_heating:
    "A single wood burner in the lounge is doing all the work for the whole house, and its flue collar shows rust at the ceiling penetration (Photos 3 and 8). Rust at a flue penetration is a weathertightness and fire-safety item, so have it inspected. The bigger issue is distribution: one fire in one room leaves the bedrooms cold, which the bedroom heating item below picks up.",
  liv_fixtures:
    "Original ceiling roses and plastic switch plates throughout, several yellowed with age, and no downlights fitted (Photos 7 and 8). Cosmetically dated but electrically unremarkable for the era. Worth asking whether the switchboard still has rewireable fuses, since a 1975 board is often the real electrical cost rather than the fittings you can see.",
  liv_size:
    "Generous open living at the scale you would expect from a 185m2 floor plan, with room for a full dining setting alongside the lounge without crowding. Flow to the deck and the north-facing garden is direct. Size and flow are among the harder things to change, so this is a genuine strength of the house.",
  liv_light:
    "North-facing living with large windows to the garden and no significant obstruction from neighbouring buildings (Photos 2 and 3). Excellent all-day sun, which is the single most valued feature in Auckland housing stock and one you cannot retrofit. This is the strongest attribute of the property.",
  liv_flooring:
    "Engineered oak in the living area from the same renovation cycle as the kitchen, roughly eight years old and presenting well. The problem is the carpeted areas next to it: worn through to backing in the hallway traffic path and pulled away from the gripper at the lounge doorway (Photo 7). Re-stretch or replace the carpet; the timber itself needs nothing.",
  liv_ceiling:
    "Hairline cracking along the cornice line in the lounge (Photo 7), consistent with normal settlement in a house of this age rather than anything structural. Stopping and painting will deal with it. Ceiling height is standard for the era at around 2.4m, which is adequate but not a feature.",
  bed_size:
    "Three bedrooms at sizes typical for the era: one comfortable main and two that will take a double bed with limited room around it. Adequate for a family, though buyers comparing against newer stock will notice the secondary bedrooms are tight. Nothing to remedy short of reconfiguring.",
  bed_heating:
    "No fixed heating visible in any of the three bedrooms, with the lounge wood burner the only heat source in the house (Photos 9 and 10). This is the clearest Healthy Homes gap after insulation: a rental must have a fixed heater capable of heating the main living room, and unheated bedrooms in an uninsulated 1975 house will be cold and prone to condensation. A heat pump would address heating and distribution together.",
  bed_storage:
    "Two bedrooms have shallow original wardrobes with sagging hanging rails, and the third has no built-in storage at all (Photo 10). Standard for the period and an easy, low-cost improvement. New rails and a shelf system in the existing recesses, plus a built-in for the third room, would lift the presentation noticeably for modest spend.",
  bed_windows:
    "Aluminium joinery matching the rest of the house, with good window area and no obstruction to the light in the rooms photographed. Single glazed like the remainder, so expect condensation on cold mornings, which is a comfort and mould issue rather than a defect. Opens and latches appear intact.",
  bed_flooring:
    "Carpet in the two rear bedrooms is flattened and sun-bleached in a band along the window wall, with a seam lifting in the main bedroom (Photos 9 and 10). Cosmetic rather than structural, and consistent with carpet that has done its time. Replace across the bedroom wing at once so it matches rather than doing rooms piecemeal.",
  bed_ceiling:
    "Water staining across two ceiling panels in the back bedroom, directly under the section of roof already flagged (Photo 9). This is the roof problem showing up on the inside, which confirms the leak is active rather than historic. Fix the roof first. Repairing the ceiling before the roof is watertight will simply stain again.",
  gar_type:
    "Single garage, detached from the house with no internal access, which is normal for the period but less convenient than buyers of newer homes expect. Off-street parking for one vehicle plus the driveway. Adding internal access is not practical given the separation, so treat this as a fixed characteristic of the property.",
  gar_construction:
    "Built in the same weatherboard as the house and appearing structurally sound, with no lean, sagging roofline or displaced cladding visible. Ages and weathers at the same rate as the main dwelling, so include it in the exterior repaint rather than treating it separately.",
  gar_door:
    "Timber tilt door with peeling paint along the bottom rail and visible swelling where it meets the concrete, and no auto opener fitted (Photos 1 and 15). Swelling at the base means the timber is drawing up moisture off the slab, which will keep recurring. Replacing with a sectional door and opener is the sensible move and modernises the street presentation at the same time.",
  gar_floor:
    "Bare concrete with oil staining under the parking bay and a crack running diagonally from the door opening (Photo 15). Diagonal cracks from an opening are usually shrinkage rather than settlement, but have it looked at if it is wide or has a lip. Otherwise cosmetic, and sealing the slab would stop further oil penetration.",
  gar_power:
    "Power and lighting are connected, with a functioning light and at least one outlet visible. Adequate for storage and basic workshop use. If you intend to charge an electric vehicle, have an electrician confirm the supply to the garage will carry it, since a 1975 subcircuit generally will not.",
  out_drainage:
    "No obvious ponding across the lawn in the photos, and the gentle cross-slope should shed water away from the house. The gutter overflow noted on the exterior is the real water issue on this property rather than ground drainage. Worth walking the section after heavy rain before going unconditional, as photos taken in fine weather cannot show you this.",
  out_driveway:
    "Concrete drive is structurally sound but crazed across the turning area, with weeds through the joints near the street (Photo 1). Crazing is surface shrinkage and not a defect that needs correcting. Clearing the joints and water blasting would tidy the approach, which is the first thing anyone sees.",
  out_fencing:
    "Three palings missing along the western boundary and the run beside the driveway leaning noticeably off vertical (Photo 16). A leaning run usually means the posts are rotting at ground level, so expect post replacement rather than just re-fixing palings. Confirm the boundary line before rebuilding, and talk to the neighbour about sharing the cost, which the Fencing Act allows for.",
  out_landscaping:
    "Established, mature planting with lawn to the north of the house and defined garden beds, presenting well and requiring ordinary upkeep rather than restoration. Mature trees on a Remuera section add real value. Check with the council whether anything on the property carries a protection or notable tree listing before planning removal or heavy pruning.",
  ext_roof:
    "Photos 1 and 4 show a long-run iron roof with surface rust along the ridgeline and around the flashings, consistent with a c.1975 original. Plan for replacement within 1–2 years; budget a recoat only if a full replacement isn't viable this cycle. Confirm purlin condition and underlay when re-roofing.",
  liv_insulation:
    "No photograph shows the roof space, so the ceiling has not been seen. The 1975 build era predates insulation requirements, so expect little to no ceiling or underfloor insulation. This is the single highest-impact, lowest-cost improvement — it lifts comfort, lowers running costs, and is required for Healthy Homes if rented.",
  bath_ventilation:
    "The main bathroom (Photo 5) has an openable window but no visible ducted extractor fan. Inadequate extraction drives mould and fails the Healthy Homes ventilation standard. Install ducted fans vented to outside in both bathrooms.",
  bath_waterproof:
    "Tiling in the main bathroom looks original; waterproofing behind 1970s tiling is commonly at or past end of life. Treat as probable — verify at inspection and budget to re-waterproof and re-tile the wet area.",
  loc_schools:
    "Within the Auckland Grammar and Epsom Girls' Grammar double-grammar zones — among the most sought-after school zones in the country, a strong and durable demand driver for owner-occupiers.",
  loc_sun:
    "North-facing living areas (Photos 2 and 3) and a clear northern aspect give excellent all-day sun — a premium feature for Remuera buyers.",
  leg_title:
    "Freehold title — the simplest and most marketable tenure, no body corporate or cross-lease complications. Confirm via the LINZ record of title.",
  leg_weathertight:
    "Built c.1975 in weatherboard — predates the 1994–2004 leaky-building era and uses a forgiving cladding system, so weathertightness risk is low. Still confirm any later monolithic-clad additions.",
  leg_unconsented:
    "Source: the photo set — the rear studio in photo 12 has the look of a later addition. We can't tell you whether it was consented: councils don't publish consent records as data we can query, so nothing here has been checked against a council file. Unconsented work is a material legal risk: it can complicate finance and insurance, and a future buyer's lawyer will require it resolved. The usual remedy is a Certificate of Acceptance from the council, which involves an inspection and a fee — we've added an estimated $4,000–$9,000 to the Renovations tab. A LIM or the council property file is the only thing that settles it, and it is worth having before you go unconditional — if the work is structurally non-compliant, remediation could cost materially more.",
};

const COSTS: Record<string, { low: number; high: number; notes: string }> = {
  ext_roof: { low: 18000, high: 28000, notes: "185m² long-run iron re-roof incl. underlay, Auckland rate" },
  liv_insulation: { low: 2400, high: 3800, notes: "R3.2 ceiling batts + underfloor blanket, blow-in, Auckland" },
  bath_ventilation: { low: 700, high: 1400, notes: "Ducted extractor fans to two bathrooms" },
  bath_waterproof: { low: 3000, high: 6000, notes: "Re-waterproof + re-tile main bathroom wet area" },
  ext_paint: { low: 6000, high: 11000, notes: "Full exterior weatherboard repaint" },
  ext_gutters: { low: 1800, high: 3200, notes: "Replace spouting + downpipes" },
};

// Specific item ages (years), demonstrating precise, per-item aging — some
// original to the c.1975 build, others clearly updated since.
const AGES: Record<string, string> = {
  kit_cabinetry: "~8 years", kit_appliances: "~5 years", kit_benchtop: "~8 years", kit_splashback: "~8 years",
  liv_flooring: "~8 years (engineered oak, updated)",
  bath_shower: "~10 years", bath_vanity: "~10 years", bath_flooring: "~10 years",
  ext_roof: "~51 years (original long-run iron)",
  liv_insulation: "~51 years (original / minimal)",
  bath_ventilation: "None fitted",
  liv_fixtures: "~20 years",
};

function buildSubItems(): SubItem[] {
  const out: SubItem[] = [];
  for (const item of SCORING_MODEL) {
    // Only the chimney conditional is present in this property.
    if (item.conditional && item.id !== "ext_chimney") continue;
    const score = (SCORES[item.id] ?? DEFAULT_BY_INSPECTION[item.inspection] ?? 7) as UrgencyScore;
    const cost = item.costBearing && COSTS[item.id] ? COSTS[item.id] : null;
    const isImprovement = item.inspection === "improvements";
    const tax = SOURCE_TAXONOMY[item.id];

    // Sourced reasoning for Location/Land/Legal.
    const finding = isImprovement ? undefined : FINDINGS[item.id] ?? bandFinding(score);
    const reasoning = SUMMARIES[item.id]
      ?? (isImprovement
        ? ""
        : `Source: ${tax?.source ?? "listing facts"}. ${finding}. ${tax?.verifyAgainst ? `A ${tax.verifyAgainst} would settle this before you go unconditional.` : "Not established from the listing or the public record."}`);
    // A bad score is not evidence. Insulation sits inside a ceiling and
    // waterproofing sits behind tiling — no listing photograph shows either, and
    // the demo's own wording for both says so. Printing "Confirmed from photo"
    // beside "Not visible in any photo" is the exact over-claim the report is
    // built to avoid, and it was reaching the agent letter.
    const tier: 1 | 2 | 3 = isImprovement
      ? (NOT_VISIBLE.has(item.id) ? 3 : score <= 4 ? 1 : 2)
      : (tax && ["title", "photo", "moe_zones", "linz"].includes(tax.sourceType) ? 1 : 3);

    out.push({
      id: item.id,
      name: item.label,
      material: "See assessment",
      estimatedAge: isImprovement ? (AGES[item.id] ?? "~51 years (original)") : "—",
      condition: urgencyLabel(score),
      score,
      urgencyLabel: urgencyLabel(score),
      confidenceTier: tier,
      evidenceSource: isImprovement ? "Listing photos" : tax?.source ?? "Location & facts inference",
      aiSummary: reasoning,
      estimatedReplacementCost: cost,
      replacementCostWeight: 0,
      specTier: usesSpecTier(item) ? (SPEC[item.id] ?? "dated") : undefined,
      // Demo contour: a gentle cross-slope with most of the section still usable.
      ...(item.id === "land_topography" ? { slopeBand: "gentle" as const, usableLandPct: 82 } : {}),
      // Demo outline: a clean rectangle — regular, almost nothing wasted.
      ...(item.id === "land_shape" ? { shapeType: "rectangular" as const, workableLandPct: 94 } : {}),
      // Demo planting: settled trees, ordinary upkeep — an amenity, not a project.
      ...(item.id === "land_trees" ? { treeMaturity: "established" as const, treeUpkeep: "tidy" as const, treesProtected: false } : {}),
      // Size items show an estimated area instead of material/age.
      ...(item.id === "liv_size" ? { estimatedSqm: 52 } : {}),
      ...(item.id === "bed_size" ? { estimatedSqm: 14 } : {}),
      // Demo orientation: north-facing, with the established trees taking a little off it.
      ...(item.id === "land_aspect" ? { aspectDirection: "north" as const, sunObstruction: "partly_shaded" as const } : {}),
      // Demo access: its own street frontage, nothing shared.
      ...(item.id === "land_frontage" ? { accessType: "road_frontage" as const, homesOnAccess: 1 } : {}),
      renovationLink: Boolean(cost),
      healthyHomesLink: item.affectsHealthyHomes,
      observedDefect: DEFECTS[item.id],
      photoReferences: PHOTOS[item.id] ?? (item.id === "loc_sun" ? [2, 3] : item.id === "leg_unconsented" ? [12] : []),
      ...(isImprovement
        ? {}
        : {
            finding,
            source: tax?.source,
            sourceType: tax?.sourceType,
            verifyAgainst: tax?.verifyAgainst,
            remediation: REMEDIATIONS[item.id] ?? null,
          }),
    });
  }
  return out;
}

const EXTRA_DWELLINGS: ExtraDwelling[] = [
  {
    id: "ed_1",
    type: "Sleepout / studio (self-contained)",
    sizeEstimate: "~45 m²",
    construction: "Weatherboard, separate from the main dwelling",
    condition: "Good — tidy, lined and powered",
    score: 7 as UrgencyScore,
    estimatedReplacementCost: { low: 95000, high: 135000, notes: "Standalone studio replacement, Auckland" },
    consentStatus: "unknown",
    structureType: "minor_dwelling",
    habitable: true,
    sizeSqm: 45,
    bedrooms: 1,
    selfContained: true,
    aiSummary:
      "A separate ~45m² weatherboard studio sits at the rear (Photo 12) — lined, powered, with its own entry and windows to two elevations. Externally it presents as a self-contained sleepout. We cannot see inside: the interior fit-out, any kitchen or bathroom, insulation and the state of the services are all unverified from the listing photos.",
    redFlags: [
      "Sleeping space with no consent on record — it can't legally be rented until that's confirmed or regularised (LIM check).",
      "No heat pump head or flue visible on any elevation — likely no fixed heating, which a tenanted dwelling must have.",
      "Sits close to ground level with little visible clearance — check subfloor ventilation and damp.",
    ],
    healthyHomes: [
      { standard: "heating", status: "absent", note: "No fixed heat source visible on any elevation" },
      { standard: "insulation", status: "not_visible", note: "Cannot be seen from photos" },
      { standard: "ventilation", status: "not_visible", note: "Windows present; no extractor confirmed" },
      { standard: "moisture", status: "not_visible", note: "Low ground clearance — inspect subfloor" },
      { standard: "draught", status: "not_visible" },
    ],
    photoReferences: [12],
  },
  {
    id: "ed_2",
    type: "Open pole shed",
    sizeEstimate: "~60 m² (9 × 6.5m)",
    construction: "Steel portal frame, open-sided, gravel floor",
    condition: "Fair — surface rust to the purlins",
    score: 6 as UrgencyScore,
    estimatedReplacementCost: { low: 22000, high: 32000, notes: "Steel pole shed, Auckland" },
    consentStatus: "unknown",
    structureType: "pole_shed",
    habitable: false,
    sizeSqm: 60,
    aiSummary:
      "An open-sided steel pole shed (~60m², stated in the listing) sits behind the garage (Photo 15). Useful covered storage for a boat, trailer or machinery. Open-sided with a gravel floor, so it's shelter rather than secure storage.",
    photoReferences: [15],
  },
  {
    id: "ed_3",
    type: "In-ground swimming pool",
    sizeEstimate: "~8 × 4m",
    construction: "In-ground, tiled surround",
    condition: "Good — clear water, tidy coping",
    score: 7 as UrgencyScore,
    estimatedReplacementCost: { low: 70000, high: 100000, notes: "In-ground pool replacement, Auckland" },
    consentStatus: "unknown",
    structureType: "pool_inground",
    habitable: false,
    aiSummary:
      "A tiled in-ground pool (~8 × 4m) occupies the northern lawn (Photos 16–17). Water is clear and the coping looks sound. The pool fence is partly obscured in the photos — compliance can't be confirmed from the listing.",
    redFlags: ["Pool fencing compliance can't be confirmed from the photos — a non-compliant barrier is a legal breach and must be fixed before settlement."],
    photoReferences: [16, 17],
  },
];

function buildDemoAssessment(): Assessment {
  const subItems = buildSubItems();
  return {
    subItems,
    extraDwellings: EXTRA_DWELLINGS,
    penalties: [],
    context: {
      titleType: "freehold",
      hasChimney: true,
      hasSolar: false,
      hasRetainingWalls: false,
      hasPool: false,
      hasBodyCorporate: false,
    },
  };
}

/**
 * The demo section — INVENTED, like its address, and deliberately carrying no
 * geographic anchor.
 *
 * 14 Ferndale Road is fictional (see the demo-address rule): every street name
 * in the demo and sample data was checked against the LINZ address layer and
 * matches nothing in the country. That is what makes it safe to publish a
 * detailed condition report against it.
 *
 * Anchoring it would undo that in one step. The aerial layer would fetch
 * whatever really stands at those coordinates and draw somebody's actual roof
 * under an invented report titled "14 Ferndale Road, Remuera" — the same false
 * claim about a real home the fictional addresses exist to prevent. So the demo
 * shows the drawn section, and imagery appears on real reports where the
 * property genuinely is the one being described.
 *
 * The shape is built from the demo's OWN stated figures — 612m² of land, a
 * 185m² floor area on a single-storey 1975 house — so the plan agrees with the
 * header above it rather than being a decorative rectangle.
 */
const DEMO_SITE = (() => {
  const rect = (x: number, y: number, w: number, h: number) => [
    { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
  ];
  return readSiteLayout({
    parcel: rect(0, 0, 17, 36),          // 612m², a normal Auckland front-site
    buildings: [
      rect(2.5, 3, 12, 15.4),            // the house — 185m², matching the header
      rect(10.8, 27, 6, 6),              // the separate studio the listing mentions, back corner
    ],
    roadPoint: { x: 8.5, y: -6 },        // the street, so "front" and "back" mean something
    // A council drainage easement crossing the back yard — the commonest kind
    // there is, and placed where it actually teaches something: it sits in the
    // obvious spot for a sleepout, so the footprint visibly refuses to go there
    // and has to move behind it.
    burdens: [rect(0, 20, 17, 3)],
    // DP 900000 DOES NOT EXIST, and that is deliberate. Survey plan numbers
    // currently run around the 630,000s, so this cannot collide with a real
    // record — the same reason every street name in the demo matches no address
    // in the country. Citing a genuine survey reference against an invented
    // property would be the demo-address problem wearing a different hat.
    burdenLabels: [{ kind: "Easement", appellation: "Area A DP 900000" }],
  });
})();

export function buildDemoReport(): StoredReport {
  const assessment = buildDemoAssessment();
  const scores = scoreBoth(assessment);

  const listing = {
    ...emptyListing("https://www.trademe.co.nz/a/property/residential/sale/auckland/remuera/14-ferndale-road", "trademe"),
    listingId: "rpt_001",
    address: "14 Ferndale Road",
    suburb: "Remuera",
    city: "Auckland",
    region: "Auckland",
    askingPrice: 1150000,
    priceMethod: "deadline" as const,
    priceText: "Deadline sale",
    bedrooms: 3,
    bathrooms: 2,
    carParks: 1,
    floorAreaSqm: 185,
    landAreaSqm: 612,
    propertyType: "house" as const,
    titleType: "freehold" as const,
    buildYear: 1975,
    siteLayout: DEMO_SITE,
    description: "Sun-drenched 1970s family home in the double-grammar zone, renovated kitchen, separate studio.",
    daysOnMarket: 68,
    photoUrls: Array.from({ length: 18 }, (_, i) => `demo-photo-${i + 1}`),
    scrapedOk: true,
  };

  return {
    id: "rpt_001",
    createdAt: "2026-06-03T00:00:00.000Z",
    listing,
    context: assessment.context,
    subItems: assessment.subItems,
    extraDwellings: assessment.extraDwellings,
    penalties: assessment.penalties,
    scores,
    gaps: [
      {
        gapType: "document",
        area: "Title & LIM",
        description: "Freehold tenure and the legal description come from the LINZ record of title. A LIM would add the consent history for the studio and any natural-hazard overlays the council holds — those aren't published as data we can retrieve.",
        includedInAgentLetter: false,
        includedInLimLetter: true,
      },
      {
        gapType: "photo",
        area: "Roof space",
        description: "No clear roof-space photo confirming insulation — request one or confirm at inspection.",
        includedInAgentLetter: true,
        includedInLimLetter: false,
      },
    ],
    photosAnalysed: 18,
    model: "claude-sonnet-4-6 (demo)",
    marketRent: {
      weekly: 850,
      source: "myRent + Tenancy Services market rent (Remuera, 3-bed)",
      isEstimate: false,
    },
    capitalGrowth: {
      annualRatePct: 4.7,
      source: "QV House Price Index + Opes Partners (Auckland ~4.66%/yr, 20-yr avg)",
      why:
        "Within the Auckland Grammar / Epsom Girls' double-grammar zone — a durable, supply-constrained demand driver. Established Auckland City suburb with limited new-build competition, so values hold up better through cycles.",
      recentNote: "Median down ~9.4% over the last 12 months in a softer Auckland market — the projection uses the long-run trend, not the recent dip.",
    },
    suburbValue: {
      medianPerSqm: 9500,
      sampleSize: 18,
      medianSalePrice: 1750000,
      medianFloorArea: 184,
      propertyType: "house",
      suburb: "Remuera, Auckland",
      source: "oneroof.co.nz + homes.co.nz",
      retrieved: "June 2026",
    },
  };
}
