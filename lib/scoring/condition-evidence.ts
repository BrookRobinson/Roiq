// ============================================================
// What the photographs show — the evidence behind a condition and an age.
//
// The valuation's "visual" step used to list only defects, so every item in
// fair or good order read "Nothing visibly wrong in the photographs". That
// says the house is brand new. It isn't: a 6/10 is a 6 because of something —
// chalking on the paint, a flattened carpet in the traffic lane, a mixer
// style that dates a bathroom. That is the evidence a reader needs to agree
// or disagree with the age and the condition, so it is what this step shows.
//
// Live reports carry it from the analysis (`condition_evidence`). Reports
// analysed before that field existed fall back to what they DO hold: the
// defect, plus the sentences of the assessment that cite a photograph. The
// sample map reports are generated, so they use the phrase table below,
// banded by condition.
//
// Dependency-free so a verify script can load it with plain node.
// ============================================================

interface Signs {
  /** What a sound, recent one looks like in a photo. */
  good: [string, string];
  /** What wear looks like, lightest first. */
  wear: [string, string, string];
}

const SIGNS: Record<string, Signs> = {
  ext_foundation: {
    good: ["No cracking or spalling in the visible footing", "Base course reads straight and level along the visible walls"],
    wear: ["Fine cracking in the base course at the corners", "Base course steps out of line along one wall", "Cracking runs up from the footing into the cladding"],
  },
  ext_roof: {
    good: ["Colour is even across the sheets, with no chalking or fading", "Flashings and laps are crisp with no rust at the fixings"],
    wear: ["Paint finish has faded and chalked on the sunny faces", "Surface rust showing at the laps and around the fixings", "Rust through at the laps and some fixings lifted"],
  },
  ext_cladding: {
    good: ["Boards are straight with tight joints and no splits", "No staining or swelling at the base of the walls"],
    wear: ["Paint has dulled and some board ends are opening up", "Splits and weathered ends on the exposed faces", "Boards cupped or rotting at the base of the walls"],
  },
  ext_windows: {
    good: ["Frames have a current profile, square and clean", "Seals and glazing beads look intact"],
    wear: ["Oxidised, dull finish on the aluminium frames", "Single glazing in an older frame profile", "Condensation staining and failed seals at the reveals"],
  },
  ext_decking: {
    good: ["Boards are flat with an even colour and tight fixings", "Balustrade is plumb and secure-looking"],
    wear: ["Boards have greyed and weathered", "Cupping and raised fixings across the boards", "Soft, split or rotting boards and a loose balustrade"],
  },
  ext_gutters: {
    good: ["Gutter lines run true with even falls", "No staining or overflow marks on the fascia below"],
    wear: ["Finish faded along the gutter runs", "Overflow staining on the fascia below the gutter", "Sagging runs and rust at the joints and outlets"],
  },
  ext_soffits: {
    good: ["Fascia boards are straight with no flaking", "Soffit linings are flat with no staining"],
    wear: ["Paint on the fascias is dull and starting to flake", "Staining on the soffit linings near the gutters", "Sagging or rotten sections in the soffits and fascias"],
  },
  ext_doors: {
    good: ["Finish is intact on the weather side", "Doors sit square in their frames with clean hardware"],
    wear: ["Finish weathered on the weather side of the doors", "Hardware dated and the frames scuffed", "Swollen or rotting bottom rails and gaps at the frame"],
  },
  ext_paint: {
    good: ["Colour is even with no chalking or peeling", "Crisp paint lines at the trims and corners"],
    wear: ["Chalking and fading on the sunny elevations", "Peeling and bare timber showing at the trims", "Widespread flaking with bare timber on several faces"],
  },
  ext_chimney: {
    good: ["Mortar joints are full and the stack is plumb", "Flashing at the roof is intact"],
    wear: ["Weathered mortar joints near the top of the stack", "Staining at the flashing where it meets the roof", "Cracked or missing mortar and a stack out of plumb"],
  },
  kit_cabinetry: {
    good: ["Doors are aligned with even gaps and a current profile", "No swelling or chipping at the edges"],
    wear: ["Door style dates the kitchen and the edges are worn", "Chipped edges and misaligned doors", "Swollen carcasses and doors that no longer close cleanly"],
  },
  kit_appliances: {
    good: ["Current-model appliances in a matching finish", "No visible wear on the cooktop or oven door"],
    wear: ["Appliances are an older generation and mismatched", "Wear on the cooktop surface and oven door", "Freestanding appliances well past their usual life"],
  },
  kit_benchtop: {
    good: ["Surface is clean with no chips, burns or lifting joins", "Edge profile is a current style"],
    wear: ["Surface is scratched and dull in the working area", "Chipped edges and a lifting join", "Burns, swelling or a failed join near the sink"],
  },
  kit_flooring: {
    good: ["Floor is flat with no wear through the traffic area", "Joins are tight and the edges finished"],
    wear: ["Wear in front of the bench and the sink", "Lifting joins and stained patches", "Worn through to the backing in the traffic area"],
  },
  kit_sink: {
    good: ["Sink and mixer are a current style with a clean finish", "Silicone at the bench is clean and intact"],
    wear: ["Tapware is an older style with some wear on the finish", "Discoloured silicone around the sink", "Corroded mixer and staining around the sink cut-out"],
  },
  kit_splashback: {
    good: ["Splashback is clean with intact grout or seals", "A current material and finish"],
    wear: ["Grout is discoloured behind the cooktop", "Dated tile and cracked grout lines", "Cracked tiles or a lifting panel behind the sink"],
  },
  bath_shower: {
    good: ["Enclosure and mixer are a current style", "Seals and grout are clean with no staining"],
    wear: ["Mixer and enclosure date the bathroom", "Discoloured grout and silicone at the tray", "Mould in the grout and failed seals at the base"],
  },
  bath_waterproof: {
    good: ["Grout and seals at the floor junction look intact", "No swelling in the linings around the wet area"],
    wear: ["Grout and seals at the floor junction are discoloured", "Staining on the floor or linings beside the shower", "Swollen or staining linings next to the wet area"],
  },
  bath_hotwater: {
    good: ["A current-model unit with clean connections", "No staining or corrosion around the valves"],
    wear: ["An older model with dated fittings", "Corrosion around the valves and connections", "Staining below the unit and heavy corrosion"],
  },
  bath_vanity: {
    good: ["Vanity and mixer are a current style", "No swelling at the base of the carcass"],
    wear: ["Vanity style dates the room and the finish is worn", "Worn edges and a dull mixer finish", "Swollen carcass base where water has sat"],
  },
  bath_toilet: {
    good: ["A current back-to-wall or close-coupled suite", "Clean seal at the floor"],
    wear: ["An older suite style", "Staining at the base where it meets the floor", "Cracked cistern lid or a failed seal at the floor"],
  },
  bath_ventilation: {
    good: ["An extractor fan is visible in the ceiling", "No mould on the ceiling above the shower"],
    wear: ["Only an opening window to vent the room", "Light mould spotting on the ceiling above the shower", "Mould across the ceiling and no extraction visible"],
  },
  bath_flooring: {
    good: ["Floor is clean with intact grout and seals", "No lifting at the edges or around the toilet"],
    wear: ["Grout is discoloured across the floor", "Cracked tiles or lifting vinyl at the edges", "Staining and lifting around the toilet and shower"],
  },
  liv_heating: {
    good: ["A current heat pump or fixed heater is visible", "Unit is clean with no visible wear"],
    wear: ["An older fixed heater model", "Only a wood burner or portable heaters visible", "No fixed heating visible in the living area"],
  },
  liv_fixtures: {
    good: ["Current switches and LED fittings throughout", "Fittings sit flush with no scorching or damage"],
    wear: ["Older switch plates and pendant fittings", "Mixed fittings from several eras", "Round switches and old fittings that suggest original wiring"],
  },
  liv_insulation: {
    good: ["Ceiling insulation visible where the photos show the roof space", "Build era suggests insulation to code"],
    wear: ["Insulation visible but compressed in places", "Thin or patchy insulation where the roof space shows", "No insulation visible where the roof space shows"],
  },
  liv_flooring: {
    good: ["Floor is even with no wear in the traffic lanes", "Edges and transitions are finished cleanly"],
    wear: ["Carpet flattened through the traffic lanes", "Worn patches and lifting at the doorways", "Worn through to the backing in the main traffic path"],
  },
  liv_walls: {
    good: ["Walls are flat and evenly painted", "No cracks, bulges or staining visible"],
    wear: ["Scuffing and minor dents at the traffic points", "Fine cracks at the corners of doors and windows", "Staining or bulging linings low on the exterior walls"],
  },
  liv_ceiling: {
    good: ["No stains, cracks or sagging visible", "Ceilings are flat with clean cornice lines"],
    wear: ["Nail-pops and fine cracks along the joins", "Hairline cracking along the cornice", "Staining or sagging that points to a past leak"],
  },
  bed_heating: {
    good: ["Units are a current model", "Fixed heating visible in the bedrooms"],
    wear: ["Older fixed heaters in some bedrooms", "Heating in the main bedroom only", "No fixed heating visible in the bedrooms"],
  },
  bed_storage: {
    good: ["Built-in wardrobes with current doors and fit-out", "Doors run true in their tracks"],
    wear: ["Wardrobe doors are an older style", "Doors off their tracks or damaged", "Small or missing wardrobes in the bedrooms"],
  },
  bed_flooring: {
    good: ["Floor is even with no visible wear", "Clean edges at the skirtings"],
    wear: ["Carpet flattened at the doorways", "Stained or worn patches across the room", "Worn through or lifting across the room"],
  },
  bed_ceiling: {
    good: ["No stains or cracks visible", "Ceilings are flat and evenly painted"],
    wear: ["Nail-pops along the sheet joins", "Fine cracks at the cornice", "Staining or sagging in a bedroom ceiling"],
  },
  ext_solar: {
    good: ["Panels are a current format, clean and evenly mounted", "Frames and mounting rails show no corrosion"],
    wear: ["Panels are an older, smaller format", "Dirt build-up and discoloured cells across the array", "Corroded frames or panels lifting on their mounts"],
  },
  gar_power: {
    good: ["Fittings are a current style", "Power points and lighting are visible in the garage"],
    wear: ["Outlets and lighting are an older style", "Surface-mounted cabling and old fittings", "No power or lighting visible in the garage"],
  },
  gar_construction: {
    good: ["Walls and roof are straight with a sound finish", "Structure matches the house in age and material"],
    wear: ["Finish weathered on the exposed faces", "Cracking or movement in the walls", "Rot, rust or sagging in the structure"],
  },
  gar_door: {
    good: ["Door panels are straight with an even finish", "Opener and tracks look current"],
    wear: ["Door finish faded and panels dented", "An older tilt or roller door with worn hardware", "Door out of line in its frame and hardware corroded"],
  },
  gar_floor: {
    good: ["Slab is level with no significant cracks", "Surface is clean and sealed"],
    wear: ["Fine shrinkage cracks across the slab", "Staining and wider cracks", "Cracked and uneven slab with displacement"],
  },
  out_drainage: {
    good: ["Ground falls away from the house", "No ponding or silt marks visible"],
    wear: ["Flat ground close to the house in places", "Silt marks where water has sat", "Ponding against the foundations"],
  },
  out_driveway: {
    good: ["Surface is even with clean edges", "No cracking or potholes visible"],
    wear: ["Surface is weathered and stained", "Cracking and some edge breakup", "Potholes and wide cracks across the surface"],
  },
  out_fencing: {
    good: ["Fence lines are straight with sound posts", "Palings and rails are intact"],
    wear: ["Palings greyed and weathered", "Leaning sections and loose palings", "Rotten posts and fallen or missing sections"],
  },
  out_retaining: {
    good: ["Wall is plumb with no bulging", "Weep holes and drainage visible"],
    wear: ["Weathering on the face of the wall", "Slight lean or bulge along the wall", "Wall leaning with cracked or rotted members"],
  },
};

