// ============================================================
// A distinct sample report for every pin on the demo map.
//
// The demo map used to send all thirty pins to 14 Ferndale Road, so a visitor
// clicking three properties read the same report three times. These reports are
// the shop window — people decide whether the product is worth paying for by
// reading one — so each pin now gets its own, and each has to stand up as a
// piece of work rather than as filler.
//
// Built through the REAL scoring engine, exactly as the demo report is, so the
// persona toggle genuinely recomputes and the numbers are internally consistent
// with the model rather than typed in.
//
// THE ADDRESSES ARE DELIBERATELY FICTIONAL. The seed listings previously used
// real streets — 24 Victoria Ave, Remuera is a real property with a real title,
// NA119C/47 — and publishing an invented condition report against a real house
// ("rusted roof, mould in the bathroom, possible unconsented works") is a false
// and damaging claim about somebody's home. Every street name here was checked
// against the LINZ address layer and matches ZERO addresses in New Zealand. The
// suburb, price, era and coordinates stay realistic; the front door does not
// belong to anyone.
//
// Coherence is the thing that makes these read as real: a 2019 build does not
// have a rusted roof, a 1905 villa is not on a slab, and a leaky-era plaster
// home has a weathertightness story that runs through cladding, windows and the
// legal items together. Each archetype carries that story end to end.
// ============================================================

import type { StoredReport } from "@/lib/report-store";
import type { SubItem, UrgencyScore, SpecTier } from "@/lib/property-tab/types";
import { urgencyLabel } from "@/lib/property-tab/types";
import { emptyListing } from "@/lib/scraper/types";
import type { PropertyType } from "@/lib/scraper/types";
import { SCORING_MODEL, usesSpecTier } from "./model";
import { SOURCE_TAXONOMY } from "./catalog";
import { scoreBoth, type Assessment } from "./report";
import { assessFoundation, type FoundationType } from "./foundation";

export const SAMPLE_ID_PREFIX = "sample-";

type Archetype =
  | "renovated"
  | "tired70s"
  | "newBuild"
  | "leakyEra"
  | "exRental"
  | "villa"
  | "coastal"
  | "brickTile"
  | "apartment";

interface Defect {
  score: UrgencyScore;
  spec?: SpecTier;
  age?: string;
  summary: string;
  cost?: { low: number; high: number; notes: string };
}

interface ArchetypeSpec {
  /** One line the whole report has to stay consistent with. */
  story: string;
  foundation: FoundationType;
  /** Baseline for anything the archetype doesn't speak to. */
  base: { improvements: number; land: number; legal: number; location: number };
  /** Default spec tier for fit-out items. */
  fitOut: SpecTier;
  defects: Record<string, Defect>;
  /** Items this archetype is notably GOOD at, beyond the baseline. */
  strengths?: Record<string, UrgencyScore>;
}

// What each thing is made of, per archetype. These said "See assessment" on
// every card — a chip that cost a line to tell the reader to read the rest of
// the card — and the whole point of the samples is to demonstrate the format
// somebody would be paying for.
//
// They are keyed to the archetype because a 1908 villa and a 2016 build do not
// share a roof, and a sample that says otherwise stops reading as a real house.
// The foundation line is derived from the archetype's own `foundation` field
// rather than repeated, so the two cannot drift apart.
//
// ABSENCE IS DELIBERATE, on the same three rules as the demo report: appliances
// and systems have a type rather than a material; a layout, a size or an aspect
// is not a thing; and nothing invisible gets one, because the material of an
// unphotographed item is a guess. An item missing here shows no Material chip.
const FOUNDATION_MATERIAL: Record<FoundationType, string> = {
  concrete_slab: "Concrete slab on grade",
  concrete_piles: "Concrete piles",
  timber_piles: "Timber piles",
  perimeter_piles: "Concrete perimeter footing, piles under",
  mixed: "Mixed — slab and piles",
  unknown: "",
};

/** The envelope — what the archetype's era and story actually put on the house. */
const ENVELOPE: Record<Archetype, Record<string, string>> = {
  renovated: {
    ext_roof: "Long-run coloursteel", ext_cladding: "Bevel-back weatherboard",
    ext_windows: "Aluminium joinery, double glazed", ext_doors: "Aluminium slider, timber front door",
    liv_ceiling: "Plasterboard", bed_ceiling: "Plasterboard",
  },
  tired70s: {
    ext_roof: "Long-run corrugated steel", ext_cladding: "Bevel-back weatherboard",
    ext_windows: "Aluminium joinery, single glazed", ext_doors: "Aluminium slider, timber front door",
    liv_ceiling: "Plasterboard with timber cornice", bed_ceiling: "Plasterboard",
  },
  newBuild: {
    ext_roof: "Coloursteel tray roofing", ext_cladding: "Fibre-cement weatherboard on cavity",
    ext_windows: "Thermally broken aluminium, double glazed", ext_doors: "Aluminium sliders, double glazed",
    liv_ceiling: "Plasterboard, square-stopped", bed_ceiling: "Plasterboard, square-stopped",
  },
  leakyEra: {
    ext_roof: "Concrete tile", ext_cladding: "Monolithic plaster, direct-fixed",
    ext_windows: "Aluminium joinery, single glazed", ext_doors: "Aluminium slider",
    liv_ceiling: "Plasterboard", bed_ceiling: "Plasterboard",
  },
  exRental: {
    ext_roof: "Long-run corrugated steel", ext_cladding: "Bevel-back weatherboard",
    ext_windows: "Aluminium joinery, single glazed", ext_doors: "Aluminium slider",
    liv_ceiling: "Plasterboard", bed_ceiling: "Plasterboard",
  },
  villa: {
    ext_roof: "Corrugated iron", ext_cladding: "Rusticated weatherboard",
    ext_windows: "Timber double-hung sashes, single glazed", ext_doors: "Panelled timber front door",
    liv_ceiling: "Lath and plaster with timber scotia", bed_ceiling: "Lath and plaster",
  },
  coastal: {
    ext_roof: "Long-run coloursteel", ext_cladding: "Bevel-back weatherboard",
    ext_windows: "Aluminium joinery, single glazed", ext_doors: "Aluminium slider",
    liv_ceiling: "Plasterboard", bed_ceiling: "Plasterboard",
  },
  brickTile: {
    ext_roof: "Concrete tile", ext_cladding: "Clay brick veneer",
    ext_windows: "Aluminium joinery, single glazed", ext_doors: "Aluminium slider",
    liv_ceiling: "Plasterboard", bed_ceiling: "Plasterboard",
  },
  apartment: {
    ext_roof: "Membrane over concrete", ext_cladding: "Plaster over concrete block",
    ext_windows: "Aluminium joinery, double glazed", ext_doors: "Aluminium slider",
    liv_ceiling: "Plasterboard, square-stopped", bed_ceiling: "Plasterboard, square-stopped",
  },
};

