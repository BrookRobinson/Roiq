// ============================================================
// RoiQ — renovation costing engine (v3.6)
// Deterministic. For every flagged renovation item it produces a Patch Up and a
// Full Replacement option, each with a transparent breakdown:
//   materials (real Mitre 10 / Bunnings / PlaceMakers products + links)
//   + labour (regional rate)
//   = total, with the m²/unit working shown.
//
// Trade items (roof, paint, gutters, flooring, deck, driveway, insulation,
// windows) are costed bottom-up: quantity × (material rate + labour rate).
// Room renos (bathroom, kitchen) use a blended $/m² refit rate (calibrated to
// real NZ refit costs, shared with the visualiser) with the materials/labour
// split shown and key fixtures listed. Generic items fall back to the AI's
// own replacement estimate.
// ============================================================

import { catalogItem, RETAIL_CAPTURED, type CatalogId, type RetailProduct } from "./catalog";
import { REGIONAL_MULTIPLIERS } from "@/lib/labour-rates";
import { tierPrice } from "@/lib/reno-visualiser";

export type RenoKind =
  | "roof" | "exterior_paint" | "gutters" | "windows" | "deck" | "foundation"
  | "bathroom" | "kitchen" | "flooring" | "driveway" | "insulation" | "generic";

export interface MaterialLine {
  name: string;
  retailer: string;
  url: string;
  qty: number;
  unit: string;
  unitPrice: number;
  lineCost: number;
  exact: boolean;
}

export interface CostOption {
  kind: "patch" | "full";
  label: string;          // "Patch Up" | "Full Replacement"
  cost: number;           // total NZD (materials + labour)
  description: string;    // exactly what's done
  materialsCost: number;
  labourCost: number;
  materials: MaterialLine[];
  labourWorking: string;  // e.g. "48 lin m × $27/m installer"
  workings: string;       // one-line m²/unit calc, e.g. "14m² × $32/m² + $35/m² = $1,120"
  durability: string;     // honesty about how long the fix lasts
}

export interface RenoCosting {
  kind: RenoKind;
  quantity: number;
  unit: string;
  regionLabel: string;
  captured: string;
  patch: CostOption;
  full: CostOption;
}

// ── helpers ────────────────────────────────────────────────────────────────
const round = (n: number) => Math.round(n);
const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const rate = (n: number) => `$${Math.round(n)}`;

const CITY_TO_REGION: Record<string, string> = {
  hokitika: "West Coast", greymouth: "West Coast", westport: "West Coast", reefton: "West Coast", westland: "West Coast",
  auckland: "Auckland", wellington: "Wellington", christchurch: "Christchurch", hamilton: "Hamilton",
  tauranga: "Tauranga", dunedin: "Dunedin", nelson: "Nelson / Marlborough", queenstown: "Remote / Rural",
  invercargill: "Southland", napier: "Hawke's Bay", hastings: "Hawke's Bay", "new plymouth": "Taranaki",
  whanganui: "Manawatū-Whanganui", "palmerston north": "Manawatū-Whanganui", rotorua: "Bay of Plenty",
};

function regionMultiplier(region?: string | null): { m: number; label: string } {
  if (!region) return { m: 0.85, label: "provincial NZ" };
  if (REGIONAL_MULTIPLIERS[region] != null) return { m: REGIONAL_MULTIPLIERS[region], label: region };
  const mapped = CITY_TO_REGION[region.toLowerCase().trim()];
  if (mapped && REGIONAL_MULTIPLIERS[mapped] != null) return { m: REGIONAL_MULTIPLIERS[mapped], label: mapped };
  return { m: 0.85, label: region };
}

function matLine(id: CatalogId, qty: number): MaterialLine {
  const c: RetailProduct = catalogItem(id);
  return {
    name: c.name, retailer: c.retailer, url: c.url, unit: c.unit, unitPrice: c.price,
    qty: Math.round(qty * 100) / 100, lineCost: round(c.price * qty), exact: c.exact,
  };
}

// A material we don't stock a shelf price for (e.g. made-to-measure joinery).
function customMat(name: string, retailer: string, url: string, qty: number, unit: string, unitPrice: number): MaterialLine {
  return { name, retailer, url, qty, unit, unitPrice, lineCost: round(unitPrice * qty), exact: false };
}