/**
 * Generated evidence for a sample report: two observations matched to the
 * condition band, each citing the photograph it came from.
 */
export function sampleEvidence(id: string, score: number | null, photoRefs: number[]): string[] {
  const s = SIGNS[id];
  if (!s || score == null) return [];
  const cite = photoRefs.length ? ` (Photo ${photoRefs[0]})` : "";
  const lines =
    score >= 8 ? [s.good[0], s.good[1]]
    // Fair: the SECOND good sign with the lightest wear. The first good sign
    // is the item's headline finish ("colour even, no chalking"), and pairing
    // it with the first wear sign ("faded and chalked") contradicted itself.
    : score >= 6 ? [s.good[1], s.wear[0]]
    : score >= 5 ? [s.wear[0], s.wear[1]]
    : [s.wear[1], s.wear[2]];
  return lines.map((l) => `${l}${cite}.`);
}

const sentences = (text: string): string[] =>
  (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]).map((t) => t.trim()).filter(Boolean);

/**
 * The evidence to show for an item, from whatever the report holds.
 *
 * Recorded evidence wins. Without it, the sentences of the assessment that
 * cite a photograph ARE observations — the analysis was told to ground them —
 * so those are shown rather than nothing. An empty result means the report
 * holds no observation at all, and the card must say THAT, never "nothing
 * wrong".
 */