/** The fit-out follows the archetype's spec tier, not its era — a 1970s house
 *  with a redone kitchen has a modern one. */
const FIT_OUT: Record<"modern" | "dated", Record<string, string>> = {
  modern: {
    kit_cabinetry: "Melamine doors on MDF carcasses", kit_benchtop: "Engineered stone",
    kit_sink: "Stainless steel, undermount", kit_splashback: "Toughened glass",
    kit_flooring: "Vinyl plank", bath_shower: "Tiled shower, glass screen",
    bath_vanity: "Wall-hung vanity, mixer tapware", bath_toilet: "Vitreous china, back-to-wall",
    bath_flooring: "Porcelain tile", liv_flooring: "Engineered timber",
    bed_flooring: "Wool-blend carpet",
  },
  dated: {
    kit_cabinetry: "Melamine on particle board", kit_benchtop: "Laminate",
    kit_sink: "Stainless steel, drop-in", kit_splashback: "Ceramic tile",
    kit_flooring: "Sheet vinyl", bath_shower: "Framed shower over an acrylic bath",
    bath_vanity: "Laminate top, chrome tapware", bath_toilet: "Vitreous china, close-coupled",
    bath_flooring: "Ceramic floor tile", liv_flooring: "Carpet over timber floorboards",
    bed_flooring: "Carpet over timber floorboards",
  },
};

/** Things that look the same whatever the era. */
const COMMON: Record<string, string> = {
  ext_gutters: "PVC spouting and downpipes",
  ext_soffits: "Painted fibre-cement lining",
  ext_paint: "Acrylic",
  gar_construction: "Timber frame on a concrete slab",
  gar_door: "Sectional steel door",
  gar_floor: "Concrete slab",
  out_driveway: "Concrete",
  out_fencing: "Timber paling",
};

function materialFor(itemId: string, spec: ArchetypeSpec, archetype: Archetype): string | undefined {
  if (itemId === "ext_foundation") return FOUNDATION_MATERIAL[spec.foundation] || undefined;
  // A brick-and-tile house does not have a weatherboard garage or a timber fence
  // out the front, but neither claim is worth a table of its own — COMMON is
  // last, so an archetype can override anything in it above.
  return ENVELOPE[archetype][itemId]
    ?? FIT_OUT[spec.fitOut === "modern" ? "modern" : "dated"][itemId]
    ?? COMMON[itemId];
}

