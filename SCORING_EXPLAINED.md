# RoiQ — How the Score Out of 1000 Is Calculated

*Plain-English guide to the scoring engine (v3.1). Source of truth: `lib/scoring/model.ts` and `lib/scoring/engine.ts`.*

---

## The short version

1. RoiQ inspects a property across **4 areas**: Improvements, Location, Land, Legal.
2. Each area is made of many small **line items** (78 in total — e.g. Roof, Kitchen cabinetry, Flood risk, Title type).
3. Every line item is given a **1–10 score** by the AI from the photos and listing facts.
4. Each item is worth a fixed number of **max points**. Your item score is `(score ÷ 10) × max points`.
5. All the earned points are added up, then **normalised back onto a 0–1000 scale**.
6. A small **bonus of up to 50 points** can be added for extra dwellings (sleepouts, minor dwellings, etc.).
7. Final score = **0 to 1050**.

The points are split **differently for a Home Buyer vs an Investor** — same inspection, different priorities.

---

## Step 1 — The 4 inspection areas and how the 1000 points are split

| Inspection area | Home Buyer | Investor |
|---|---:|---:|
| **Improvements** (the building itself) | 500 | 470 |
| **Location** (the neighbourhood) | 220 | 240 |
| **Land** (the site & hazards) | 170 | 160 |
| **Legal** (title & compliance) | 110 | 130 |
| **TOTAL** | **1000** | **1000** |

Both columns always add up to exactly 1000. The difference reflects what matters more to each type of buyer — e.g. a buyer weights schools and living quality higher; an investor weights yield, growth and durability higher.

---

## Step 2 — The line items inside each area

Each item shows its **max points** for Buyer / Investor. **Score 10/10 earns the full points; 5/10 earns half; 1/10 earns a tenth.**

### 🏠 IMPROVEMENTS — Buyer 500 / Investor 470

**Exterior (230 / 225)**

| Item | Buyer | Investor |
|---|---:|---:|
| Foundation | 55 | 52 |
| Roof | 48 | 50 |
| Cladding | 42 | 44 |
| Windows & glazing | 28 | 28 |
| Decking / balcony | 12 | 6 |
| Guttering & downpipes | 10 | 11 |
| Soffits & fascias | 9 | 9 |
| Exterior doors / joinery | 8 | 6 |
| Exterior paint & condition | 8 | 9 |
| Chimney *(only if present)* | 5 | 5 |
| Solar panels *(only if present)* | 5 | 5 |

**Kitchen (70 / 55)**

| Item | Buyer | Investor |
|---|---:|---:|
| Cabinetry | 20 | 15 |
| Appliances (oven, cooktop, rangehood, dishwasher) | 16 | 13 |
| Benchtop | 13 | 9 |
| Flooring | 8 | 8 |
| Layout & storage | 6 | 5 |
| Sink & tapware | 4 | 3 |
| Splashback | 3 | 2 |

**Bathroom(s) (65 / 62)** — *scored per bathroom, then averaged*

| Item | Buyer | Investor |
|---|---:|---:|
| Shower / bath | 16 | 13 |
| Waterproofing (inferred) | 15 | 16 |
| Hot water system (cylinder / gas califont) | 12 | 13 |
| Vanity & tapware | 8 | 5 |
| Toilet | 6 | 4 |
| Ventilation / extraction | 5 | 8 |
| Flooring | 3 | 3 |

**Living areas (55 / 58)**

| Item | Buyer | Investor |
|---|---:|---:|
| Heating (primary source) | 15 | 20 |
| Size & flow | 13 | 9 |
| Insulation (visible / inferred) | 10 | 15 |
| Natural light & aspect | 7 | 5 |
| Flooring | 6 | 6 |
| Ceiling condition & height | 4 | 3 |

**Bedrooms (40 / 35)** — *scored across all bedrooms*

| Item | Buyer | Investor |
|---|---:|---:|
| Size | 13 | 12 |
| Heating source | 8 | 6 |
| Wardrobe / storage | 7 | 7 |
| Windows & natural light | 6 | 5 |
| Flooring | 4 | 3 |
| Ceiling condition | 2 | 2 |