function opt(a: {
  kind: "patch" | "full"; label: string; description: string;
  materials: MaterialLine[]; materialsCost?: number; labourCost: number;
  labourWorking: string; workings: string; durability: string;
}): CostOption {
  const materialsCost = round(a.materialsCost ?? a.materials.reduce((s, m) => s + m.lineCost, 0));
  const labourCost = round(a.labourCost);
  return {
    kind: a.kind, label: a.label, description: a.description,
    materialsCost, labourCost, cost: materialsCost + labourCost,
    materials: a.materials, labourWorking: a.labourWorking, workings: a.workings, durability: a.durability,
  };
}

// ── which recipe applies ─────────────────────────────────────────────────────
export function kindForItem(id: string, category?: string, name?: string): RenoKind {
  const hay = `${id} ${name ?? ""}`.toLowerCase();
  // Specific components first, BEFORE the room category — so a bathroom
  // "Waterproofing" or "Ventilation" item doesn't inherit the vanity-swap refit.
  if (/driveway|paving|concrete\s*(drive|path|slab)/.test(hay)) return "driveway";
  if (/\broof/.test(hay)) return "roof";
  if (/gutter|spout|downpipe/.test(hay)) return "gutters";
  if (/window|joinery|glaz/.test(hay)) return "windows";
  if (/deck/.test(hay)) return "deck";
  if (/foundation|pile|subfloor/.test(hay)) return "foundation";
  if (/insulat/.test(hay)) return "insulation";
  if (/floor|carpet|vinyl|lino/.test(hay)) return "flooring";
  // Service components → neutral generic costing (not a full refit recipe).
  if (/waterproof|ventilat|extract|hot\s?water|cylinder|mould|plumb|wiring|electric/.test(hay)) return "generic";
  if (/cladding|weatherboard|exterior\s*paint|repaint|paint/.test(hay)) return "exterior_paint";
  // Room-scope fixtures / cabinetry → full room recipe (component swap ↔ refit).
  if (category === "Bathroom") return "bathroom";
  if (category === "Kitchen") return "kitchen";
  return "generic";
}

function quantityFor(kind: RenoKind, floorSqm: number, bedrooms: number): { q: number; unit: string } {
  const floor = floorSqm > 0 ? floorSqm : 120;
  switch (kind) {
    case "roof": return { q: round(floor * 1.15), unit: "m²" };
    case "exterior_paint": return { q: round(floor * 1.6), unit: "m²" };
    case "gutters": return { q: round(4 * Math.sqrt(floor) * 1.1), unit: "lin m" };
    case "foundation": return { q: round(4 * Math.sqrt(floor) * 1.1), unit: "lin m" };
    case "windows": return { q: Math.max(6, bedrooms * 2 + 4), unit: "units" };
    case "deck": return { q: 20, unit: "m²" };
    case "bathroom": return { q: 5, unit: "m²" };
    case "kitchen": return { q: 12, unit: "m²" };
    case "flooring": return { q: Math.min(round(floor), 60), unit: "m²" };
    case "driveway": return { q: 30, unit: "m²" };
    case "insulation": return { q: round(floor), unit: "m²" };
    default: return { q: 1, unit: "job" };
  }
}