const ARCHETYPES: Record<Archetype, ArchetypeSpec> = {
  renovated: {
    story: "recently renovated to a good standard, little left to do",
    foundation: "concrete_piles",
    base: { improvements: 8, land: 8, legal: 8, location: 8 },
    fitOut: "modern",
    strengths: { kit_cabinetry: 9, kit_benchtop: 9, bath_shower: 9, liv_flooring: 9, liv_heating: 9 },
    defects: {
      liv_insulation: {
        score: 6, spec: "dated", age: "retrofit, age not stated",
        summary:
          "Ceiling batts are visible in the roof-space photo and look like a retrofit rather than original, but there is no underfloor blanket in any shot and the listing doesn't state one. Budget for underfloor if you want the place warm in winter.",
        cost: { low: 1800, high: 3200, notes: "Underfloor blanket to a house of this size" },
      },
      ext_paint: {
        score: 7, spec: "modern", age: "~3 years",
        summary:
          "Exterior looks freshly done in {photos} — clean cut lines at the joinery and no chalking on the north elevation. On the usual repaint cycle you have several years before this needs money.",
      },
    },
  },

  tired70s: {
    story: "original 1970s throughout, sound but everything is at the end of its life at once",
    foundation: "timber_piles",
    base: { improvements: 5, land: 7, legal: 7, location: 7 },
    fitOut: "dated",
    defects: {
      ext_roof: {
        score: 4, spec: "dated", age: "~50 years (original long-run iron)",
        summary:
          "Rust is showing along the ridge and around the fixings on the north-facing pitch in {photos}, and the coating has chalked off in patches. Original iron of this age is at replacement, not repair.",
        cost: { low: 16000, high: 26000, notes: "Long-run iron re-roof including underlay" },
      },
      liv_insulation: {
        score: 3, spec: "deteriorated", age: "~50 years (original / minimal)",
        summary:
          "Not visible in any photo — inferred from the build era, when ceilings were commonly built with little or no insulation, and nothing in the listing states an upgrade. Assume it needs doing.",
        cost: { low: 2400, high: 3900, notes: "R3.2 ceiling batts plus underfloor blanket" },
      },
      kit_cabinetry: {
        score: 4, spec: "dated", age: "~50 years",
        summary:
          "Original melamine carcasses with timber-edged doors in {photo}, and the laminate benchtop is lifting at the sink cut-out. It works, but it is the kitchen a buyer replaces in the first two years.",
        cost: { low: 14000, high: 24000, notes: "Mid-range kitchen replacement, same footprint" },
      },
      bath_ventilation: {
        score: 2, spec: "deteriorated",
        summary:
          "No extractor visible in {photo} — an openable window only — and there is dark staining on the ceiling above the shower. That is a Healthy Homes item as well as a mould one.",
        cost: { low: 700, high: 1400, notes: "Ducted extractor fan, vented outside" },
      },
      bath_waterproof: {
        score: 4, spec: "dated",
        summary:
          "Not visible — behind tiling of this vintage there is unlikely to be a modern membrane. Fine until the bathroom is opened up, at which point it becomes part of the job.",
        cost: { low: 3000, high: 6000, notes: "Re-waterproof and re-tile the wet area" },
      },
    },
  },

  newBuild: {
    story: "recently built, under current standards, nothing outstanding",
    foundation: "concrete_slab",
    base: { improvements: 9, land: 8, legal: 9, location: 7 },
    fitOut: "modern",
    strengths: { ext_roof: 10, ext_cladding: 9, liv_insulation: 9, bath_ventilation: 9, ext_windows: 9, liv_heating: 9 },
    defects: {
      out_landscaping: {
        score: 5, spec: "dated",
        summary:
          "Grounds are still builder's-finish — lawn established but no planting, and the fence lines look temporary in {photos}. Not a fault, just money most buyers spend in the first year.",
        cost: { low: 6000, high: 18000, notes: "Planting, fencing and basic hard landscaping" },
      },
      land_trees: {
        score: 4,
        summary: "Nothing established on the section yet — expected on a build of this age, and a decade off any real shade or privacy.",
      },
      // A new build genuinely needs little remedial work, but "nothing at all"
      // is not a useful report. These are the two things buyers actually spend
      // on in the first year of a new subdivision home, and both carry cost in
      // the model where landscaping and planting don't.
      out_fencing: {
        score: 4,
        summary:
          "Boundaries are open on two sides in {photos} — normal in a newer subdivision, where fencing is usually left to the owners. Worth pricing before you commit if you have a dog or small children.",
        cost: { low: 4000, high: 9000, notes: "Fencing to two open boundaries, half share where shared" },
      },
      bed_heating: {
        score: 5,
        summary:
          "A single heat pump serves the living area in {photo} and there is no fixed heating visible in any bedroom. Compliant and common in new builds, but the bedrooms will run cold on a still winter night.",
        cost: { low: 2200, high: 4500, notes: "Additional heat pump head or panel heaters to bedrooms" },
      },
    },
  },

  leakyEra: {
    story: "1990s monolithic-clad home from the weathertightness era — the defining risk of the report",
    foundation: "concrete_slab",
    base: { improvements: 6, land: 7, legal: 4, location: 7 },
    fitOut: "dated",
    defects: {
      ext_cladding: {
        score: 3, spec: "deteriorated", age: "~28 years (monolithic plaster)",
        summary:
          "Monolithic plaster cladding with no visible drainage cavity and minimal eaves — the construction type at the centre of New Zealand's weathertightness problem. Photo 2 shows hairline cracking below the first-floor window head, which is exactly where water gets in. Nothing here proves a leak, and nothing here rules one out.",
        cost: { low: 90000, high: 220000, notes: "Full re-clad with a drained cavity, if required" },
      },
      leg_weathertight: {
        score: 2,
        summary:
          "Built inside the 1994–2004 window, monolithic-clad, low eaves. This is the single thing to resolve before going any further: a weathertightness report from a suitably qualified surveyor, and moisture readings, before you spend money on anything else.",
      },
      ext_windows: {
        score: 5, spec: "dated",
        summary:
          "Aluminium joinery of the era in {photo}, face-fixed into the plaster with sealant rather than flashed. Serviceable, but the junctions are the usual entry point and want checking with the cladding.",
      },
      ext_soffits: {
        score: 4, spec: "dated",
        summary: "Eaves are barely 300mm in {photo}, so the walls get the full weather. Characteristic of the era and not something you can change without re-roofing.",
      },
    },
  },

  exRental: {
    story: "long-term rental with deferred maintenance — cosmetically tired, structurally sound",
    foundation: "timber_piles",
    base: { improvements: 5, land: 6, legal: 6, location: 6 },
    fitOut: "dated",
    defects: {
      liv_flooring: {
        score: 4, spec: "dated", age: "~12 years",
        summary:
          "Carpet is flattened through the traffic lines in {photos} and there is a patched section by the hallway door. Vinyl in the kitchen has lifted at the join. Cosmetic, but it is the whole floor.",
        cost: { low: 7000, high: 13000, notes: "Recarpet plus new vinyl to wet areas" },
      },
      liv_ceiling: {
        score: 5, spec: "dated",
        summary: "Ceilings show nail-pops and a patched repair above the hallway in {photo}. Cosmetic, and it points to a place that has been repaired rather than maintained.",
      },
      bath_vanity: {
        score: 3, spec: "deteriorated",
        summary: "Vanity carcass is swollen at the base where water has sat in {photo}, and the mixer is corroded. Replacement rather than repair.",
        cost: { low: 1200, high: 2600, notes: "Vanity, mixer and waste replaced" },
      },
      bath_ventilation: {
        score: 3, spec: "deteriorated",
        summary: "Wall-mounted fan in {photo} that appears to vent into the ceiling space rather than outside — common in rentals and a Healthy Homes failure as well as a moisture one.",
        cost: { low: 600, high: 1200, notes: "Ducted extractor vented through the soffit" },
      },
      out_fencing: {
        score: 4,
        summary: "Boundary fencing is leaning along the rear run in {photo}, with a couple of palings missing. Half-share cost if the neighbour agrees to replace.",
        cost: { low: 2500, high: 6000, notes: "Rear boundary fence, half share" },
      },
    },
  },

  villa: {
    story: "pre-1930 villa with character intact — charm, and the maintenance bill that comes with it",
    foundation: "timber_piles",
    base: { improvements: 6, land: 7, legal: 7, location: 8 },
    fitOut: "dated",
    strengths: { liv_ceiling: 9, liv_size: 9, liv_light: 8 },
    defects: {
      ext_foundation: {
        score: 4,
        summary: "", // computed — see foundationFor()
      },
      ext_cladding: {
        score: 5, spec: "dated", age: "~110 years (original weatherboard)",
        summary:
          "Original rusticated weatherboard, sound overall, but {photo} shows splitting and paint failure on the south elevation where it gets least sun. Boards can be spot-replaced; the repaint is the real cost.",
        cost: { low: 9000, high: 16000, notes: "Weatherboard repairs and full exterior repaint" },
      },
      liv_insulation: {
        score: 3, spec: "deteriorated",
        summary:
          "Not visible, and a villa of this age was built with none. Some have been retrofitted; the listing doesn't say. Assume ceiling and underfloor are both needed.",
        cost: { low: 2600, high: 4200, notes: "Ceiling batts and underfloor blanket" },
      },
      liv_fixtures: {
        score: 4, spec: "dated",
        summary: "Older switch and socket plates in {photo}, and a mix of fitting styles suggesting piecemeal work. Worth an electrician's eye at inspection.",
      },
    },
  },

  coastal: {
    story: "coastal exposure — salt has aged the metalwork faster than the rest of the house",
    foundation: "timber_piles",
    base: { improvements: 6, land: 7, legal: 7, location: 8 },
    fitOut: "dated",
    strengths: { loc_views: 9, liv_light: 9, land_aspect: 9 },
    defects: {
      ext_roof: {
        score: 4, spec: "dated", age: "~22 years",
        summary:
          "Corrosion is visible around the fixings and along the cut edges on the seaward side in {photo}. Salt air roughly halves the life of coated steel, so this is older than its years.",
        cost: { low: 15000, high: 25000, notes: "Re-roof in a coastal-grade coated steel" },
      },
      ext_gutters: {
        score: 4, spec: "dated",
        summary: "Spouting shows staining and pinholing at the joints on the exposed elevation in {photo}. Replace with the roof if you do that work.",
        cost: { low: 3000, high: 6000, notes: "Spouting and downpipes, coastal grade" },
      },
      ext_doors: {
        score: 5, spec: "dated",
        summary: "Aluminium joinery is pitted on the seaward face and the sliding door track looks worn in {photo}. Servicing rather than replacement, for now.",
      },
      ext_paint: {
        score: 4, spec: "dated",
        summary: "Paint has chalked heavily on the exposed elevation in {photo} while the sheltered side still looks fresh — the classic coastal pattern. Exterior repaints come round faster here.",
        cost: { low: 8000, high: 14000, notes: "Full exterior repaint, coastal system" },
      },
    },
  },

  brickTile: {
    story: "solid brick-and-tile, structurally sound, interior untouched since it was built",
    foundation: "concrete_slab",
    base: { improvements: 6, land: 7, legal: 8, location: 7 },
    fitOut: "dated",
    strengths: { ext_cladding: 8, ext_roof: 7, ext_foundation: 8 },
    defects: {
      kit_appliances: {
        score: 4, spec: "dated", age: "~20 years",
        summary: "Original wall oven and separate cooktop in {photo}, both well past their design life. Working, but the next failure is not worth repairing.",
        cost: { low: 3500, high: 7000, notes: "Oven, cooktop and rangehood replaced" },
      },
      bath_shower: {
        score: 4, spec: "dated", age: "~35 years",
        summary: "Acrylic shower liner with a moulded base in {photo}, yellowed and crazed at the corners. Serviceable, dated, and the first thing a buyer changes.",
        cost: { low: 3500, high: 7500, notes: "Shower replacement including waterproofing" },
      },
      liv_insulation: {
        score: 4, spec: "dated",
        summary: "Not visible. Brick-and-tile of this era usually has some ceiling insulation and rarely anything underfloor or in the walls. Ceiling top-up is the cheap win.",
        cost: { low: 1800, high: 3000, notes: "Ceiling insulation top-up to current R-value" },
      },
      liv_heating: {
        score: 5, spec: "dated",
        summary: "A single heat pump in the living room in {photo} and nothing else visible. Fine for the main space, cold at the far end of the house.",
      },
    },
  },

  apartment: {
    story: "apartment — the body corporate matters more than anything inside the front door",
    foundation: "concrete_slab",
    base: { improvements: 7, land: 7, legal: 6, location: 9 },
    fitOut: "modern",
    strengths: { loc_walkability: 10, loc_amenities: 9, loc_transport: 9, ext_foundation: 8 },
    defects: {
      leg_bodycorp: {
        score: 4,
        summary:
          "Unit title, so the body corporate runs the building envelope and you inherit its decisions. Levies, the long-term maintenance plan and the minutes for the last three years are the documents that matter here — a building with a re-clad ahead of it can cost more than the apartment is worth.",
      },
      liv_size: {
        score: 5,
        summary: "Compact open-plan living and dining in {photos}. Efficient, and it will feel tight with more than two people in it.",
      },
      bath_shower: {
        score: 5, spec: "dated", age: "~18 years",
        summary:
          "Original shower with a moulded acrylic base and dated tapware. Working, and showing the wear of a rental-grade fit-out — the silicone at the base has discoloured in {photo}.",
        cost: { low: 4000, high: 8000, notes: "Shower replacement including waterproofing to the wet area" },
      },
      liv_flooring: {
        score: 5, spec: "dated", age: "~18 years",
        summary:
          "Original carpet through the living areas in {photo}, flattened along the traffic line to the balcony door. Serviceable and clearly at the end of its cycle.",
        cost: { low: 5000, high: 9000, notes: "Recarpet living and bedrooms, mid-range" },
      },
      kit_appliances: {
        score: 5, spec: "dated", age: "~18 years",
        summary: "Original oven and cooktop in {photo}, both near the end of their design life. Nothing wrong today; nothing worth repairing when it fails.",
        cost: { low: 3000, high: 6000, notes: "Oven, cooktop and rangehood replaced" },
      },
      bath_ventilation: {
        score: 6, spec: "dated",
        summary: "Ducted extraction into the building's shared riser, which works when the riser is maintained. Worth asking whether it has been.",
      },
    },
  },
};

