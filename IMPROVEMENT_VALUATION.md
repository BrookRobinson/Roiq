# Tectara — Itemised Improvement Valuation (v5)

Turns the Improvements **scores** into a **dollar value**, one line per component.
Engine: [`lib/scoring/improvement-values.ts`](lib/scoring/improvement-values.ts).

## Method — Depreciated Replacement Cost (the cost approach)

```
item value  =  Replacement-Cost-New  ×  spec multiplier  ×  condition factor
                  (base $ per item)       (tier = quality)     (depreciation)
```

The two multipliers ARE the two axes we already score:

| Axis | Source | Values |
|---|---|---|
| **Spec tier** — what it costs to build *new* | `SPEC_MULTIPLIER` | deteriorated 0.55 · dated 0.9 · modern 1.2 · luxury 1.6 |
| **Condition** — how much life is left (depreciation) | `conditionFactor(1–10)` | new (10) → 1.0 · mid (5) → 0.65 · poor (1) → 0.37 |

**Building value = base structure/services SHELL + Σ scored components.**

- The **shell** (`BASE_SHELL_RATE = $1,100/floor-m²`) is the real build cost that
  *isn't individually visible* and so isn't scored: framing, gib, ceilings, wiring,
  plumbing rough-in, consents, prelims, builder's margin. It depreciates by the
  components' blended (RCN-weighted) condition.
- **Only cost-bearing physical components carry a $ value.** Intrinsic qualities
  (**sun/aspect, size, flow, layout, natural light**) are scored but priced by the
  market/land, not as a build component — they carry **no $** here, by design.

## Value gap (renovation upside)

Each component also reports `valueGap = value at modern + as-new − value now` (floored
at 0). This is the uplift from renovating it, and plugs straight into the Renovations
tab (spend vs value reclaimed).

## Demo worked example — 14 Ferndale Rd (185 m², 2 bath, c.1975)

| | Value |
|---|---|
| Base structure & services (shell) | **$152,899** (45%) |
| Scored components (Σ, 38 items) | **$187,583** (55%) |
| **Building value** | **$340,482** ($1,840/m²) |
| Total renovation value gap | **$132,847** |

Reconciles with the previous blended `$/m²` estimate ($341,777) — this itemised
version replaces it as the source of truth.

Sample lines:

| Item | Tier | Cond | RCN new | Value now | Value gap |
|---|---|---|---|---|---|
| Foundation | dated | 7 | $37,000 | $26,307 | +$18,093 |
| Roof | dated | 4 | $31,450 | $16,417 | **+$21,323** |
| Kitchen cabinetry | modern | 8 | $10,000 | $10,320 | +$1,680 |
| Insulation | dated | 3 | $6,475 | $2,972 | +$4,798 |
| Benchtop | modern | 9 | $3,500 | $3,906 | +$294 |

(A modern, well-kept item like the benchtop is worth slightly *more* than its 1.0
reference RCN — spec 1.2 × condition 0.93 > 1 — and has almost no value gap.)

## The base-cost table (tunable — calibrated to `materials-db` + NZ 2026)

`baseRCN` is the replacement cost **new at the 1.0 reference spec**, for a reference
~150 m² / 1-bathroom home. `floorM2` items scale by floor area, `bathroom` items by
bathroom count, `fixed` items are one-per-house.

| Item | baseRCN | scale |
|---|---|---|
| **Exterior** | | |
| Foundation | $200 | floorM2 |
| Roof | $170 | floorM2 |
| Cladding | $150 | floorM2 |
| Windows & glazing | $16,000 | fixed |
| Decking / balcony | $9,000 | fixed |
| Guttering & downpipes | $5,000 | fixed |
| Soffits & fascias | $4,500 | fixed |
| Exterior doors / joinery | $4,000 | fixed |
| Exterior paint | $60 | floorM2 |
| Chimney | $6,000 | fixed |
| **Kitchen** | | |
| Cabinetry | $10,000 | fixed |
| Appliances | $7,000 | fixed |
| Benchtop | $3,500 | fixed |
| Flooring | $2,500 | fixed |
| Sink & tapware | $900 | fixed |
| Splashback | $1,300 | fixed |
| **Bathroom** (per bathroom, except hot water) | | |
| Shower / bath | $4,500 | bathroom |
| Waterproofing | $2,500 | bathroom |
| Hot water system | $2,800 | fixed |
| Vanity & tapware | $1,600 | bathroom |
| Toilet | $800 | bathroom |
| Ventilation / extraction | $650 | bathroom |
| Flooring | $1,200 | bathroom |
| **Living areas** | | |
| Heating (primary) | $5,000 | fixed |
| Lighting & fixtures | $3,000 | fixed |
| Insulation | $35 | floorM2 |
| Flooring | $30 | floorM2 |
| Ceiling | $2,500 | fixed |
| **Bedrooms** | | |
| Heating source | $1,500 | fixed |
| Wardrobe / storage | $2,500 | fixed |
| Flooring | $3,000 | fixed |
| Ceiling | $1,200 | fixed |
| **Garage** | | |
| Construction | $14,000 | fixed |
| Door & auto opener | $2,500 | fixed |
| Floor & condition | $2,500 | fixed |
| **Outdoor & grounds** | | |
| Drainage | $3,500 | fixed |
| Driveway & access | $7,000 | fixed |
| Fencing | $4,500 | fixed |
| Retaining walls | $9,000 | fixed |
| Pool / spa | $45,000 | fixed |

## Notes & next calibration

- An item that isn't present or wasn't assessed (score = null) is **skipped** — no
  phantom value (so absent decks/pools/garages don't count).
- Persona-neutral: a house is worth what it's worth regardless of buyer vs investor.
- **Phase 2:** source `floorM2` wall items off true wall area; pull `Replace` costs
  straight from `reno-costing/three-tier.ts` where a recipe exists; calibrate the
  shell rate + base costs against real sold comparables.