// ── recipes: each returns [patch, full] ──────────────────────────────────────
function recipe(kind: RenoKind, q: number, m: number, fallback?: { low: number; high: number } | null): { patch: CostOption; full: CostOption } {
  switch (kind) {
    case "flooring": {
      const matR = catalogItem("vinyl_plank").price;       // $/m²
      const labR = round(35 * m);                          // $/m²
      const pa = Math.max(4, round(q * 0.3));
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Replace only the worst ~${pa}m² of boards and re-lay the sound sections; fill and level the subfloor.`,
          materials: [matLine("vinyl_plank", pa)], labourCost: pa * round(20 * m),
          labourWorking: `${pa}m² × ${rate(20 * m)}/m² (uplift + relay)`,
          workings: `${pa}m² × ${rate(matR)}/m² materials + ${rate(20 * m)}/m² labour = ${money(matLine("vinyl_plank", pa).lineCost + pa * round(20 * m))}`,
          durability: "Temporary — buys ~2–4 years",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Uplift the old covering, prep the subfloor, then supply and lay new vinyl plank across ${q}m².`,
          materials: [matLine("vinyl_plank", q)], labourCost: q * labR,
          labourWorking: `${q}m² × ${rate(labR)}/m² floor layer`,
          workings: `${q}m² × ${rate(matR)}/m² materials (vinyl plank, Mitre 10) + ${rate(labR)}/m² labour = ${money(round(matR * q) + q * labR)}`,
          durability: "Permanent — ~15–20 years",
        }),
      };
    }
    case "roof": {
      const matR = catalogItem("colorsteel_roof").price;   // $/m²
      const labR = round(95 * m);
      const pa = Math.max(8, round(q * 0.2));
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Replace failed sheets and flashings over ~${pa}m², reseal fixings and treat surface rust.`,
          materials: [matLine("colorsteel_roof", pa)], labourCost: pa * labR + round(6 * 80 * m),
          labourWorking: `${pa}m² × ${rate(labR)}/m² + 6h access/setup`,
          workings: `${pa}m² × ${rate(matR)}/m² materials + ${rate(labR)}/m² labour + setup = ${money(round(matR * pa) + pa * labR + round(6 * 80 * m))}`,
          durability: "Temporary — buys ~3–6 years",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Strip the existing roof, replace building paper and install new Colorsteel long-run roofing with new flashings across ${q}m².`,
          materials: [matLine("colorsteel_roof", q)], labourCost: q * labR,
          labourWorking: `${q}m² × ${rate(labR)}/m² roofer`,
          workings: `${q}m² × ${rate(matR)}/m² materials (Colorsteel, PlaceMakers) + ${rate(labR)}/m² labour = ${money(round(matR * q) + q * labR)}`,
          durability: "Permanent — ~30+ years",
        }),
      };
    }
    case "exterior_paint": {
      const labR = round(28 * m);
      const tins = Math.max(2, Math.ceil(q / 45));
      const pa = round(q * 0.4);
      const ptins = Math.max(1, Math.ceil(pa / 45));
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Spot-prime and repaint only the weathered/peeling elevations (~${pa}m²); wash down the rest.`,
          materials: [matLine("exterior_paint_10L", ptins)], labourCost: pa * labR,
          labourWorking: `${pa}m² × ${rate(labR)}/m² painter`,
          workings: `${ptins}×10L Resene + ${pa}m² × ${rate(labR)}/m² labour = ${money(matLine("exterior_paint_10L", ptins).lineCost + pa * labR)}`,
          durability: "Temporary — buys ~2–4 years",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Full wash, scrape, prep and two-coat exterior repaint across ~${q}m² of wall area.`,
          materials: [matLine("exterior_paint_10L", tins)], labourCost: q * labR,
          labourWorking: `${q}m² × ${rate(labR)}/m² painter`,
          workings: `${tins}×10L Resene (Mitre 10) + ${q}m² × ${rate(labR)}/m² labour = ${money(matLine("exterior_paint_10L", tins).lineCost + q * labR)}`,
          durability: "Permanent — ~8–12 years",
        }),
      };
    }
    case "gutters": {
      const labR = round(35 * m);
      const pa = Math.max(6, round(q * 0.3));
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Re-secure brackets, seal leaking joints and replace the worst ~${pa} lin m of PVC spouting.`,
          materials: [matLine("pvc_spouting", pa)], labourCost: pa * labR + round(4 * 80 * m),
          labourWorking: `${pa} lin m × ${rate(labR)}/m + 4h`,
          workings: `${pa} lin m × ${rate(catalogItem("pvc_spouting").price)}/m PVC + ${rate(labR)}/m labour + setup = ${money(matLine("pvc_spouting", pa).lineCost + pa * labR + round(4 * 80 * m))}`,
          durability: "Temporary — buys ~3–5 years",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Replace all spouting and downpipes with new Colorsteel metal — far longer life than PVC in West Coast rainfall.`,
          materials: [matLine("steel_spouting", q)], labourCost: q * labR,
          labourWorking: `${q} lin m × ${rate(labR)}/m installer`,
          workings: `${q} lin m × ${rate(catalogItem("steel_spouting").price)}/m materials (Colorsteel, PlaceMakers) + ${rate(labR)}/m labour = ${money(round(catalogItem("steel_spouting").price * q) + q * labR)}`,
          durability: "Permanent — ~25+ years",
        }),
      };
    }
    case "windows": {
      const unit = 550, lab = round(550 * m);
      const pa = Math.max(2, round(q * 0.3));
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Repair, re-putty and draught-seal the existing timber joinery; replace only the ${pa} worst units.`,
          materials: [customMat("Aluminium DGU (made-to-measure)", "Trade joinery", "https://www.bunnings.co.nz/search/products?q=aluminium%20window", pa, "units", unit)],
          labourCost: pa * lab + round(8 * 90 * m),
          labourWorking: `${pa} units installed + 8h repairs`,
          workings: `${pa} units × ~${money(unit + lab)} each + repair labour = ${money(pa * (unit + lab) + round(8 * 90 * m))}`,
          durability: "Temporary — buys ~5–8 years",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Replace ${q} single-glazed timber windows with new aluminium double-glazed units (supply + install).`,
          materials: [customMat("Aluminium DGU (made-to-measure)", "Trade joinery", "https://www.bunnings.co.nz/search/products?q=aluminium%20window", q, "units", unit)],
          labourCost: q * lab,
          labourWorking: `${q} units × ${money(lab)} install`,
          workings: `${q} windows × ~${money(unit + lab)} each (aluminium DGU supply + install) = ${money(q * (unit + lab))}`,
          durability: "Permanent — ~30+ years + warmer/drier",
        }),
      };
    }
    case "deck": {
      const linPerSqm = 7.4;
      const matR = catalogItem("decking_timber").price; // $/lin m
      const labR = round(120 * m);
      const pa = Math.max(4, round(q * 0.4));
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Replace rotten/cupped boards over ~${pa}m², refix loose boards and re-oil the whole deck.`,
          materials: [matLine("decking_timber", pa * linPerSqm)], labourCost: pa * labR,
          labourWorking: `${pa}m² × ${rate(labR)}/m² builder`,
          workings: `${round(pa * linPerSqm)} lin m boards × ${rate(matR)}/m + ${pa}m² × ${rate(labR)}/m² labour = ${money(matLine("decking_timber", pa * linPerSqm).lineCost + pa * labR)}`,
          durability: "Temporary — buys ~3–5 years",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Rebuild the deck — new treated framing where needed, new ${q}m² of decking boards, fixings and finish.`,
          materials: [matLine("decking_timber", q * linPerSqm)], labourCost: q * labR,
          labourWorking: `${q}m² × ${rate(labR)}/m² builder`,
          workings: `${round(q * linPerSqm)} lin m boards × ${rate(matR)}/m (PlaceMakers) + ${q}m² × ${rate(labR)}/m² labour = ${money(matLine("decking_timber", q * linPerSqm).lineCost + q * labR)}`,
          durability: "Permanent — ~20+ years",
        }),
      };
    }
    case "foundation": {
      const labR = round(300 * m); // $/lin m re-pile
      const pa = Math.max(4, round(q * 0.25));
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Re-level and pack or replace the worst piles (~${pa} lin m), improve subfloor ventilation and drainage.`,
          materials: [matLine("concrete_20kg", pa * 4)], labourCost: pa * round(180 * m) + round(8 * 90 * m),
          labourWorking: `${pa} lin m × ${rate(180 * m)}/m + 8h`,
          workings: `${pa} lin m re-level × ${rate(180 * m)}/m labour + materials = ${money(matLine("concrete_20kg", pa * 4).lineCost + pa * round(180 * m) + round(8 * 90 * m))}`,
          durability: "Temporary — buys ~5–10 years; monitor",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Re-pile the dwelling — replace perimeter piles around ~${q} lin m with new concrete piles and re-level the floor.`,
          materials: [matLine("concrete_20kg", q * 4)], labourCost: q * labR,
          labourWorking: `${q} lin m × ${rate(labR)}/m re-pile`,
          workings: `${q} lin m × ${rate(labR)}/m labour (re-pile + re-level) + materials = ${money(matLine("concrete_20kg", q * 4).lineCost + q * labR)}`,
          durability: "Permanent — structural; ~50+ years",
        }),
      };
    }
    case "driveway": {
      const labR = round(55 * m);     // $/m² place & finish
      const pa = Math.max(4, round(q * 0.2));
      const bags = round(pa * 11);    // ~11 × 20kg bags per m² at 100mm
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Cut out the worst sections (~${pa}m²), fill with ready-mix concrete and grout the minor cracks.`,
          materials: [matLine("concrete_20kg", bags)], labourCost: round(8 * 65 * m) + pa * labR,
          labourWorking: `${pa}m² × ${rate(labR)}/m² + 8h`,
          workings: `${bags}×20kg ready-mix (Bunnings) + ${pa}m² × ${rate(labR)}/m² labour = ${money(matLine("concrete_20kg", bags).lineCost + round(8 * 65 * m) + pa * labR)}`,
          durability: "Temporary — buys ~2–4 years",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Full demolition and removal, base prep and a new 100mm reinforced concrete pour across ${q}m².`,
          materials: [matLine("concrete_20kg", 0)], materialsCost: round(35 * q),
          labourCost: q * (labR + round(40 * m)),
          labourWorking: `${q}m² × (${rate(labR)}/m² pour + ${rate(40 * m)}/m² demo & base)`,
          workings: `${q}m² × ${rate(35)}/m² concrete + ${q}m² × ${rate(labR + 40 * m)}/m² demo, base & labour = ${money(round(35 * q) + q * (labR + round(40 * m)))}`,
          durability: "Permanent — ~40+ years",
        }),
      };
    }
    case "insulation": {
      const matR = catalogItem("ceiling_batts").price;
      const labR = round(14 * m);
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Top up the existing ceiling insulation to bring thin/low areas up to standard.`,
          materials: [matLine("ceiling_batts", round(q * 0.4))], labourCost: round(q * 0.4) * labR,
          labourWorking: `${round(q * 0.4)}m² × ${rate(labR)}/m²`,
          workings: `${round(q * 0.4)}m² × ${rate(matR)}/m² materials + ${rate(labR)}/m² labour = ${money(matLine("ceiling_batts", round(q * 0.4)).lineCost + round(q * 0.4) * labR)}`,
          durability: "Permanent — closes gaps",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Remove old insulation and install new R3.6 ceiling batts across the full ${q}m² ceiling.`,
          materials: [matLine("ceiling_batts", q)], labourCost: q * labR,
          labourWorking: `${q}m² × ${rate(labR)}/m²`,
          workings: `${q}m² × ${rate(matR)}/m² materials (Pink Batts, Bunnings) + ${rate(labR)}/m² labour = ${money(round(matR * q) + q * labR)}`,
          durability: "Permanent — ~50 years; meets Healthy Homes",
        }),
      };
    }
    case "bathroom": {
      const full = tierPrice("bathroom", "high", q);
      const vanity = matLine("vanity_600", 1), mixer = matLine("basin_mixer", 1), paint = matLine("interior_paint_10L", 1);
      const pm = vanity.lineCost + mixer.lineCost + paint.lineCost;
      const pl = round(4 * 115 * m) + round(8 * 55 * m); // plumber 4h + painter 1 day
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Swap the vanity and tapware and repaint — keep the existing tiles, toilet, shower and layout exactly as they are.`,
          materials: [vanity, mixer, paint], labourCost: pl,
          labourWorking: `Plumber 4h × ${rate(115 * m)}/hr + painter 1 day`,
          workings: `${money(pm)} fittings + ${money(pl)} labour = ${money(pm + pl)}`,
          durability: "Cosmetic refresh — buys ~4–6 years",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Full strip-out and refit — new vanity, toilet, shower, retile floor and walls, waterproof, new tapware and lighting.`,
          materials: [matLine("wall_tile_white", round(q * 2.2)), matLine("vanity_900", 1), matLine("toilet_suite", 1), matLine("shower_mixer", 1), matLine("waterproofing_kit", 1)],
          materialsCost: round(full * 0.4), labourCost: round(full * 0.6),
          labourWorking: `Builder + plumber + tiler + electrician (~60% of cost)`,
          workings: `${q}m² full refit × ${rate(full / q)}/m² (strip-out, waterproofing, tiling, fixtures, plumbing) ≈ 40% materials / 60% labour = ${money(full)}`,
          durability: "Permanent — ~20–25 years",
        }),
      };
    }
    case "kitchen": {
      const full = tierPrice("kitchen", "high", q);
      const bench = matLine("benchtop_laminate", round(q * 0.5)), sink = matLine("sink_double", 1), kmix = matLine("kitchen_mixer", 1), dish = matLine("dishwasher_entry", 1);
      const pm = bench.lineCost + sink.lineCost + kmix.lineCost + dish.lineCost;
      const pl = round(12 * 90 * m); // cabinetmaker/fitter 1.5 days
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Reface or repaint the existing cabinetry and fit a new laminate benchtop, sink, mixer and dishwasher — keep the existing layout.`,
          materials: [bench, sink, kmix, dish], labourCost: pl,
          labourWorking: `Fitter ~1.5 days × ${rate(90 * m)}/hr`,
          workings: `${money(pm)} benchtop + appliances + ${money(pl)} labour = ${money(pm + pl)}`,
          durability: "Refresh — buys ~5–8 years",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `New kitchen — custom cabinetry, stone or laminate benchtop, new appliances, sink, tapware, tiled splashback and lighting.`,
          materials: [matLine("benchtop_laminate", round(q * 0.6)), matLine("sink_double", 1), matLine("kitchen_mixer", 1), matLine("dishwasher_entry", 1), matLine("oven_freestanding", 1), matLine("rangehood", 1)],
          materialsCost: round(full * 0.45), labourCost: round(full * 0.55),
          labourWorking: `Cabinetmaker + plumber + electrician + builder (~55% of cost)`,
          workings: `${q}m² new kitchen × ${rate(full / q)}/m² (cabinetry, benchtop, appliances, install) ≈ 45% materials / 55% labour = ${money(full)}`,
          durability: "Permanent — ~15–20 years",
        }),
      };
    }
    default: {
      // Generic: anchor to the AI's own replacement estimate (already era/region-aware).
      const hi = fallback?.high ?? 6000, lo = fallback?.low ?? Math.round(hi * 0.7);
      const mid = round((lo + hi) / 2);
      const patchCost = round(mid * 0.4);
      return {
        patch: opt({
          kind: "patch", label: "Patch Up",
          description: `Targeted repair of the worst areas rather than a full replacement — a temporary measure.`,
          materials: [], materialsCost: round(patchCost * 0.5), labourCost: round(patchCost * 0.5),
          labourWorking: `~50% labour`,
          workings: `Indicative — ${money(round(patchCost * 0.5))} materials + ${money(round(patchCost * 0.5))} labour = ${money(patchCost)}`,
          durability: "Temporary — buys a few years",
        }),
        full: opt({
          kind: "full", label: "Full Replacement",
          description: `Complete replacement to a permanent, compliant standard.`,
          materials: [], materialsCost: round(hi * 0.5), labourCost: round(hi * 0.5),
          labourWorking: `~50% labour`,
          workings: `Indicative — ${money(round(hi * 0.5))} materials + ${money(round(hi * 0.5))} labour = ${money(hi)}`,
          durability: "Permanent",
        }),
      };
    }
  }
}

/** Build the Patch / Full costing for one renovation item. */
export function costRenoItem(args: {
  id: string;
  name?: string;
  category?: string;
  region?: string | null;
  floorSqm?: number | null;
  bedrooms?: number | null;
  fallback?: { low: number; high: number } | null;
}): RenoCosting {
  const kind = kindForItem(args.id, args.category, args.name);
  const { m, label } = regionMultiplier(args.region);
  const { q, unit } = quantityFor(kind, args.floorSqm ?? 0, args.bedrooms ?? 3);
  const { patch, full } = recipe(kind, q, m, args.fallback);
  return { kind, quantity: q, unit, regionLabel: label, captured: RETAIL_CAPTURED, patch, full };
}