/**
 * Scale a costed item to THIS property.
 *
 * Archetype costs are written for a notional 150m² house at a middling regional
 * rate. Area drives most trade work, and labour and materials are dearer where
 * land is dear, so both nudge the figure. Rounded to the nearest $100 so the
 * report never shows a spuriously precise number like $17,432.
 */
const BASE_FLOOR_SQM = 150;

function scaleCost(
  cost: { low: number; high: number; notes: string },
  profile: SampleProfile
): { low: number; high: number; notes: string } {
  const areaFactor = 0.7 + 0.3 * ((profile.floorAreaSqm || BASE_FLOOR_SQM) / BASE_FLOOR_SQM);
  // A $ per m² proxy for the regional rate, clamped so it nudges rather than swings.
  const perSqm = profile.askingPrice / (profile.floorAreaSqm || BASE_FLOOR_SQM);
  const regionFactor = Math.max(0.85, Math.min(1.25, 0.85 + perSqm / 45_000));
  const f = areaFactor * regionFactor;
  const round = (n: number) => Math.round((n * f) / 100) * 100;
  return { low: round(cost.low), high: round(cost.high), notes: cost.notes };
}

/**
 * Where each part of the house appears in the gallery.
 *
 * A real report earns its keep partly by citing evidence — "Photo 4 shows rust
 * bleeding through the ridge flashing" is what separates an assessment from an
 * opinion, and it is the thing a reader checks for themselves. The samples cite
 * photos the same way, so a visitor sees the format they'd be paying for.
 *
 * Listings are shot in a conventional order: street and exterior first, then
 * living, kitchen, bathroom, bedrooms, then garage, grounds and an aerial. Each
 * category is given a slice of the gallery, and the slice is nudged per property
 * so thirty reports don't all point at photo 4.
 */