**Garage (25 / 20)**

| Item | Buyer | Investor |
|---|---:|---:|
| Type (single / double / internal access) | 9 | 8 |
| Construction | 6 | 5 |
| Door & auto opener | 4 | 3 |
| Floor & condition | 4 | 2 |
| Power / lighting | 2 | 2 |

**Outdoor & grounds (15 / 15)**

| Item | Buyer | Investor |
|---|---:|---:|
| Drainage (falls / ponding) | 3 | 4 |
| Driveway & access | 4 | 3 |
| Fencing | 3 | 4 |
| Landscaping / gardens | 2 | 2 |
| Retaining walls *(only if present)* | 2 | 1 |
| Pool / spa *(only if present)* | 1 | 1 |

---

### 📍 LOCATION — Buyer 220 / Investor 240

| Item | Buyer | Investor | Scored? |
|---|---:|---:|:--|
| School zones & quality | 45 | 28 | ⚠️ Town-context — *not scored* |
| Suburb growth trend & demand | 30 | 42 | ⚠️ Town-context — *not scored* |
| Sun / aspect (orientation) | 25 | 10 | ✅ Scored |
| Proximity to amenities | 22 | 22 | ⚠️ Town-context — *not scored* |
| Street quality & neighbours | 20 | 16 | ✅ Scored |
| Distance to employment / CBD | 12 | 28 | ⚠️ Town-context — *not scored* |
| Public transport access | 11 | 24 | ⚠️ Town-context — *not scored* |
| Walkability | 15 | 18 | ✅ Scored |
| Proximity to parks & recreation | 13 | 10 | ✅ Scored |
| Views & outlook | 11 | 8 | ✅ Scored |
| Noise sources (motorway, rail, flights) | 8 | 8 | ✅ Scored |
| Crime / safety profile | 5 | 14 | ⚠️ Town-context — *not scored* |
| Future development / zoning nearby | 3 | 12 | ⚠️ Town-context — *not scored* |

### 🌱 LAND — Buyer 170 / Investor 160

| Item | Buyer | Investor | Scored? |
|---|---:|---:|:--|
| Flood risk | 30 | 30 | ⚠️ Town-context — *not scored* |
| Liquefaction risk (TC zoning) | 26 | 24 | ⚠️ Town-context — *not scored* |
| Coastal hazard / erosion risk | 22 | 20 | ⚠️ Town-context — *not scored* |
| Section size | 18 | 14 | ✅ Scored |
| Topography / contour | 14 | 9 | ✅ Scored |
| Soil & ground stability | 13 | 12 | ⚠️ Town-context — *not scored* |
| Fault line proximity | 11 | 10 | ⚠️ Town-context — *not scored* |
| Aspect of land (north-facing slope) | 10 | 7 | ✅ Scored |
| Shape & usability | 9 | 6 | ✅ Scored |
| Subdivision / development potential | 3 | 14 | ✅ Scored |
| Frontage & access (ROW vs road) | 5 | 8 | ✅ Scored |
| Wind / elements exposure | 6 | 4 | ⚠️ Town-context — *not scored* |
| Established / protected trees | 3 | 2 | ✅ Scored |

### 📄 LEGAL — Buyer 110 / Investor 130 *(all items scored)*

| Item | Buyer | Investor |
|---|---:|---:|
| Title type (freehold / cross-lease / unit / leasehold) | 28 | 30 |
| Weathertightness history (leaky-building era 1994–2004) | 22 | 24 |
| Unconsented works risk | 18 | 16 |
| Consents & code compliance | 14 | 14 |
| EQC / insurance claim history | 9 | 10 |
| Body corporate *(only if unit title / body corp)* | 6 | 18 |
| Easements & covenants on title | 5 | 6 |
| Cross-lease defects *(only if cross-lease)* | 4 | 5 |
| LIM red flags | 2 | 4 |
| Encumbrances / caveats | 2 | 3 |

---

## Step 3 — The important twist: "town-context" items don't count toward the score

Some Location and Land items describe the **whole town/suburb**, not the specific address — flood risk, school zones, growth trend, transport, etc. These are the same for *any* house in that area, so RoiQ shows them in the **City/Town tab** but **leaves them out of the 1000-point score** for the individual property.

