# RoiQ Scoring — Revised Model (proposed)

> **Status:** ✅ **Built (Phase 1).** Implemented in the code as the v4 model — `SCORING_EXPLAINED.md` now describes the superseded v3.1 model. Location penalties + facts currently come from the AI's inference; **Phase 2** (wiring the paid API for real geocoded distances) is still to do.
>
> **Headline rename:** the score is now called the **"Condition & Quality Score"** (not "Property Score") — because it deliberately does *not* reflect location desirability.

---

## The philosophy

**The RoiQ Condition & Quality Score measures whether a property is sound and free of value-destroying defects — the objective quality of the property itself. It does NOT measure how desirable the location is.**

Why: building condition is *objective* (a rotten roof is bad for everyone), but location desirability is *subjective* (waterfront thrills one buyer, a quiet cul-de-sac thrills another). Baking location into one number forces the model to pick a preference on the buyer's behalf and produces a "false" score for anyone who disagrees.

Three clean rules follow:

- **Location upside → never scored.** Views, school zones, walkability etc. are subjective and external. Shown as facts for the buyer to weigh.
- **Location downside → penalty only.** Objective negatives that hurt resale for almost everyone (highway, flight path…) pull the score *down*, transparently — never up.
- **On-site value-adds → bonus only.** Physical assets that are *part of the property* and objectively lift resale (an extra dwelling, a pool) *add* points when present — and never penalise their absence.

Internal physical value-add = bonus. External location desirability = facts only. Objective on-site/near-site defect = penalty.

---

## How the score is built

```
1. BASE (0–1000)     = quality of the property itself
                       (Improvements + Land + Legal), normalised to 1000

2. PENALTIES (0 → −150) = objective location negatives, address-specific,
                          scaled by proximity, capped at −150

3. BONUSES (0 → +60)    = objective on-site value-adds (extra dwelling, pool),
                          additive only, capped at +60

4. FINAL SCORE       = BASE  −  capped penalties  +  capped bonuses
```

The base uses the same mechanic as today: each item gets a 1–10 score, earns `(score ÷ 10) × max points`, and the total is normalised `earned ÷ max × 1000`. Then penalties are subtracted and bonuses added, with every adjustment shown itemised.

---

## What was removed, and why

**Erased completely** — can't be judged reliably from a listing, so guessing them just adds noise:

- ❌ Flood risk
- ❌ Liquefaction risk
- ❌ Coastal hazard / erosion
- ❌ Soil & ground stability
- ❌ Fault line proximity
- ❌ Wind / elements exposure

All **location "upside" items** (schools, growth, amenities, transport, walkability, parks, views, sun-as-a-bonus) are **removed from scoring** and moved to the un-scored facts panel. The **pool** is removed from the base items too — it's now a bonus (see below), not a 1-point line item.

---

## The positive base — what still earns points

### 🏠 Improvements — unchanged (Buyer 500 / Investor 470)
Exterior, Kitchen, Bathroom(s), Living areas, Bedrooms, Garage, Outdoor & grounds — as in the current model (`lib/scoring/model.ts`). The bulk of the score; no change. *(Pool moves out to the bonus section.)*

### 🌱 Land — hazards & wind stripped out (Buyer 62 / Investor 60)
Only genuinely **site-specific, judgeable** items remain:

| Item | Buyer | Investor |
|---|--:|--:|
| Section size | 18 | 14 |
| Topography / contour | 14 | 9 |
| Aspect of land (north-facing slope etc.) | 10 | 7 |
| Shape & usability | 9 | 6 |
| Subdivision / development potential | 3 | 14 |
| Frontage & access (ROW vs road) | 5 | 8 |
| Established / protected trees | 3 | 2 |

### 📄 Legal — unchanged (Buyer 110 / Investor 130)
Title, weathertightness, unconsented works, consents, EQC, body corp, easements, cross-lease, LIM, encumbrances — as in the current model.

### Effect on the mix
With location upside gone and Land trimmed, the **building drives ~75% of the base score** (Improvements ≈ 500/672 for a buyer), Legal ≈ 16%, Land ≈ 9%. Intended — the base is a *property soundness* score; location acts only as a downward counterweight, and on-site assets as a small upward booster.

---

## Location — shown, not scored

### Facts panel (address-specific, NEVER points)
Geocode the property and surface the real numbers so the buyer weighs them personally:

- **Schools** — nearest schools, **distance + in-zone status + decile / ERO rating** where available
- Distance to public transport (bus / train)
- Distance to supermarket / shops / cafés
- Distance to parks & recreation
- Water / views / outlook
- Sun / aspect
- Distance to CBD / employment

These inform the buyer; they do not move the score.

### Penalties (address-specific, scored DOWN only, cap −150)
Objective negatives that hurt resale for almost everyone. Each scales by proximity/severity — frontage = full deduction, a street back = less, beyond range = zero.

| Objective negative | Max deduction |
|---|--:|
| Busy road / highway frontage | −60 |
| Under / near flight path | −45 |
| Rail line adjacent | −38 |
| Industrial / heavy-commercial neighbour | −38 |
| High-voltage lines / pylons overhead | −30 |
| No sun / permanently shaded site | −23 |
| **Total cap** | **−150** |

**Consequence (accepted):** two identical houses with no negatives — one on the beach, one on a dull inland street — score the **same**. The beach premium lives in the *price* and the *facts panel*, not the score.

---

## On-site value-adds — shown, added on (additive only, cap +60)

Physical assets that are part of the property and objectively lift resale. **Present → adds points. Absent → nothing taken off.** Scaled by condition, so a neglected asset adds little.

| Value-add | Max bonus | How it scales |
|---|--:|---|
| Extra dwelling (sleepout, minor dwelling, etc.) | +50 | `(condition ÷ 10) × (replacement cost ÷ $10k)` |
| Swimming pool / spa | +12 | by condition; a derelict pool → ~0, never negative |
| **Combined cap** | **+60** | |

> **Honest note on pools:** pools are genuinely polarising in NZ resale (maintenance, safety, insurance — some buyers count them *against* a property). The bonus is deliberately modest and condition-gated so a tired pool doesn't inflate the score. It is never a penalty.

*(Solar panels follow the same "objective on-site value-add" logic and are currently a 5-pt base item — candidate to move here as a bonus too. Flagged, not yet decided.)*

---

## Transparency — every adjustment shown

The report states exactly what moved the score and why:

```
Condition & Quality Score:  845 / 1000
Building & land quality: 880   ·   Location −68   ·   On-site value-adds +33

Adjustments:
  +33   Minor dwelling (sleepout) — good condition, ~$45k replacement
  −45   Under flight path — within airport noise contour (~1.2 km)
  −23   Limited sun — south-facing site, low winter sun
  ─────
  −35   net adjustment      (penalty cap −150 · bonus cap +60)
```

When there's nothing to adjust, each line becomes a signal:

```
Location penalties:  none  ✓   Clear of highways, flight paths, rail and industry.
On-site value-adds:  none
```

Every line names its reason and the distance/condition it's based on, so a buyer can sanity-check it.

---

## Build dependency — data source

**Decision: paid API** (e.g. Google Places) for geocoding + address-level distances (schools, transport, amenities, highways, rail, industry, etc.). One integration, easy, at a **per-property lookup cost**. Mapbox stays for mapping.

> Note: **school zone boundaries + decile/ERO** aren't in Places — those specifically come from **Ministry of Education open data**. So the schools fact still needs that one free dataset wired alongside the paid API. Everything else (distances, POIs) is the API.

---

## Still open

1. **Exact bonus magnitudes** — pool +12 and the dwelling formula are proposals; tune once we see real examples.
2. **Solar as a bonus** — move it out of the base into the value-add bucket (same logic), or leave as a base item?

---

## Summary of changes vs current v3.1

| | Current (v3.1) | Revised |
|---|---|---|
| Headline name | "Property Score" | **"Condition & Quality Score"** |
| Location upside | Scored (~12% effective) | **Not scored** — facts only |
| Location negatives | Weak, mostly excluded | **Penalty, −150 cap**, address-specific |
| On-site value-adds (pool, extra dwelling) | Tiny base items / +50 dwelling | **Bonus, +60 cap**, additive only |
| Flood / liquefaction / coastal / soil / fault / wind | Scored or town-context | **Erased** |
| "Town-context excluded" concept | Yes | Gone — nothing fake is scored |
| Location data | LLM inference | **Real geocoded distances (paid API)** |
| Building's share of base score | ~65% | ~75% (by design) |
| Adjustments shown to user | No | **Yes — itemised with reasons** |