const PHOTO_SECTIONS: { match: RegExp; start: number; span: number }[] = [
  { match: /^(ext_|gar_type|out_driveway)/, start: 0.0, span: 0.28 },
  { match: /^liv_/, start: 0.28, span: 0.18 },
  { match: /^kit_/, start: 0.44, span: 0.16 },
  { match: /^bath_/, start: 0.58, span: 0.16 },
  { match: /^bed_/, start: 0.72, span: 0.14 },
  { match: /^(gar_|out_)/, start: 0.84, span: 0.12 },
  { match: /^land_/, start: 0.9, span: 0.1 },
];

interface PhotoPlan {
  count: number;
  /** Photo numbers for an item, or [] when it isn't something a camera sees. */
  forItem: (id: string) => number[];
}

function photoPlan(profile: SampleProfile): PhotoPlan {
  // A real listing runs 10–20 shots; bigger houses get more.
  const count = 11 + seededInt(`${profile.seedId}:gallery`, 8) + (profile.floorAreaSqm > 180 ? 2 : 0);
  return {
    count,
    forItem: (id: string) => {
      const section = PHOTO_SECTIONS.find((s) => s.match.test(id));
      if (!section) return [];
      const from = Math.floor(section.start * count);
      const width = Math.max(1, Math.floor(section.span * count));
      const first = 1 + Math.min(count - 1, from + seededInt(`${profile.seedId}:${id}`, width));
      // Roughly a third of items cite a second angle, as a real report does.
      const pair = seededInt(`${profile.seedId}:${id}:pair`, 3) === 0 && first < count;
      return pair ? [first, first + 1] : [first];
    },
  };
}

/**
 * Put this property's photo numbers into archetype copy.
 *
 * The prose is written with {photo} / {photos} rather than fixed numbers so the
 * same sentence cites photo 4 on one house and photo 9 on another — thirty
 * reports all pointing at "photo 4" would give the game away immediately.
 */
function fillPhotos(text: string, refs: number[], plan: PhotoPlan): string {
  const single = refs.length ? refs[0] : 1 + seededInt(text, plan.count);
  const second = Math.min(plan.count, single + 1);
  return text
    .replace(/\{photos\}/g, `photos ${single} and ${second}`)
    .replace(/\{photo\}/g, `photo ${single}`);
}

/** "photo 4" / "photos 4 and 5", or nothing when there is no photo to cite. */
function citation(refs: number[], plural = false): string {
  if (refs.length === 0) return "";
  if (refs.length === 1) return `photo ${refs[0]}`;
  return plural ? `photos ${refs[0]} and ${refs[1]}` : `photo ${refs[0]}`;
}

/** Small, stable pseudo-randomness so two properties never read identically. */
function seededInt(key: string, max: number): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % max;
}

export interface SampleProfile {
  /** The map seed id this belongs to — the pin links to `sample-<seedId>`. */
  seedId: string;
  address: string;
  suburb: string;
  city: string;
  region: string;
  buildYear: number;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  carParks: number;
  floorAreaSqm: number;
  landAreaSqm: number | null;
  askingPrice: number;
  priceMethod: "fixed" | "auction" | "deadline" | "price_by_negotiation";
  daysOnMarket: number;
  description: string;
  archetype: Archetype;
}

/**
 * Thirty properties, one per map pin.
 *
 * Every street name was checked against the LINZ address layer and matches zero
 * addresses nationally — see the header. Suburbs, prices and eras are real
 * enough to be useful; the houses are not.
 */