The 13 excluded items are:

- **Location:** Schools, Growth trend, Amenities, Employment/CBD, Transport, Safety, Future development
- **Land:** Flood, Liquefaction, Coastal, Fault line, Soil, Wind

Only **site-specific** items score. This is why the raw max points don't literally add to 1000 for a given property — the engine **re-normalises** whatever items actually apply back onto the 0–1000 scale (see Step 5).

---

## Step 4 — Conditional items only count when they exist

Some items only apply to some properties. If the property doesn't have one, the item is **dropped entirely** (it doesn't help or hurt the score):

| Item | Only scored when… |
|---|---|
| Chimney | a chimney is visible / stated |
| Solar panels | solar panels are present |
| Retaining walls | retaining walls on site |
| Pool / spa | a pool or spa is present |
| Body corporate | title is unit-title (or cross-lease with a body corp) |
| Cross-lease defects | title is cross-lease |

An item is also skipped if the AI simply **couldn't score it** from the available photos/facts.

---

## Step 5 — The maths that produces the score

For every item that **applies and was scored**:

```
earned points  =  (AI score out of 10  ÷  10)  ×  item's max points
```

Then the engine adds up the earned points and the max points of only those items, and rescales:

```
BASE SCORE (0–1000)  =  round( total earned  ÷  total max  × 1000 )
```

So the base score is essentially **"what percentage of the possible points did this property earn, expressed out of 1000."**

- Every applicable item at 10/10 → **1000**
- Everything at 5/10 → **500**
- Everything at 1/10 → **100**

---

## Step 6 — Extra dwelling bonus (0–50 points)

Extra structures (sleepout, minor dwelling, pole shed, etc.) add a small bonus on top:

```
per structure  =  (condition ÷ 10)  ×  (replacement cost ÷ $10,000)
bonus          =  round( sum of all structures ), capped at 50
```

*Example: a $50,000 sleepout in perfect (10/10) condition = 1.0 × 5 = **5 bonus points**.*

---

## Step 7 — Final score

```
FINAL SCORE  =  BASE (0–1000)  +  DWELLING BONUS (0–50)     →   capped at 1050
```

---

## Worked example (Home Buyer)

A property where a handful of items scored like this:

| Item | AI score | Max (buyer) | Earned |
|---|:--:|---:|---:|
| Roof | 8/10 | 48 | 38.4 |
| Cladding | 4/10 | 42 | 16.8 |
| Kitchen (all items) | 6/10 | 70 | 42.0 |
| Heating | 7/10 | 15 | 10.5 |
| Title | 9/10 | 28 | 25.2 |
| …(all other applicable items)… | | | |

If the totals across every applicable, scored item came to **earned = 800** and **max = 950**, then:

```
BASE = round(800 ÷ 950 × 1000) = 842
No extra dwellings → bonus = 0
FINAL SCORE = 842 / 1050
```

---

## Bonus: how the score feeds the valuation

The 1000-point score is also used (unchanged) to estimate fair value — a higher score lifts the price-per-m² multiplier:

| Score | Quality band | Multiplier on suburb median $/m² |
|---|---|---:|
| under 200 | Poor | 0.65× |
| 200–399 | Below average | 0.80× |
| 400–599 | Average | 0.95× |
| 600–799 | Good | 1.20× |
| 800+ | Excellent | 1.45× |

`RoiQ Fair Value = suburb median $/m² × multiplier × floor area (m²)`

---

## Where this lives in the code

| What | File |
|---|---|
| All point values (the 78 items) | `lib/scoring/model.ts` |
| Town-context exclusion list | `lib/scoring/model.ts` (`TOWN_CONTEXT_IDS`) |
| The scoring maths (Steps 4–7) | `lib/scoring/engine.ts` (`scoreProperty`) |
| Buyer vs Investor split | `lib/scoring/report.ts` (`scoreBoth`) |
| Valuation multiplier | `lib/scoring/investment.ts` |
| AI that produces the 1–10 scores | `lib/ai/analyze.ts` |