export function evidenceFor(item: {
  conditionEvidence?: string[];
  aiSummary?: string;
}): string[] {
  if (item.conditionEvidence?.length) return item.conditionEvidence;
  const cited = sentences(item.aiSummary ?? "").filter((t) => /\bphotos?\s*\d/i.test(t));
  return cited.slice(0, 4);
}

const words = (t: string) => new Set(t.toLowerCase().match(/[a-z]{4,}/g) ?? []);
const overlap = (a: string, b: string) => {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let n = 0;
  for (const w of wa) if (wb.has(w)) n++;
  return n / Math.min(wa.size, wb.size);
};

/**
 * Defects and observations as one list, without saying anything twice.
 *
 * The defect and the assessment often describe the same crack — one bare, one
 * citing its photo. The cited line is kept and shown AS the concern, so the
 * reader gets the warning colour and the photo number in one line.
 */
export function mergeEvidence(concerns: string[], evidence: string[]): { concerns: string[]; seen: string[] } {
  const outConcerns: string[] = [];
  const seen: string[] = [];
  const used = new Set<number>();
  for (const c of concerns) {
    const i = evidence.findIndex((e, j) => !used.has(j) && overlap(c, e) >= 0.6);
    if (i >= 0) {
      used.add(i);
      outConcerns.push(evidence[i]);
    } else outConcerns.push(c);
  }
  evidence.forEach((e, j) => {
    if (!used.has(j) && !outConcerns.some((c) => overlap(c, e) >= 0.6)) seen.push(e);
  });
  return { concerns: outConcerns, seen };
}