export const SAMPLE_PROFILES: SampleProfile[] = [
  { seedId: "seed-01", address: "3 Ashcombe Avenue", suburb: "Remuera", city: "Auckland", region: "Auckland", buildYear: 1972, propertyType: "house", bedrooms: 4, bathrooms: 3, carParks: 2, floorAreaSqm: 220, landAreaSqm: 650, askingPrice: 1850000, priceMethod: "fixed", daysOnMarket: 8, description: "Renovated throughout in recent years with little left to do.", archetype: "renovated" },
  { seedId: "seed-02", address: "10 Bellhaven Road", suburb: "Ponsonby", city: "Auckland", region: "Auckland", buildYear: 1908, propertyType: "house", bedrooms: 3, bathrooms: 2, carParks: 1, floorAreaSqm: 180, landAreaSqm: 320, askingPrice: 1650000, priceMethod: "auction", daysOnMarket: 21, description: "Character home with original detailing retained throughout.", archetype: "villa" },
  { seedId: "seed-03", address: "17 Cloudsley Road", suburb: "Mount Eden", city: "Auckland", region: "Auckland", buildYear: 1968, propertyType: "house", bedrooms: 4, bathrooms: 2, carParks: 2, floorAreaSqm: 160, landAreaSqm: 480, askingPrice: 1250000, priceMethod: "deadline", daysOnMarket: 34, description: "Original family home, held a long time, ready for someone to put their stamp on it.", archetype: "tired70s" },
  { seedId: "seed-04", address: "24 Corrigan Rise", suburb: "Manukau", city: "Auckland", region: "Auckland", buildYear: 1988, propertyType: "house", bedrooms: 4, bathrooms: 2, carParks: 2, floorAreaSqm: 150, landAreaSqm: 500, askingPrice: 820000, priceMethod: "price_by_negotiation", daysOnMarket: 47, description: "Long-term rental, tenants in place, sold as is where is.", archetype: "exRental" },
  { seedId: "seed-05", address: "31 Ellerby Road", suburb: "Takapuna", city: "Auckland", region: "Auckland", buildYear: 1998, propertyType: "house", bedrooms: 4, bathrooms: 3, carParks: 2, floorAreaSqm: 200, landAreaSqm: 620, askingPrice: 1950000, priceMethod: "fixed", daysOnMarket: 60, description: "Two-level plaster-clad home with generous indoor-outdoor flow.", archetype: "leakyEra" },
  { seedId: "seed-06", address: "38 Fernbrook Rise", suburb: "Henderson", city: "Auckland", region: "Auckland", buildYear: 1976, propertyType: "house", bedrooms: 3, bathrooms: 1, carParks: 1, floorAreaSqm: 140, landAreaSqm: 550, askingPrice: 760000, priceMethod: "auction", daysOnMarket: 73, description: "Original family home, held a long time, ready for someone to put their stamp on it.", archetype: "tired70s" },
  { seedId: "seed-07", address: "45 Harrowfield Lane", suburb: "Papakura", city: "Auckland", region: "Auckland", buildYear: 1992, propertyType: "house", bedrooms: 3, bathrooms: 1, carParks: 1, floorAreaSqm: 130, landAreaSqm: 480, askingPrice: 640000, priceMethod: "deadline", daysOnMarket: 86, description: "Long-term rental, tenants in place, sold as is where is.", archetype: "exRental" },
  { seedId: "seed-19", address: "52 Kaituna Bend", suburb: "Newmarket", city: "Auckland", region: "Auckland", buildYear: 2007, propertyType: "apartment", bedrooms: 3, bathrooms: 2, carParks: 1, floorAreaSqm: 190, landAreaSqm: null, askingPrice: 2050000, priceMethod: "price_by_negotiation", daysOnMarket: 99, description: "Well-positioned apartment with secure parking and city convenience.", archetype: "apartment" },
  { seedId: "seed-08", address: "59 Kingsmoor Street", suburb: "Te Aro", city: "Wellington", region: "Wellington", buildYear: 2004, propertyType: "apartment", bedrooms: 2, bathrooms: 1, carParks: 1, floorAreaSqm: 75, landAreaSqm: null, askingPrice: 720000, priceMethod: "fixed", daysOnMarket: 17, description: "Well-positioned apartment with secure parking and city convenience.", archetype: "apartment" },
  { seedId: "seed-09", address: "66 Kowhaiwhai Road", suburb: "Karori", city: "Wellington", region: "Wellington", buildYear: 1969, propertyType: "house", bedrooms: 4, bathrooms: 2, carParks: 2, floorAreaSqm: 150, landAreaSqm: 600, askingPrice: 980000, priceMethod: "auction", daysOnMarket: 30, description: "Original family home, held a long time, ready for someone to put their stamp on it.", archetype: "tired70s" },
  { seedId: "seed-10", address: "73 Marlstone Street", suburb: "Miramar", city: "Wellington", region: "Wellington", buildYear: 1924, propertyType: "house", bedrooms: 3, bathrooms: 1, carParks: 1, floorAreaSqm: 140, landAreaSqm: 460, askingPrice: 890000, priceMethod: "deadline", daysOnMarket: 43, description: "Character home with original detailing retained throughout.", archetype: "villa" },
  { seedId: "seed-11", address: "80 Milldale Grove", suburb: "Newtown", city: "Wellington", region: "Wellington", buildYear: 1985, propertyType: "house", bedrooms: 3, bathrooms: 1, carParks: 1, floorAreaSqm: 130, landAreaSqm: 350, askingPrice: 850000, priceMethod: "price_by_negotiation", daysOnMarket: 56, description: "Long-term rental, tenants in place, sold as is where is.", archetype: "exRental" },
  { seedId: "seed-12", address: "87 Ngaio Bank Road", suburb: "Johnsonville", city: "Wellington", region: "Wellington", buildYear: 2016, propertyType: "house", bedrooms: 3, bathrooms: 2, carParks: 1, floorAreaSqm: 135, landAreaSqm: 450, askingPrice: 700000, priceMethod: "fixed", daysOnMarket: 69, description: "Near-new home built under current standards, double glazed throughout.", archetype: "newBuild" },
  { seedId: "seed-20", address: "8 Ohinerau Way", suburb: "Island Bay", city: "Wellington", region: "Wellington", buildYear: 1958, propertyType: "house", bedrooms: 4, bathrooms: 2, carParks: 2, floorAreaSqm: 160, landAreaSqm: 480, askingPrice: 1080000, priceMethod: "auction", daysOnMarket: 82, description: "A short walk from the water, sheltered outdoor living.", archetype: "coastal" },
  { seedId: "seed-13", address: "15 Pipers Glen", suburb: "Merivale", city: "Christchurch", region: "Canterbury", buildYear: 1979, propertyType: "house", bedrooms: 4, bathrooms: 3, carParks: 2, floorAreaSqm: 200, landAreaSqm: 700, askingPrice: 1450000, priceMethod: "deadline", daysOnMarket: 95, description: "Renovated throughout in recent years with little left to do.", archetype: "renovated" },
  { seedId: "seed-14", address: "22 Pipiwharauroa Street", suburb: "Riccarton", city: "Christchurch", region: "Canterbury", buildYear: 1965, propertyType: "house", bedrooms: 3, bathrooms: 2, carParks: 1, floorAreaSqm: 140, landAreaSqm: 500, askingPrice: 720000, priceMethod: "price_by_negotiation", daysOnMarket: 13, description: "Solid brick and tile home on a settled street.", archetype: "brickTile" },
  { seedId: "seed-15", address: "29 Puriri Fields Road", suburb: "Sumner", city: "Christchurch", region: "Canterbury", buildYear: 1996, propertyType: "house", bedrooms: 3, bathrooms: 2, carParks: 1, floorAreaSqm: 160, landAreaSqm: 540, askingPrice: 950000, priceMethod: "fixed", daysOnMarket: 26, description: "A short walk from the water, sheltered outdoor living.", archetype: "coastal" },
  { seedId: "seed-16", address: "36 Rowanberry Street", suburb: "Ilam", city: "Christchurch", region: "Canterbury", buildYear: 1983, propertyType: "house", bedrooms: 4, bathrooms: 2, carParks: 2, floorAreaSqm: 150, landAreaSqm: 520, askingPrice: 780000, priceMethod: "auction", daysOnMarket: 39, description: "Solid brick and tile home on a settled street.", archetype: "brickTile" },
  { seedId: "seed-17", address: "43 Silverbeach Road", suburb: "Papanui", city: "Christchurch", region: "Canterbury", buildYear: 1978, propertyType: "house", bedrooms: 3, bathrooms: 1, carParks: 1, floorAreaSqm: 120, landAreaSqm: 460, askingPrice: 590000, priceMethod: "deadline", daysOnMarket: 52, description: "Original family home, held a long time, ready for someone to put their stamp on it.", archetype: "tired70s" },
  { seedId: "seed-18", address: "50 Tarabelle Street", suburb: "Addington", city: "Christchurch", region: "Canterbury", buildYear: 2018, propertyType: "townhouse", bedrooms: 2, bathrooms: 1, carParks: 1, floorAreaSqm: 95, landAreaSqm: 180, askingPrice: 520000, priceMethod: "price_by_negotiation", daysOnMarket: 65, description: "Near-new home built under current standards, double glazed throughout.", archetype: "newBuild" },
  { seedId: "seed-31", address: "57 Tuiwood Avenue", suburb: "Chartwell", city: "Hamilton", region: "Waikato", buildYear: 1981, propertyType: "house", bedrooms: 4, bathrooms: 2, carParks: 2, floorAreaSqm: 175, landAreaSqm: 620, askingPrice: 780000, priceMethod: "fixed", daysOnMarket: 78, description: "Solid brick and tile home on a settled street.", archetype: "brickTile" },
  { seedId: "seed-32", address: "64 Westbourne Grove", suburb: "Mount Maunganui", city: "Tauranga", region: "Bay of Plenty", buildYear: 1989, propertyType: "house", bedrooms: 4, bathrooms: 3, carParks: 2, floorAreaSqm: 210, landAreaSqm: 480, askingPrice: 1650000, priceMethod: "auction", daysOnMarket: 91, description: "A short walk from the water, sheltered outdoor living.", archetype: "coastal" },
  { seedId: "seed-21", address: "71 Wrenfield Road", suburb: "Napier South", city: "Napier", region: "Hawke's Bay", buildYear: 1935, propertyType: "house", bedrooms: 3, bathrooms: 2, carParks: 1, floorAreaSqm: 155, landAreaSqm: 590, askingPrice: 850000, priceMethod: "deadline", daysOnMarket: 9, description: "Character home with original detailing retained throughout.", archetype: "villa" },
  { seedId: "seed-22", address: "78 Ashcombe Terrace", suburb: "New Plymouth Central", city: "New Plymouth", region: "Taranaki", buildYear: 1973, propertyType: "house", bedrooms: 3, bathrooms: 1, carParks: 1, floorAreaSqm: 130, landAreaSqm: 510, askingPrice: 620000, priceMethod: "price_by_negotiation", daysOnMarket: 22, description: "Original family home, held a long time, ready for someone to put their stamp on it.", archetype: "tired70s" },
  { seedId: "seed-23", address: "85 Bellhaven Terrace", suburb: "Rotorua Central", city: "Rotorua", region: "Bay of Plenty", buildYear: 1970, propertyType: "house", bedrooms: 3, bathrooms: 1, carParks: 1, floorAreaSqm: 115, landAreaSqm: 640, askingPrice: 540000, priceMethod: "fixed", daysOnMarket: 35, description: "Long-term rental, tenants in place, sold as is where is.", archetype: "exRental" },
  { seedId: "seed-24", address: "6 Cloudsley Street", suburb: "Nelson South", city: "Nelson", region: "Nelson", buildYear: 1995, propertyType: "house", bedrooms: 3, bathrooms: 2, carParks: 1, floorAreaSqm: 145, landAreaSqm: 480, askingPrice: 790000, priceMethod: "auction", daysOnMarket: 48, description: "Two-level plaster-clad home with generous indoor-outdoor flow.", archetype: "leakyEra" },
  { seedId: "seed-25", address: "13 Corrigan Street", suburb: "Arrowtown", city: "Queenstown", region: "Otago", buildYear: 2012, propertyType: "house", bedrooms: 4, bathrooms: 3, carParks: 2, floorAreaSqm: 230, landAreaSqm: 900, askingPrice: 1950000, priceMethod: "deadline", daysOnMarket: 61, description: "Near-new home built under current standards, double glazed throughout.", archetype: "newBuild" },
  { seedId: "seed-26", address: "20 Ellerby Place", suburb: "Dunedin Central", city: "Dunedin", region: "Otago", buildYear: 1925, propertyType: "house", bedrooms: 4, bathrooms: 2, carParks: 2, floorAreaSqm: 160, landAreaSqm: 420, askingPrice: 610000, priceMethod: "price_by_negotiation", daysOnMarket: 74, description: "Character home with original detailing retained throughout.", archetype: "villa" },
  { seedId: "seed-27", address: "27 Fernbrook Street", suburb: "Hokowhitu", city: "Palmerston North", region: "Manawatu", buildYear: 1983, propertyType: "house", bedrooms: 3, bathrooms: 2, carParks: 1, floorAreaSqm: 140, landAreaSqm: 560, askingPrice: 640000, priceMethod: "fixed", daysOnMarket: 87, description: "Solid brick and tile home on a settled street.", archetype: "brickTile" },
  { seedId: "seed-28", address: "34 Harrowfield Road", suburb: "Hokitika", city: "Hokitika", region: "West Coast", buildYear: 1966, propertyType: "house", bedrooms: 3, bathrooms: 1, carParks: 1, floorAreaSqm: 110, landAreaSqm: 700, askingPrice: 385000, priceMethod: "auction", daysOnMarket: 100, description: "Original family home, held a long time, ready for someone to put their stamp on it.", archetype: "tired70s" },
];


const BY_ID = new Map(SAMPLE_PROFILES.map((p) => [`${SAMPLE_ID_PREFIX}${p.seedId}`, p]));

export const isSampleReportId = (id: string): boolean => BY_ID.has(id);

/** Generic, band-appropriate copy for the long tail of items. */
function bandSummary(label: string, score: number, era: number, refs: number[]): string {
  const age = new Date().getFullYear() - era;
  const cite = refs.length ? `${citation(refs, true).replace(/^p/, "P")} ` : "";
  const inPhoto = refs.length ? ` in ${citation(refs)}` : "";
  if (score >= 8) return `${cite}${cite ? "shows" : `${label} presents`} ${cite ? `${label.toLowerCase()} in good order` : "well"} — no defects visible, consistent with a property of this age that has been kept up.`;
  if (score >= 6) return `${label} looks serviceable${inPhoto}. Nothing needs attention now, though at ${age} years it is closer to the back half of its life than the front.`;
  if (score >= 5) return `${label} is showing its age${inPhoto} — functional, dated, and a candidate for the improvement list rather than the repair list.`;
  return `${label} is worn enough to need attention${inPhoto}, and at ${age} years replacement is likely to be better value than repair.`;
}

function foundationFor(profile: SampleProfile): { score: UrgencyScore; tier: 1 | 2 | 3; summary: string } {
  const arch = ARCHETYPES[profile.archetype];
  // Older piled houses on the demo map show the classic tell; newer ones don't.
  const symptoms =
    arch.foundation === "timber_piles" && profile.buildYear < 1940 && seededInt(profile.seedId, 3) === 0
      ? (["sloping_floor", "door_gaps"] as const)
      : [];
  const a = assessFoundation({
    type: arch.foundation,
    buildYear: profile.buildYear,
    symptoms: [...symptoms],
  });
  return { score: a.score as UrgencyScore, tier: a.confidenceTier, summary: a.rationale };
}

function buildSubItems(profile: SampleProfile): SubItem[] {
  const arch = ARCHETYPES[profile.archetype];
  const foundation = foundationFor(profile);
  const plan = photoPlan(profile);
  const out: SubItem[] = [];

  for (const item of SCORING_MODEL) {
    // Conditionals only where the archetype genuinely has them.
    if (item.id === "leg_bodycorp" && profile.propertyType !== "apartment") continue;
    if (item.id === "leg_crosslease") continue;
    if (item.conditional && !["leg_bodycorp"].includes(item.id)) continue;
    // No land items on an apartment.
    if (profile.landAreaSqm == null && item.inspection === "land") continue;

    const defect = arch.defects[item.id];
    const strength = arch.strengths?.[item.id];
    const isImprovement = item.inspection === "improvements";
    const tax = SOURCE_TAXONOMY[item.id];

    let score: UrgencyScore;
    let tier: 1 | 2 | 3;
    let summary: string;
    let spec: SpecTier | undefined;
    let age: string | undefined;
    let cost: { low: number; high: number; notes: string } | null = null;

    // What this item was read from. Items nobody can see carry no photo — the
    // citation has to be true to the finding or it is decoration.
    const unseeable = ["bath_waterproof", "liv_insulation", "leg_weathertight"].includes(item.id);
    const refs = unseeable || !isImprovement ? [] : plan.forItem(item.id);

    if (item.id === "ext_foundation") {
      score = foundation.score;
      tier = foundation.tier;
      summary = foundation.summary;
      spec = usesSpecTier(item) ? arch.fitOut : undefined;
    } else if (defect) {
      score = defect.score;
      tier = 1;
      summary = fillPhotos(defect.summary, refs, plan);
      spec = defect.spec ?? (usesSpecTier(item) ? arch.fitOut : undefined);
      age = defect.age;
      cost = item.costBearing && defect.cost ? scaleCost(defect.cost, profile) : null;
    } else {
      // Baseline for the inspection, nudged per property so no two read alike.
      const base = arch.base[item.inspection as keyof ArchetypeSpec["base"]] ?? 7;
      const jitter = seededInt(`${profile.seedId}:${item.id}`, 3) - 1;
      score = Math.max(1, Math.min(10, strength ?? base + jitter)) as UrgencyScore;
      spec = usesSpecTier(item) ? arch.fitOut : undefined;
      // Items nobody can see stay Tier 3 and carry no score — the same rule the
      // live analysis follows. See lib/scoring/engine.ts.
      tier = unseeable ? 3 : isImprovement ? 2 : tax && ["title", "photo", "linz", "moe_zones"].includes(tax.sourceType) ? 1 : 3;
      summary = isImprovement
        ? bandSummary(item.label, score, profile.buildYear, refs)
        : `Source: ${tax?.source ?? "listing facts"}. ${bandSummary(item.label, score, profile.buildYear, [])}`;
    }

    // A Tier 3 item does not carry a score — the engine drops it either way, and
    // showing a number next to "not visible" is the over-claim this app removed.
    const scored = tier === 3 && !defect && item.id !== "ext_foundation" ? null : score;

    out.push({
      id: item.id,
      name: item.label,
      material: isImprovement ? materialFor(item.id, arch, profile.archetype) : undefined,
      estimatedAge: isImprovement ? age ?? `~${new Date().getFullYear() - profile.buildYear} years` : "—",
      condition: urgencyLabel(scored),
      score: scored,
      urgencyLabel: urgencyLabel(scored),
      confidenceTier: tier,
      evidenceSource: isImprovement ? "Listing photos" : tax?.source ?? "Listing facts",
      aiSummary: summary,
      estimatedReplacementCost: cost,
      replacementCostWeight: 0,
      specTier: spec,
      ...(item.id === "land_topography"
        ? { slopeBand: (["flat", "gentle", "moderate"] as const)[seededInt(profile.seedId, 3)], usableLandPct: 70 + seededInt(profile.seedId, 25) }
        : {}),
      renovationLink: !!cost,
      healthyHomesLink: item.affectsHealthyHomes,
      photoReferences: refs,
    } as SubItem);
  }
  return out;
}

/** The full report behind one map pin, or null if the id isn't a sample. */
export function buildSampleReport(id: string): StoredReport | null {
  const profile = BY_ID.get(id);
  if (!profile) return null;

  const assessment: Assessment = {
    subItems: buildSubItems(profile),
    extraDwellings: [],
    penalties: [],
    context: {
      titleType: profile.propertyType === "apartment" ? "unit_title" : "freehold",
      hasChimney: profile.buildYear < 1960,
      hasSolar: false,
      hasRetainingWalls: false,
      hasPool: false,
      hasBodyCorporate: profile.propertyType === "apartment",
    },
  };
  const scores = scoreBoth(assessment);

  const listing = {
    ...emptyListing(`https://example.co.nz/sample/${profile.seedId}`, "unknown"),
    listingId: id,
    address: profile.address,
    suburb: profile.suburb,
    city: profile.city,
    region: profile.region,
    askingPrice: profile.askingPrice,
    priceMethod: profile.priceMethod,
    priceText:
      profile.priceMethod === "auction"
        ? "Auction"
        : profile.priceMethod === "deadline"
          ? "Deadline sale"
          : profile.priceMethod === "price_by_negotiation"
            ? "By negotiation"
            : `$${profile.askingPrice.toLocaleString("en-NZ")}`,
    bedrooms: profile.bedrooms,
    bathrooms: profile.bathrooms,
    carParks: profile.carParks,
    floorAreaSqm: profile.floorAreaSqm,
    landAreaSqm: profile.landAreaSqm,
    propertyType: profile.propertyType,
    titleType: profile.propertyType === "apartment" ? ("unit_title" as const) : ("freehold" as const),
    buildYear: profile.buildYear,
    description: profile.description,
    daysOnMarket: profile.daysOnMarket,
    photoUrls: Array.from({ length: photoPlan(profile).count }, (_, i) => `sample-photo-${i + 1}`),
    scrapedOk: true,
  };

  return {
    id,
    createdAt: "2026-08-01T00:00:00.000Z",
    listing,
    context: assessment.context,
    subItems: assessment.subItems,
    extraDwellings: [],
    penalties: [],
    scores,
    gaps: [],
    photosAnalysed: photoPlan(profile).count,
    model: "claude-sonnet-5 (sample)",
  };
}
